"use client";

import { createScope, type Lite } from "@pumped-fn/lite";
import {
  clientAtom,
  cryptoStatusAtom,
  errorAtom,
  keyUnlockedAtom,
  lastSyncedAtAtom,
  pendingBackupAtom,
  readinessAtom,
  sessionAtom,
  statusAtom,
  syncStateAtom,
} from "./atoms";
import { tracingEnabled, tracingExtension } from "./tracing";

/**
 * One process-global scope for the Matrix state graph. A singleton (rather than
 * a per-render scope) keeps the long-lived client alive across React StrictMode
 * remounts and Next route navigations — the same reason peer-key-share uses a
 * globalThis store. ScopeProvider and the actions layer both read this one.
 */
const STORE_KEY = "__matrix_client_scope__";

// Atoms carry no name; map each to a readable label for the tracing extension.
const ATOM_LABELS = new Map<unknown, string>([
  [sessionAtom, "sessionAtom"],
  [clientAtom, "clientAtom"],
  [statusAtom, "statusAtom"],
  [errorAtom, "errorAtom"],
  [syncStateAtom, "syncStateAtom"],
  [lastSyncedAtAtom, "lastSyncedAtAtom"],
  [cryptoStatusAtom, "cryptoStatusAtom"],
  [pendingBackupAtom, "pendingBackupAtom"],
  [keyUnlockedAtom, "keyUnlockedAtom"],
  [readinessAtom, "readinessAtom"],
]);

function labelFor(target: unknown): string {
  const known = ATOM_LABELS.get(target);
  if (known) return known;
  const name = (target as { name?: string } | null)?.name;
  return name ? `resource:${name}` : "(anonymous)";
}

export function getMatrixScope(): Lite.Scope {
  const g = globalThis as unknown as Record<string, Lite.Scope | undefined>;
  let scope = g[STORE_KEY];
  if (!scope) {
    scope = createScope({
      extensions: tracingEnabled() ? [tracingExtension(labelFor)] : [],
    });
    g[STORE_KEY] = scope;
  }
  return scope;
}
