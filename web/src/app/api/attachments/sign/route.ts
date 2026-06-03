import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * Presigned-URL broker for encrypted attachments.
 *
 * Object keys are room-scoped: `rooms/<roomId>/<uuid>`. The uuid is always
 * server-issued; the roomId is validated to the Matrix room-id grammar so it
 * can't smuggle path traversal. NOTE: because keys embed the roomId, this
 * broker — and the object store — can map an object to its room (and thus
 * patient). It still never sees plaintext, filenames, mimetypes, or keys; all
 * attachment crypto happens in the browser. @see ref-encrypted-attachments
 *
 * Required env: S3_BUCKET, AWS credentials (standard AWS_* env or instance role).
 * Optional env: S3_REGION (default us-east-1), S3_ENDPOINT (S3-compatible
 *   stores, enables path-style), PRESIGN_TTL_SECONDS (300).
 *
 * The bucket must keep CORS allowing PUT/GET from the app origin and exposing
 * the ETag response header (needed to complete multipart uploads).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Matrix room id: `!<opaque>:<domain>`, no whitespace or slashes.
const roomId = z.string().regex(/^![^\s/]+:[^\s/]+$/, "invalid room id");
// Full object key the server previously issued: `rooms/<roomId>/<uuid>`.
const objectKey = z
  .string()
  .regex(
    /^rooms\/![^\s/]+:[^\s/]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "invalid object key",
  )
  .refine((k) => !k.includes(".."), "invalid object key");

const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("put"), roomId }),
  z.object({ kind: z.literal("get"), objectKey }),
  z.object({ kind: z.literal("delete"), objectKey }),
  z.object({ kind: z.literal("multipart-init"), roomId }),
  z.object({
    kind: z.literal("multipart-sign"),
    objectKey,
    uploadId: z.string().min(1),
    partNumber: z.number().int().min(1).max(10_000),
  }),
  z.object({
    kind: z.literal("multipart-complete"),
    objectKey,
    uploadId: z.string().min(1),
    parts: z
      .array(
        z.object({
          partNumber: z.number().int().min(1).max(10_000),
          etag: z.string().min(1),
        }),
      )
      .min(1),
  }),
]);

function config() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is not configured");
  const endpoint = process.env.S3_ENDPOINT;
  const client = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });
  return { client, bucket, ttl: Number(process.env.PRESIGN_TTL_SECONDS ?? 300) };
}

// Room-scoped key. roomId is regex-validated above; uuid is server-issued.
const keyFor = (room: string) => `rooms/${room}/${randomUUID()}`;
// Ciphertext only — S3 never learns the real mimetype.
const CONTENT_TYPE = "application/octet-stream";

export async function POST(request: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  let cfg: ReturnType<typeof config>;
  try {
    cfg = config();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Storage not configured" },
      { status: 503 },
    );
  }
  const { client, bucket, ttl } = cfg;

  try {
    switch (parsed.kind) {
      case "put": {
        const key = keyFor(parsed.roomId);
        const url = await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: CONTENT_TYPE,
          }),
          { expiresIn: ttl },
        );
        return Response.json({ objectKey: key, url });
      }
      case "get": {
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: bucket, Key: parsed.objectKey }),
          { expiresIn: ttl },
        );
        return Response.json({ url });
      }
      case "delete": {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: parsed.objectKey }),
        );
        return Response.json({ ok: true });
      }
      case "multipart-init": {
        const key = keyFor(parsed.roomId);
        const res = await client.send(
          new CreateMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
            ContentType: CONTENT_TYPE,
          }),
        );
        return Response.json({ objectKey: key, uploadId: res.UploadId });
      }
      case "multipart-sign": {
        const url = await getSignedUrl(
          client,
          new UploadPartCommand({
            Bucket: bucket,
            Key: parsed.objectKey,
            UploadId: parsed.uploadId,
            PartNumber: parsed.partNumber,
          }),
          { expiresIn: ttl },
        );
        return Response.json({ url });
      }
      case "multipart-complete": {
        await client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: parsed.objectKey,
            UploadId: parsed.uploadId,
            MultipartUpload: {
              Parts: parsed.parts
                .sort((a, b) => a.partNumber - b.partNumber)
                .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
            },
          }),
        );
        return Response.json({ ok: true });
      }
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Signing failed" },
      { status: 502 },
    );
  }
}
