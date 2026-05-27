"use client";

import { clearCachedSecurityKey } from "./secret-storage";

// Anything matrix-js-sdk, the rust crypto stack, or this app writes to web
// storage falls under one of these prefixes.
const DB_PREFIXES = [
  "matrix-app:",
  "matrix-app-crypto:",
  "matrix-js-sdk:",
  "@matrix-org/",
];
const STORAGE_PREFIXES = ["mx_", "matrix-app.", "matrix-js-sdk"];

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = window.indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function sweepStorage(s: Storage): void {
  for (let i = s.length - 1; i >= 0; i--) {
    const key = s.key(i);
    if (key && STORAGE_PREFIXES.some((p) => key.startsWith(p))) {
      s.removeItem(key);
    }
  }
}

export async function wipeLocalMatrixData(): Promise<void> {
  if (typeof window === "undefined") return;

  // In-memory SSSS cache lives in module state — clear it explicitly so a
  // subsequent sign-in starts with a clean slate.
  clearCachedSecurityKey();

  sweepStorage(window.localStorage);
  try {
    sweepStorage(window.sessionStorage);
  } catch {
    /* sessionStorage may be unavailable in some contexts */
  }

  // indexedDB.databases() is unavailable in Firefox; on those browsers the DB
  // names are stable per (user, device) so re-login reuses them.
  const list = window.indexedDB.databases?.();
  if (!list) return;
  try {
    const dbs = await list;
    await Promise.all(
      dbs
        .map((d) => d.name)
        .filter((n): n is string => !!n)
        .filter((n) => DB_PREFIXES.some((p) => n.startsWith(p)))
        .map(deleteDatabase),
    );
  } catch {
    /* ignore */
  }
}
