"use client";

import type { MatrixClient } from "matrix-js-sdk";
import { CryptoEvent } from "matrix-js-sdk/lib/crypto-api";

function waitForBackupDrain(
  client: MatrixClient,
  timeoutMs = 30_000,
): Promise<void> {
  return new Promise((resolve) => {
    const handler = (remaining: number) => {
      if (remaining === 0) {
        client.off(CryptoEvent.KeyBackupSessionsRemaining, handler);
        resolve();
      }
    };
    client.on(CryptoEvent.KeyBackupSessionsRemaining, handler);
    setTimeout(() => {
      client.off(CryptoEvent.KeyBackupSessionsRemaining, handler);
      resolve();
    }, timeoutMs);
  });
}

/**
 * Force any freshly-created megolm sessions to upload into the key backup and
 * wait for the queue to drain, so a sign-out (which checks pendingBackup) or a
 * reload can't strand recent message keys outside the backup.
 */
export async function ensureSessionInBackup(
  client: MatrixClient,
): Promise<void> {
  const crypto = client.getCrypto();
  if (!crypto) return;
  const activeVersion = await crypto.getActiveSessionBackupVersion();
  if (!activeVersion) return; // backup not active — nothing we can do here
  const backupManager = (crypto as unknown as {
    backupManager?: { maybeUploadKey?: () => Promise<void> };
  }).backupManager;
  await backupManager?.maybeUploadKey?.();
  await waitForBackupDrain(client);
}
