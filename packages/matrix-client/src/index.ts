export {
  createMatrixClient,
  loginWithPassword,
  type LoginInput,
} from "./client";
export {
  cacheSecurityKey,
  clearCachedSecurityKey,
  generateRecoveryKey,
  getStatus,
  hasCachedBackupDecryptionKey,
  hasSecretStorage,
  makeCryptoCallbacks,
  unlockWithSecurityKey,
  type UnlockOutcome,
} from "./secret-storage";
export { getDeviceVerification, type DeviceVerification } from "./verification";
export {
  getPeerKeyShareState,
  requestKeyFromPeers,
  subscribePeerKeyShareState,
  type PeerKeyShareState,
  type RequestKeyArgs,
} from "./peer-key-share";
export { wipeLocalMatrixData } from "./wipe";
export {
  DEFAULT_HOMESERVER_URL,
  DEFAULT_IDENTITY_SERVER_URL,
  DEFAULT_SESSION_STORAGE_KEY,
  type StoredSession,
} from "./types";
