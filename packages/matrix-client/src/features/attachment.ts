"use client";

import {
  AttachmentIntegrityError,
  decryptFile,
  encryptFile,
  fetchDecryptedFile,
  readFileMessage,
  sendFileMessage,
  verifyIntegrity,
} from "./attachment.messages";

/**
 * Encrypted file attachments for matrix-client. Single namespace object so the
 * host project's own attachment code doesn't collide with these names.
 *
 * Crypto (AES-CTR-256 + sha256) and event send/parse live here; the actual S3
 * upload/download is injected as an `AttachmentStore` by the host app, keeping
 * the package free of storage specifics. @see ref-encrypted-attachments
 */
export const matrixAttachment = {
  send: sendFileMessage,
  fetchDecrypted: fetchDecryptedFile,
  read: readFileMessage,
  encryptFile,
  decryptFile,
  verifyIntegrity,
  IntegrityError: AttachmentIntegrityError,
} as const;

export type {
  AttachmentInfo,
  AttachmentJWK,
  AttachmentStore,
  EncryptedFile,
} from "../types/attachment";
