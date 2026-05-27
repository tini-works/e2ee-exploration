export { createMatrixClient, loginWithPassword } from "./core/client";
export {
  cacheSecurityKey,
  clearCachedSecurityKey,
  generateRecoveryKey,
  getStatus,
  hasCachedBackupDecryptionKey,
  hasSecretStorage,
  makeCryptoCallbacks,
  unlockWithSecurityKey,
} from "./core/secret-storage";
export { getDeviceVerification } from "./core/verification";
export {
  getPeerKeyShareState,
  requestKeyFromPeers,
  subscribePeerKeyShareState,
} from "./core/peer-key-share";
export { wipeLocalMatrixData } from "./core/wipe";
export {
  DEFAULT_HOMESERVER_URL,
  DEFAULT_IDENTITY_SERVER_URL,
  DEFAULT_SESSION_STORAGE_KEY,
} from "./constants";

// Shared types — defined under ./types/*, surfaced here for consumers.
export type {
  DeviceVerification,
  LoginInput,
  PeerKeyShareState,
  RequestKeyArgs,
  RoomEventExport,
  StoredSession,
  UnlockOutcome,
} from "./types";
