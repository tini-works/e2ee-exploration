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
