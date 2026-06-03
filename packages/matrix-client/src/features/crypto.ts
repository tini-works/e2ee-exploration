"use client";

import {
  cacheSecurityKey,
  clearCachedSecurityKey,
  generateRecoveryKey,
  getStatus,
  hasCachedBackupDecryptionKey,
  hasSecretStorage,
  makeCryptoCallbacks,
  unlockWithSecurityKey,
} from "../core/secret-storage";
import { getDeviceVerification } from "../core/verification";
import {
  getPeerKeyShareState,
  requestKeyFromPeers,
  subscribePeerKeyShareState,
} from "../core/peer-key-share";
import { useDeviceVerification } from "../react/verification";
import { usePeerKeyShareState } from "../react/peer-key-share";

/**
 * Cross-signing, secret storage, key backup, and peer-key-share. Bundled into
 * one namespace so the host project can call `matrixCrypto.X(...)` rather than
 * pulling fragmented imports from the root + /react.
 */
export const matrixCrypto = {
  // secret storage + recovery key
  generateRecoveryKey,
  hasSecretStorage,
  hasCachedBackupDecryptionKey,
  cacheSecurityKey,
  clearCachedSecurityKey,
  unlockWithSecurityKey,
  makeCryptoCallbacks,
  getStatus,
  // device verification
  getDeviceVerification,
  useDeviceVerification,
  // peer key share (recover keys from your other devices)
  getPeerKeyShareState,
  subscribePeerKeyShareState,
  requestKeyFromPeers,
  usePeerKeyShareState,
} as const;

export type { UnlockOutcome, DeviceVerification } from "../types/crypto";
export type {
  PeerKeyShareState,
  RequestKeyArgs,
} from "../types/peer-key-share";
