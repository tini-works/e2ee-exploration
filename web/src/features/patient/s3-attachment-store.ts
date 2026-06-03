"use client";

import type { AttachmentStore } from "matrix-client/attachment";

/**
 * Browser-side AttachmentStore backed by the signer route
 * (/api/attachments/sign) + direct presigned S3 transfers. Holds no
 * credentials; uploads ciphertext only. Objects are room-scoped
 * (`rooms/<roomId>/<uuid>`). Large blobs use S3 multipart so the upload is
 * chunked. @see ref-encrypted-attachments
 */

const SIGN_URL = "/api/attachments/sign";
// Files at or below this size go up in a single PUT; larger ones are chunked
// into S3 multipart parts. 8 MiB keeps parts above S3's 5 MiB minimum.
const PART_SIZE = 8 * 1024 * 1024;

async function sign<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(SIGN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `Signer error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function putToS3(url: string, body: BodyInit): Promise<string> {
  const res = await fetch(url, {
    method: "PUT",
    body,
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  // S3 returns the part ETag; bucket CORS must expose this header.
  return res.headers.get("ETag") ?? "";
}

export function createS3AttachmentStore(): AttachmentStore {
  return {
    async upload(ciphertext, { roomId }, onProgress) {
      const total = ciphertext.byteLength;
      const blob = new Blob([ciphertext as BlobPart]);

      if (total <= PART_SIZE) {
        const { objectKey, url } = await sign<{
          objectKey: string;
          url: string;
        }>({ kind: "put", roomId });
        await putToS3(url, blob);
        onProgress?.(total, total);
        return objectKey;
      }

      const { objectKey, uploadId } = await sign<{
        objectKey: string;
        uploadId: string;
      }>({ kind: "multipart-init", roomId });

      const parts: { partNumber: number; etag: string }[] = [];
      let loaded = 0;
      let partNumber = 1;
      for (let offset = 0; offset < total; offset += PART_SIZE) {
        const chunk = blob.slice(offset, offset + PART_SIZE);
        const { url } = await sign<{ url: string }>({
          kind: "multipart-sign",
          objectKey,
          uploadId,
          partNumber,
        });
        const etag = await putToS3(url, chunk);
        parts.push({ partNumber, etag });
        loaded += chunk.size;
        onProgress?.(loaded, total);
        partNumber++;
      }

      await sign({ kind: "multipart-complete", objectKey, uploadId, parts });
      return objectKey;
    },

    async download(objectKey) {
      const { url } = await sign<{ url: string }>({ kind: "get", objectKey });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      return res.arrayBuffer();
    },

    async remove(objectKey) {
      await sign({ kind: "delete", objectKey });
    },
  };
}
