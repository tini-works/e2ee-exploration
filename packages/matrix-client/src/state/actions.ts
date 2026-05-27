"use client";

import type { MatrixClient } from "matrix-js-sdk";
import {
  createMatrixClient,
  loginWithPassword,
  type LoginInput,
} from "../client";
import {
  cacheSecurityKey,
  getStatus,
  hasCachedBackupDecryptionKey,
} from "../secret-storage";
import { DEFAULT_SESSION_STORAGE_KEY, type StoredSession } from "../types";
import { wipeLocalMatrixData } from "../wipe";
import { getMatrixScope } from "./scope";
import {
  clientAtom,
  cryptoStatusAtom,
  errorAtom,
  keyUnlockedAtom,
  lastSyncedAtAtom,
  loadSession,
  pendingBackupAtom,
  readinessAtom,
  sessionAtom,
  statusAtom,
  syncStateAtom,
  writableAtoms,
} from "./atoms";

/**
 * Imperative lifecycle for the Matrix client, writing into the pumped state
 * atoms (./atoms) via their controllers. The client's life is driven by explicit
 * login/logout rather than GC, so this stays imperative — but all state lands in
 * the scope, where useMatrix() reads it reactively.
 */

const scope = getMatrixScope();

let sessionStorageKey = DEFAULT_SESSION_STORAGE_KEY;
let detach: (() => void) | null = null;
let cleanup: Promise<void> | null = null;
let bootstrapped = false;

export function configureSessionStorageKey(key: string) {
  sessionStorageKey = key;
}

// --- controller access (resolve once, then reuse) ------------------------
type Ctrls = Awaited<ReturnType<typeof buildCtrls>>;
let primed: Promise<Ctrls> | null = null;
let CTRLS: Ctrls | null = null;

async function buildCtrls() {
  await Promise.all(writableAtoms.map((a) => scope.resolve(a)));
  await scope.resolve(readinessAtom);
  return {
    session: scope.controller(sessionAtom),
    client: scope.controller(clientAtom),
    status: scope.controller(statusAtom),
    error: scope.controller(errorAtom),
    sync: scope.controller(syncStateAtom),
    lastSynced: scope.controller(lastSyncedAtAtom),
    crypto: scope.controller(cryptoStatusAtom),
    pendingBackup: scope.controller(pendingBackupAtom),
    keyUnlocked: scope.controller(keyUnlockedAtom),
  };
}

/** Resolve every state atom + grab controllers. Idempotent; the provider awaits
 * this before first paint so reads never suspend and sync actions are safe. */
export async function primeMatrixState(): Promise<void> {
  if (!primed) primed = buildCtrls();
  CTRLS = await primed;
}

async function getCtrls(): Promise<Ctrls> {
  if (!primed) primed = buildCtrls();
  CTRLS = await primed;
  return CTRLS;
}

// --- listeners: SDK events -> atoms --------------------------------------
async function refreshCryptoStatus(c: MatrixClient, ctrls: Ctrls) {
  try {
    const s = await getStatus(c);
    ctrls.crypto.set({
      crossSigningReady: s.crossSigningReady,
      secretStorageReady: s.secretStorageReady,
      backupVersion: s.activeBackupVersion,
    });
  } catch {
    /* ignore */
  }
}

function resetState(ctrls: Ctrls) {
  ctrls.client.set(null);
  ctrls.session.set(null);
  ctrls.sync.set(null);
  ctrls.lastSynced.set(null);
  ctrls.crypto.set(null);
  ctrls.pendingBackup.set(0);
  ctrls.keyUnlocked.set(false);
  ctrls.status.set("idle");
}

