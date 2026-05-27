"use client";

import { atom, controller, type Lite } from "@pumped-fn/lite";
import type { MatrixClient } from "matrix-js-sdk";
import { DEFAULT_SESSION_STORAGE_KEY, type StoredSession } from "../types";

/**
 * The Matrix client state graph, on pumped-fn.
 *
 * matrix-js-sdk remains the source of truth: the long-lived MatrixClient owns
 * its own event emitters. These atoms are a reactive *projection* of that — the
 * imperative actions layer (./actions) creates/tears down the client and pushes
 * SDK events into the writable atoms below via their controllers. Components
 * read them through useMatrix() (../react/provider).
 */

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

export function loadSession(
  storageKey: string = DEFAULT_SESSION_STORAGE_KEY,
): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

// --- writable state atoms (mutated by ../actions via controllers) --------
export const sessionAtom = atom<StoredSession | null>({
  factory: () => loadSession(),
});
export const clientAtom = atom<MatrixClient | null>({ factory: () => null });
export const statusAtom = atom<Status>({ factory: () => "initializing" });
export const errorAtom = atom<string | null>({ factory: () => null });
export const syncStateAtom = atom<string | null>({ factory: () => null });
export const lastSyncedAtAtom = atom<number | null>({ factory: () => null });
export const cryptoStatusAtom = atom<CryptoStatus | null>({
  factory: () => null,
});
export const pendingBackupAtom = atom<number>({ factory: () => 0 });
/** True once the user has entered a valid recovery key in this session. */
export const keyUnlockedAtom = atom<boolean>({ factory: () => false });

/**
 * Every writable atom, so the actions layer can resolve + grab controllers in
 * one place and the provider can prime them before first paint.
 */
export const writableAtoms: Lite.Atom<unknown>[] = [
  sessionAtom,
  clientAtom,
  statusAtom,
  errorAtom,
  syncStateAtom,
  lastSyncedAtAtom,
  cryptoStatusAtom,
  pendingBackupAtom,
  keyUnlockedAtom,
];

// --- derived readiness gate (replaces the old useMemo) -------------------
// Preserves the AGENTS.md rule: not ready until a valid recovery key is entered.
export const readinessAtom = atom({
  deps: {
    status: controller(statusAtom, { resolve: true, watch: true }),
    client: controller(clientAtom, { resolve: true, watch: true }),
    sync: controller(syncStateAtom, { resolve: true, watch: true }),
    keyUnlocked: controller(keyUnlockedAtom, { resolve: true, watch: true }),
  },
  factory: (_ctx, d): Readiness => {
    const status = d.status.get();
    const client = d.client.get();
    const syncState = d.sync.get();
    const keyUnlocked = d.keyUnlocked.get();

    if (status !== "ready" || !client) {
      return { ready: false, notReadyReason: { kind: "not_signed_in" } };
    }
    if (syncState !== "PREPARED" && syncState !== "SYNCING") {
      let reason: NotReadyReason;
      if (syncState === "RECONNECTING") reason = { kind: "reconnecting" };
      else if (syncState === "CATCHUP") reason = { kind: "catchup" };
      else if (syncState === "ERROR") reason = { kind: "sync_error" };
      else reason = { kind: "syncing", syncState };
      return { ready: false, notReadyReason: reason };
    }
    if (!keyUnlocked) {
      return { ready: false, notReadyReason: { kind: "needs_recovery_key" } };
    }
    return { ready: true, notReadyReason: null };
  },
});
