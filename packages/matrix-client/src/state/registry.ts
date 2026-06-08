"use client";

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

/**
 * Labelled view of the Matrix state graph, for devtools/inspection. pumped-fn
 * atoms are nameless, so this map is the single place that pairs each atom with
 * a readable label (kept in sync with the tracing labels in scope.ts).
 *
 *   import { matrixAtoms } from "matrix-client/state";
 *   <PumpedDevtools atoms={matrixAtoms} />
 */
export const matrixAtoms = {
  sessionAtom,
  clientAtom,
  statusAtom,
  errorAtom,
  syncStateAtom,
  lastSyncedAtAtom,
  cryptoStatusAtom,
  pendingBackupAtom,
  keyUnlockedAtom,
  readinessAtom,
} as const;
