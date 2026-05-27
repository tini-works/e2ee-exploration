export type Status = "initializing" | "idle" | "connecting" | "ready" | "error";

export type CryptoStatus = {
  crossSigningReady: boolean;
  secretStorageReady: boolean;
  backupVersion: string | null;
};

export type NotReadyReason =
  | { kind: "not_signed_in" }
  | { kind: "syncing"; syncState: string | null }
  | { kind: "reconnecting" }
  | { kind: "catchup" }
  | { kind: "sync_error" }
  | { kind: "needs_recovery_key" };

export type Readiness = {
  ready: boolean;
  notReadyReason: NotReadyReason | null;
};
