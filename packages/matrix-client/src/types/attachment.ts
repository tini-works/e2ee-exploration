/**
 * Attachment types for the matrix-client package.
 *
 * We deliberately re-declare the Matrix `EncryptedFile` v2 shape here (instead
 * of re-exporting matrix-js-sdk's type) so `web/` can import it from
 * `matrix-client` and stay free of any direct SDK dependency
 * (rule-no-direct-sdk-import). The shape is the stable spec wire format:
 * https://spec.matrix.org/v1.11/client-server-api/#sending-encrypted-attachments
 */

/** JSON Web Key carrying the raw AES-CTR-256 attachment key (base64url in `k`). */
export interface AttachmentJWK {
  alg: "A256CTR";
  ext: true;
  k: string;
  key_ops: string[];
  kty: "oct";
}

/**
 * The `file` field of an `m.file` / `m.image` message. Lives *inside* the
 * megolm-encrypted event, so the key/iv/hashes never reach the homeserver or S3.
 * `url` holds our stable opaque S3 object id (NOT a presigned URL).
 */
export interface EncryptedFile {
  v: "v2";
  key: AttachmentJWK;
  iv: string;
  hashes: { sha256: string };
  url: string;
}

/** Plaintext metadata about an attachment, mirrored into the encrypted event. */
export interface AttachmentInfo {
  /** Original filename, shown to recipients. */
  name: string;
  /** Real mimetype (S3 only ever sees application/octet-stream). */
  mimetype: string;
  /** Plaintext byte size. */
  size: number;
}

/** Context the store needs to place an object (e.g. derive its key). */
export interface AttachmentUploadContext {
  /** The room the attachment is being posted to; used to namespace the S3 key. */
  roomId: string;
}

/**
 * Storage backend for attachment ciphertext. Implemented by the host app
 * (web) against its signer route; matrix-client stays ignorant of S3.
 * The implementation only ever sees ciphertext, the room id, and object keys.
 */
export interface AttachmentStore {
  /**
   * Upload ciphertext, return the stable object key to persist in the event
   * (e.g. `rooms/<roomId>/<uuid>`). The returned key is opaque to callers.
   */
  upload(
    ciphertext: Uint8Array,
    context: AttachmentUploadContext,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<string>;
  /** Resolve an object key back to its ciphertext bytes. */
  download(objectKey: string): Promise<ArrayBuffer>;
  /** Permanently delete the stored ciphertext (called when a message is redacted). */
  remove(objectKey: string): Promise<void>;
}
