"use client";

import type { MatrixClient } from "matrix-js-sdk";
import type {
  CryptoCallbacks,
  SecretStorageStatus,
} from "matrix-js-sdk/lib/crypto-api";
import type {
  AuthDict,
  UIAuthCallback,
} from "matrix-js-sdk/lib/interactive-auth";
import type { SecretStorageKeyDescriptionAesV1 } from "matrix-js-sdk/lib/secret-storage";

type MatrixError = Error & { httpStatus?: number; data?: { session?: string } };

/**
 * UIA callback for endpoints like /keys/device_signing/upload. First call
 * goes out with no auth so the server hands us a session id; we then resubmit
 * with m.login.password. Won't work on MAS-only homeservers (matrix.org)
 * since they reject password UIA — surface the server error in that case.
 */
function passwordAuthCallback(
  userId: string,
  password: string,
): UIAuthCallback<void> {
  return async (makeRequest) => {
    try {
      return await makeRequest(null);
    } catch (e) {
      const err = e as MatrixError;
      const session = err?.data?.session;
      if (err?.httpStatus !== 401 || !session) throw err;
      const auth: AuthDict = {
        type: "m.login.password",
        identifier: { type: "m.id.user", user: userId },
        password,
        session,
      };
      return await makeRequest(auth);
    }
  };
}

type CachedKey = { keyId: string; key: Uint8Array };

let cached: CachedKey | null = null;

export function makeCryptoCallbacks(): CryptoCallbacks {
  return {
    getSecretStorageKey: async ({ keys }) => {
      if (!cached) return null;
      if (cached.keyId in keys) {
        return [
          cached.keyId,
          cached.key as Uint8Array as Uint8Array<ArrayBuffer>,
        ];
      }
      return null;
    },
    cacheSecretStorageKey: (keyId, _info, key) => {
      cached = { keyId, key };
    },
  };
}

/**
 * True when the backup decryption key is already in the rust crypto store —
 * i.e. the user proved they hold the recovery key on a previous load and the
 * SDK persisted the proof. Lets us skip the recovery-key prompt on refresh
 * without weakening the AGENTS.md access gate, because sign-out wipes this
 * store along with everything else.
 */
export async function hasCachedBackupDecryptionKey(
  client: MatrixClient,
): Promise<boolean> {
  const crypto = client.getCrypto();
  if (!crypto) return false;
  try {
    const key = await crypto.getSessionBackupPrivateKey();
    return key !== null;
  } catch {
    return false;
  }
}

export function clearCachedSecurityKey(): void {
  cached = null;
}

/**
 * Whether the user's account already has secret storage set up. Used by the
 * Recovery key modal to decide between Generate and Enter.
 */
export async function hasSecretStorage(client: MatrixClient): Promise<boolean> {
  const keyId = await client.secretStorage.getDefaultKeyId();
  return !!keyId;
}

/**
 * Generate a fresh recovery key, set up SSSS, store cross-signing private
 * keys into SSSS, and create a new key backup encrypted under the same key.
 * Returns the encoded recovery key — the caller MUST display it to the user
 * because it cannot be recovered after this call returns.
 */
export async function generateRecoveryKey(
  client: MatrixClient,
  opts: { password: string },
): Promise<{ recoveryKey: string }> {
  LOG("generateRecoveryKey start");
  const crypto = client.getCrypto();
  if (!crypto) throw new Error("Crypto is not initialized on this client.");
  const userId = client.getUserId();
  if (!userId) throw new Error("Client has no userId.");

  const generated = await crypto.createRecoveryKeyFromPassphrase();
  if (!generated.encodedPrivateKey) {
    throw new Error("Failed to generate recovery key (no encoded form).");
  }

  // setupNewCrossSigning + auth callback are both required: bootstrap is a
  // no-op when keys are already published, and without authUploadDeviceSigningKeys
  // the SDK silently skips the upload, leaving SSSS holding privates whose
  // pubkeys never reached the server.
  await crypto.bootstrapCrossSigning({
    setupNewCrossSigning: true,
    authUploadDeviceSigningKeys: passwordAuthCallback(userId, opts.password),
  });
  LOG("bootstrapCrossSigning ok");

  await crypto.bootstrapSecretStorage({
    createSecretStorageKey: async () => generated,
    setupNewKeyBackup: true,
  });

  // bootstrapSecretStorage set the new key as the SSSS default. Cache it in
  // memory so subsequent SSSS operations have something to feed into the
  // getSecretStorageKey callback.
  const newKeyId = await client.secretStorage.getDefaultKeyId();
  if (newKeyId) {
    cached = { keyId: newKeyId, key: generated.privateKey };
  }
  LOG("generateRecoveryKey ok, newKeyId=", newKeyId);

  return { recoveryKey: generated.encodedPrivateKey };
}

export type UnlockOutcome = {
  crossSigningReady: boolean;
  secretStorageReady: boolean;
  keyBackupRestored: { total: number; imported: number } | null;
};

const LOG = (...args: unknown[]) => console.log("[unlock]", ...args);
const LOG_ERR = (...args: unknown[]) => console.error("[unlock]", ...args);

