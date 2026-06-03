/**
 * Internal type barrel. All shared types are defined under ./types/* (one file
 * per domain) and re-exported here so internal modules and the root entry can
 * pull them from a single place.
 *
 * Note: there's no `matrix-client/types` subpath — consumers should import each
 * type from the feature subpath that owns it (e.g. MatrixPatient from
 * "matrix-client/patient") or from the root entry.
 */
export type { LoginInput } from "./types/auth";
export type { UnlockOutcome, DeviceVerification } from "./types/crypto";
export type { PeerKeyShareState, RequestKeyArgs } from "./types/peer-key-share";
export type {
  MatrixContextValue,
  MatrixProviderProps,
} from "./types/react";
export type { RoomEventExport } from "./types/rooms";
export type { StoredSession } from "./types/session";
export type {
  CryptoStatus,
  NotReadyReason,
  Readiness,
  Status,
} from "./types/state";
export type {
  MatrixPatient,
  MatrixPatientRecord,
  MatrixPatientRecordRevision,
  MatrixPendingInvite,
} from "./types/patient";
