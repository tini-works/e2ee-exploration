---
id: ref-encrypted-attachments
c3-seal: df2df143f2301e06f5cffae7907a7f2f7e5cbd540ea035fd57b1a2f9a592505a
title: encrypted-attachments
type: ref
goal: Standardize how file attachments are encrypted and where their bytes and locator live, so the homeserver and the object store both stay blind to content while attachments reuse the same per-room megolm envelope as every other patient datum.
---

## Goal

Standardize how file attachments are encrypted and where their bytes and locator live, so the homeserver and the object store both stay blind to content while attachments reuse the same per-room megolm envelope as every other patient datum.

## Choice

Attachments use the Matrix `EncryptedFile` v2 scheme unchanged: a random 256-bit AES key + 16-byte IV, AES-CTR-256 encryption in the browser via `crypto.subtle`, and a SHA-256 over the ciphertext for integrity. The ciphertext is uploaded to S3 (single presigned `PUT`, or chunked S3 multipart for large files) under a **room-scoped key** `rooms/<roomId>/<uuid>` — the `rooms/` segment is fixed in the signer and the uuid is server-issued. The decryption key, IV, ciphertext hash, and the full object key live in the `file` field of a megolm-encrypted `m.room.message` (`m.file` / `m.image`) event in the patient room. The ciphertext is uploaded as `application/octet-stream`; the real filename and mimetype live only inside the encrypted event.

## Why

- Reusing `EncryptedFile` v2 means the key rides inside the room's megolm session — shared with exactly the invited devices, identical to text and patient records (`ref-room-per-patient`). No second key-distribution path to secure.
- Storing the object key (not a presigned URL) inside the permanent event keeps the locator valid forever while presigned URLs stay short-lived; the signer mints a fresh presigned `GET` on demand.
- Uploading ciphertext as octet-stream and keeping filename/mimetype/size in the encrypted event means S3 never sees the file's content, name, or type.
- **Trade-off (accepted):** because the key is `rooms/<roomId>/<uuid>`, the signer and the object store *do* learn which room (and thus patient) an object belongs to — this is metadata, not content. It buys per-room grouping for listing and cleanup. Content, filenames, and decryption keys remain invisible to them. If room↔object correlation must also be hidden, switch the folder to a one-way hash of the roomId.
- SHA-256 over the ciphertext lets the client detect tampering or truncation before it ever attempts to decrypt, so a corrupted object surfaces as a diagnostic instead of a silent failure (AGENTS.md).

## How

Encrypt + send (in `matrix-client`, never in `web`):

```ts
// packages/matrix-client/src/features/attachment.messages.ts
const { ciphertext, file } = await encryptFile(blob);              // AES-CTR-256 + sha256
const objectKey = await store.upload(ciphertext, { roomId });      // -> rooms/<roomId>/<uuid>
await sendCustomEvent(client, roomId, EventType.RoomMessage, {
  msgtype: MsgType.File,
  body: name, filename: name,
  info: { mimetype, size },
  file: { ...file, url: objectKey },   // EncryptedFile, megolm-encrypted with the event
});
await ensureSessionInBackup(client);
```

Fetch + decrypt:

```ts
const cipher = await store.download(file.url);     // presigned GET on the room-scoped key
await verifyIntegrity(cipher, file.hashes.sha256); // throws on mismatch
const plaintext = await decryptFile(cipher, file);
```

The `AttachmentStore` (upload/download) is implemented by `web` against its signer route, which builds the `rooms/<roomId>/<uuid>` key and validates it (roomId must match the Matrix room-id grammar; uuid is server-issued) to block path traversal. `matrix-client` never knows S3 specifics. See [[ref-client-only]] for the signer's trust boundary and [[ref-room-per-patient]] for the room model.