export async function cacheSecurityKey(
  client: MatrixClient,
  recoveryKey: string,
): Promise<{ keyId: string }> {
  LOG("cacheSecurityKey start");
  const trimmed = recoveryKey.replace(/\s+/g, "");
  const { decodeRecoveryKey } =
    await import("matrix-js-sdk/lib/crypto-api/recovery-key");

  let keyBytes: Uint8Array;
  try {
    keyBytes = decodeRecoveryKey(trimmed);
  } catch (e) {
    LOG_ERR("decodeRecoveryKey failed", e);
    throw new Error(
      `Couldn't decode the recovery key: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  const ss = client.secretStorage;
  const defaultKeyId = await ss.getDefaultKeyId();
  if (!defaultKeyId) {
    throw new Error(
      "No secret storage is set up on this account. Create one from Element first.",
    );
  }

  const keyInfoEvt = await client.getAccountDataFromServer(
    `m.secret_storage.key.${defaultKeyId}` as never,
  );
  if (!keyInfoEvt) {
    throw new Error(
      `Couldn't fetch metadata for secret storage key ${defaultKeyId}.`,
    );
  }
  const keyInfo = keyInfoEvt as unknown as SecretStorageKeyDescriptionAesV1;
  const valid = await ss.checkKey(keyBytes, keyInfo);
  if (!valid) {
    throw new Error(
      "That recovery key doesn't match your account's secret storage key.",
    );
  }

  cached = { keyId: defaultKeyId, key: keyBytes };
  LOG("cached SSSS key set, keyId=", defaultKeyId);
  return { keyId: defaultKeyId };
}

export async function unlockWithSecurityKey(
  client: MatrixClient,
  recoveryKey: string,
): Promise<UnlockOutcome> {
  LOG("unlock start");
  const crypto = client.getCrypto();
  if (!crypto) throw new Error("Crypto is not initialized on this client.");

  await cacheSecurityKey(client, recoveryKey);

  try {
    await crypto.bootstrapCrossSigning({});
    LOG("bootstrapCrossSigning ok");
  } catch (e) {
    LOG_ERR("bootstrapCrossSigning failed (non-fatal)", e);
  }

  // bootstrapCrossSigning is a no-op when cross-signing already exists on the
  // account (set up on another device), so this device's signature would never
  // get uploaded — it'd show up as "unverified" to itself and to other users.
  // Sign explicitly using the SSK we just loaded from SSSS.
  const deviceId = client.getDeviceId();
  if (deviceId) {
    try {
      await crypto.crossSignDevice(deviceId);
      LOG("crossSignDevice ok for", deviceId);
    } catch (e) {
      LOG_ERR("crossSignDevice failed (non-fatal)", e);
    }
  }

  let keyBackupRestored: UnlockOutcome["keyBackupRestored"] = null;
  const beforeBackupVersion = await crypto.getActiveSessionBackupVersion();
  LOG("active backup version (before) =", beforeBackupVersion);
  await crypto.checkKeyBackupAndEnable();
  LOG(
    "active backup version (after checkKeyBackupAndEnable) =",
    await crypto.getActiveSessionBackupVersion(),
  );
  // Pull the backup *decryption* key out of SSSS and persist it into the
  // rust crypto store. Without this, the device has an "active" backup
  // version (it can upload) but no way to read it, and the SDK's ondemand
  // downloader stays disabled — every old event then surfaces as
  // HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED. Failures here are surfaced because
  // a silent failure leaves the user thinking they're unlocked while
  // historical decryption stays broken.
  try {
    await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
    LOG("loadSessionBackupPrivateKeyFromSecretStorage ok");
  } catch (e) {
    LOG_ERR("loadSessionBackupPrivateKeyFromSecretStorage failed", e);
    throw new Error(
      `Couldn't load the backup decryption key from secret storage: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  try {
    const result = await crypto.restoreKeyBackup();
    LOG("restoreKeyBackup result", result);
    keyBackupRestored = { total: result.total, imported: result.imported };
    if (result.imported > 0) {
      // Nudge any cached encrypted events to retry decryption with the new keys.
      await Promise.all(
        client.getRooms().map((r) => r.decryptAllEvents().catch(() => {})),
      );
      LOG("decryptAllEvents triggered for", client.getRooms().length, "rooms");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/no.*backup|empty|not.*configured/i.test(msg)) {
      LOG("restoreKeyBackup soft-failed (no sessions to import):", msg);
    } else {
      LOG_ERR("restoreKeyBackup failed", e);
      throw new Error(`Couldn't restore key backup: ${msg}`);
    }
  }

  const [crossSigningReady, secretStorageReady] = await Promise.all([
    crypto.isCrossSigningReady(),
    crypto.isSecretStorageReady(),
  ]);
  LOG(
    "done",
    JSON.stringify({
      crossSigningReady,
      secretStorageReady,
      keyBackupRestored,
    }),
  );

  return { crossSigningReady, secretStorageReady, keyBackupRestored };
}

export async function getStatus(client: MatrixClient): Promise<{
  crossSigningReady: boolean;
  secretStorageReady: boolean;
  status: SecretStorageStatus | null;
  activeBackupVersion: string | null;
}> {
  const crypto = client.getCrypto();
  if (!crypto) {
    return {
      crossSigningReady: false,
      secretStorageReady: false,
      status: null,
      activeBackupVersion: null,
    };
  }
  const [crossSigningReady, secretStorageReady, status, activeBackupVersion] =
    await Promise.all([
      crypto.isCrossSigningReady(),
      crypto.isSecretStorageReady(),
      crypto.getSecretStorageStatus(),
      crypto.getActiveSessionBackupVersion(),
    ]);
  return {
    crossSigningReady,
    secretStorageReady,
    status,
    activeBackupVersion,
  };
}