async function attachListeners(
  c: MatrixClient,
  ctrls: Ctrls,
): Promise<() => void> {
  const sdk = await import("matrix-js-sdk");
  const { ClientEvent, HttpApiEvent } = sdk;
  const { CryptoEvent } = await import("matrix-js-sdk/lib/crypto-api");

  const onSync = (state: string) => {
    ctrls.sync.set(state);
    if (state === "SYNCING" || state === "PREPARED") {
      ctrls.lastSynced.set(Date.now());
    }
  };
  const onCrypto = () => {
    void refreshCryptoStatus(c, ctrls);
  };
  const onRemaining = (remaining: number) => {
    ctrls.pendingBackup.set(remaining);
  };
  const onLoggedOut = () => {
    window.localStorage.removeItem(sessionStorageKey);
    resetState(ctrls);
  };

  c.on(ClientEvent.Sync, onSync);
  c.on(CryptoEvent.KeysChanged, onCrypto);
  c.on(CryptoEvent.KeyBackupStatus, onCrypto);
  c.on(CryptoEvent.KeyBackupDecryptionKeyCached, onCrypto);
  c.on(CryptoEvent.DevicesUpdated, onCrypto);
  c.on(CryptoEvent.KeyBackupSessionsRemaining, onRemaining);
  c.on(HttpApiEvent.SessionLoggedOut, onLoggedOut);

  return () => {
    c.off(ClientEvent.Sync, onSync);
    c.off(CryptoEvent.KeysChanged, onCrypto);
    c.off(CryptoEvent.KeyBackupStatus, onCrypto);
    c.off(CryptoEvent.KeyBackupDecryptionKeyCached, onCrypto);
    c.off(CryptoEvent.DevicesUpdated, onCrypto);
    c.off(CryptoEvent.KeyBackupSessionsRemaining, onRemaining);
    c.off(HttpApiEvent.SessionLoggedOut, onLoggedOut);
  };
}

// --- lifecycle ------------------------------------------------------------
async function start(s: StoredSession): Promise<MatrixClient | null> {
  const ctrls = await getCtrls();
  ctrls.status.set("connecting");
  ctrls.error.set(null);
  try {
    if (cleanup) {
      await cleanup;
      cleanup = null;
    }
    const c = await createMatrixClient(s);
    detach = await attachListeners(c, ctrls);
    ctrls.client.set(c);
    ctrls.session.set(s);
    ctrls.sync.set(c.getSyncState() ?? null);
    ctrls.lastSynced.set(Date.now());
    await refreshCryptoStatus(c, ctrls);
    if (await hasCachedBackupDecryptionKey(c)) {
      ctrls.keyUnlocked.set(true);
    }
    ctrls.status.set("ready");
    return c;
  } catch (e) {
    ctrls.error.set(e instanceof Error ? e.message : String(e));
    ctrls.status.set("error");
    return null;
  }
}

/** Load any persisted session and connect. Runs once. */
export async function bootstrapMatrix(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  const ctrls = await getCtrls();
  const existing = loadSession(sessionStorageKey);
  if (existing) {
    await start(existing);
  } else {
    ctrls.status.set("idle");
  }
}

export async function signIn(input: LoginInput): Promise<void> {
  const s = await loginWithPassword(input);
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(s));
  const c = await start(s);
  if (!c) {
    throw new Error("Signed in but the client failed to start. Try refreshing.");
  }
}

async function teardownClient(c: MatrixClient | null, ctrls: Ctrls) {
  if (detach) {
    detach();
    detach = null;
  }
  window.localStorage.removeItem(sessionStorageKey);
  resetState(ctrls);

  if (!c) {
    await wipeLocalMatrixData();
    return;
  }
  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
  cleanup = (async () => {
    try {
      await withTimeout(c.logout(true), 3000);
    } catch {
      /* ignore — token may already be invalid */
    }
    try {
      c.stopClient();
    } catch {
      /* ignore */
    }
    try {
      await withTimeout(c.clearStores(), 5000);
    } catch {
      /* ignore */
    }
    try {
      await wipeLocalMatrixData();
    } catch {
      /* ignore */
    }
  })();
}

export async function signOut(): Promise<void> {
  const ctrls = await getCtrls();
  const pending = ctrls.pendingBackup.get();
  if (pending > 0) {
    throw new Error(
      `Hold on — ${pending} message key${pending === 1 ? "" : "s"} still uploading to backup. Wait a moment, otherwise you'll lose access to recent messages.`,
    );
  }
  await teardownClient(ctrls.client.get(), ctrls);
}

export async function resetBackup(securityKey: string): Promise<void> {
  const ctrls = await getCtrls();
  const client = ctrls.client.get();
  if (!client) throw new Error("Not signed in.");
  const crypto = client.getCrypto();
  if (!crypto) throw new Error("Crypto is not initialized.");
  await cacheSecurityKey(client, securityKey);
  await crypto.resetKeyBackup();
  try {
    await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
  } catch {
    /* fresh backup means there's nothing to load yet — non-fatal */
  }
  await refreshCryptoStatus(client, ctrls);
  await Promise.all(
    client.getRooms().map((r) => r.decryptAllEvents().catch(() => {})),
  );
  ctrls.keyUnlocked.set(true);
}

/** Sync (UI calls it directly) — safe because the provider primes first. */
export function markKeyUnlocked(): void {
  CTRLS?.keyUnlocked.set(true);
}
