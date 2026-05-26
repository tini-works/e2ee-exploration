"use client";

import type { MatrixClient } from "matrix-js-sdk";
import type { StoredSession } from "./types";
import { makeCryptoCallbacks } from "./secret-storage";
import { startPeerKeyShare } from "./peer-key-share";

export type LoginInput = {
  baseUrl: string;
  identityServerUrl?: string;
  username: string;
  password: string;
};

function deviceDisplayName(): string {
  if (typeof navigator === "undefined") return "Matrix App";
  const ua = navigator.userAgent;
  const browser = /Firefox/.test(ua)
    ? "Firefox"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Chrome/.test(ua)
        ? "Chrome"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  return `Matrix App (${browser})`;
}

export async function loginWithPassword(
  input: LoginInput,
): Promise<StoredSession> {
  const sdk = await import("matrix-js-sdk");
  const tmp = sdk.createClient({ baseUrl: input.baseUrl });
  const res = await tmp.loginRequest({
    type: "m.login.password",
    identifier: { type: "m.id.user", user: input.username },
    password: input.password,
    initial_device_display_name: deviceDisplayName(),
  });
  return {
    baseUrl: input.baseUrl,
    identityServerUrl: input.identityServerUrl,
    accessToken: res.access_token,
    userId: res.user_id,
    deviceId: res.device_id,
  };
}

async function waitForPrepared(client: MatrixClient): Promise<void> {
  const sdk = await import("matrix-js-sdk");
  const { ClientEvent, SyncState } = sdk;
  if (client.getSyncState() === SyncState.Prepared) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(ClientEvent.Sync, handler);
      reject(
        new Error(
          "Timed out waiting for first sync. Check network, then refresh.",
        ),
      );
    }, 30_000);
    const handler = (state: string) => {
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        clearTimeout(timer);
        client.off(ClientEvent.Sync, handler);
        resolve();
      }
    };
    client.on(ClientEvent.Sync, handler);
  });
}

export async function createMatrixClient(
  session: StoredSession,
): Promise<MatrixClient> {
  const sdk = await import("matrix-js-sdk");
  const { createClient, IndexedDBStore, IndexedDBCryptoStore } = sdk;

  const storeKey = `${session.userId}:${session.deviceId}`;
  const store = new IndexedDBStore({
    indexedDB: window.indexedDB,
    dbName: `matrix-app:${storeKey}`,
    localStorage: window.localStorage,
  });
  await store.startup();

  const cryptoStore = new IndexedDBCryptoStore(
    window.indexedDB,
    `matrix-app-crypto:${storeKey}`,
  );

  const client = createClient({
    baseUrl: session.baseUrl,
    idBaseUrl: session.identityServerUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
    store,
    cryptoStore,
    cryptoCallbacks: makeCryptoCallbacks(),
    timelineSupport: true,
  });

  await client.initRustCrypto();
  await client.startClient({ initialSyncLimit: 20 });
  await waitForPrepared(client);
  startPeerKeyShare(client);
  const crypto = client.getCrypto();
  if (crypto) {
    try {
      await crypto.checkKeyBackupAndEnable();
    } catch {
      /* non-fatal */
    }
    try {
      await crypto.restoreKeyBackup();
    } catch {
      // No cached backup key yet — user will be asked for the recovery key
      // via the encryption banner.
    }
  }
  return client;
}
