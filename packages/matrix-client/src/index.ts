/**
 * Root entry — strictly cross-cutting matrix-client surface. Feature-specific
 * code lives under namespaced subpaths so it doesn't collide with host code:
 *
 *   import { matrixPatient } from "matrix-client/patient";
 *   import { matrixMessage } from "matrix-client/message";
 *   import { matrixRooms }   from "matrix-client/rooms";
 *   import { matrixCrypto }  from "matrix-client/crypto";
 *   import { matrixReact }   from "matrix-client/react";
 */
export { createMatrixClient, loginWithPassword } from "./core/client";
export { wipeLocalMatrixData } from "./core/wipe";
export {
  DEFAULT_HOMESERVER_URL,
  DEFAULT_IDENTITY_SERVER_URL,
  DEFAULT_SESSION_STORAGE_KEY,
} from "./constants";

// Shared types — defined under ./types/*, surfaced here as a one-stop import.
export type {
  DeviceVerification,
  LoginInput,
  MatrixPatient,
  MatrixPatientRecord,
  MatrixPatientRecordRevision,
  MatrixPendingInvite,
  PeerKeyShareState,
  RequestKeyArgs,
  RoomEventExport,
  StoredSession,
  UnlockOutcome,
} from "./types";
