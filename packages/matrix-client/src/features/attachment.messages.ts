"use client";

import { EventType, MsgType, type MatrixClient } from "matrix-js-sdk";
import { ensureSessionInBackup } from "../core/backup";
import { sendCustomEvent } from "../core/rooms";
import type {
  AttachmentInfo,
  AttachmentStore,
  EncryptedFile,
} from "../types/attachment";

/**
 * Encrypted-attachment scheme (Matrix `EncryptedFile` v2): AES-CTR-256 in the
 * browser via WebCrypto, SHA-256 over the ciphertext for integrity. The key
 * lives only inside the returned EncryptedFile, which the caller embeds in a
 * megolm-encrypted event — so neither the homeserver nor S3 ever sees it.
 *
 * @see ref-encrypted-attachments
 */

/** Thrown when downloaded ciphertext doesn't match the hash stored in the event. */
export class AttachmentIntegrityError extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(
      `Attachment integrity check failed: sha256 mismatch (expected ${expected}, got ${actual})`,
    );
    this.name = "AttachmentIntegrityError";
  }
}

// --- base64 helpers (unpadded standard base64, per the Matrix attachment spec) ---

function toUnpaddedBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/=+$/, "");
}

function fromUnpaddedBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Encrypt a blob with a fresh AES-CTR-256 key and a 16-byte IV (8 random
 * nonce bytes + a 64-bit counter starting at 0, exactly as the spec mandates).
 * Returns the ciphertext and the `EncryptedFile` minus its `url`, which the
 * caller fills in with the storage object id after upload.
 */
export async function encryptFile(
  data: Blob,
): Promise<{ ciphertext: Uint8Array; file: Omit<EncryptedFile, "url"> }> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = new Uint8Array(16);
  crypto.getRandomValues(iv.subarray(0, 8)); // high 8 = nonce, low 8 = counter (0)

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CTR" },
    true,
    ["encrypt"],
  );
  const plaintext = await data.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CTR", counter: iv, length: 64 },
    key,
    plaintext,
  );
  const ciphertext = new Uint8Array(encrypted);
  const digest = await crypto.subtle.digest("SHA-256", encrypted);
  const jwk = await crypto.subtle.exportKey("jwk", key);

  return {
    ciphertext,
    file: {
      v: "v2",
      key: {
        alg: "A256CTR",
        ext: true,
        k: jwk.k as string,
        key_ops: ["encrypt", "decrypt"],
        kty: "oct",
      },
      iv: toUnpaddedBase64(iv),
      hashes: { sha256: toUnpaddedBase64(digest) },
    },
  };
}

/**
 * Verify ciphertext integrity against the event's stored hash. Throws
 * {@link AttachmentIntegrityError} on mismatch — call this BEFORE decrypting so
 * tampering/truncation surfaces as a clear diagnostic, never a corrupt file.
 */
export async function verifyIntegrity(
  ciphertext: ArrayBuffer,
  expectedSha256: string,
): Promise<void> {
  const digest = await crypto.subtle.digest("SHA-256", ciphertext);
  const actual = toUnpaddedBase64(digest);
  if (actual !== expectedSha256) {
    throw new AttachmentIntegrityError(expectedSha256, actual);
  }
}

/** Decrypt ciphertext with the key/iv carried in the EncryptedFile. */
export async function decryptFile(
  ciphertext: ArrayBuffer,
  file: EncryptedFile,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "oct",
      k: file.key.k,
      alg: "A256CTR",
      ext: true,
      key_ops: ["encrypt", "decrypt"],
    },
    { name: "AES-CTR" },
    false,
    ["decrypt"],
  );
  return crypto.subtle.decrypt(
    { name: "AES-CTR", counter: fromUnpaddedBase64(file.iv), length: 64 },
    key,
    ciphertext,
  );
}

/**
 * Encrypt a file, upload its ciphertext via the host-provided store, and send
 * the resulting `m.file` / `m.image` event into the room. The filename and
 * mimetype live only inside the (megolm-encrypted) event; the store sees only
 * opaque ciphertext.
 */
export async function sendFileMessage(
  client: MatrixClient,
  roomId: string,
  data: File,
  store: AttachmentStore,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const { ciphertext, file } = await encryptFile(data);
  const objectKey = await store.upload(ciphertext, { roomId }, onProgress);

  const mimetype = data.type || "application/octet-stream";
  const msgtype = mimetype.startsWith("image/") ? MsgType.Image : MsgType.File;
  const encryptedFile: EncryptedFile = { ...file, url: objectKey };
  await sendCustomEvent(client, roomId, EventType.RoomMessage, {
    msgtype,
    body: data.name,
    filename: data.name,
    info: { mimetype, size: data.size },
    file: encryptedFile,
  });
  await ensureSessionInBackup(client);
}

/** Download, verify, and decrypt an attachment referenced by an event's `file`. */
export async function fetchDecryptedFile(
  file: EncryptedFile,
  store: AttachmentStore,
): Promise<ArrayBuffer> {
  const ciphertext = await store.download(file.url);
  await verifyIntegrity(ciphertext, file.hashes.sha256);
  return decryptFile(ciphertext, file);
}

type FileMessageContent = {
  msgtype?: string;
  body?: string;
  filename?: string;
  info?: AttachmentInfo & { mimetype?: string; size?: number };
  file?: EncryptedFile;
};

/**
 * Extract attachment metadata from a decrypted event's content, or null if it
 * isn't an encrypted file/image message. Lets the UI render attachments
 * without touching SDK types directly (rule-no-direct-sdk-import).
 */
export function readFileMessage(content: unknown): {
  file: EncryptedFile;
  info: AttachmentInfo;
} | null {
  const c = content as FileMessageContent;
  if (c?.msgtype !== MsgType.File && c?.msgtype !== MsgType.Image) return null;
  if (!c.file?.url || !c.file?.hashes?.sha256) return null;
  return {
    file: c.file,
    info: {
      name: c.filename ?? c.body ?? "attachment",
      mimetype: c.info?.mimetype ?? "application/octet-stream",
      size: c.info?.size ?? 0,
    },
  };
}
