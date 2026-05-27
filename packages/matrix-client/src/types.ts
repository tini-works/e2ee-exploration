/**
 * Public type barrel. All shared types are defined under ./types/* (one file
 * per domain) and re-exported here so web can import them from a single place
 * (this file, or via the main "matrix-client" entry which re-exports it).
 *
 * Internal modules import the specific definition file (e.g. "../types/patient")
 * — never the bare "../types" specifier, which would collide with this file.
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
  Patient,
  PatientRecord,
  PatientRecordRevision,
  PendingInvite,
} from "./types/patient";
