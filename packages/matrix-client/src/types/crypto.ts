export type UnlockOutcome = {
  crossSigningReady: boolean;
  secretStorageReady: boolean;
  keyBackupRestored: { total: number; imported: number } | null;
};

export type DeviceVerification = {
  /** This device is signed by the account's self-signing key. */
  deviceVerified: boolean;
  /** The account's master key is trusted (cross-signing reachable). */
  userVerified: boolean;
};
