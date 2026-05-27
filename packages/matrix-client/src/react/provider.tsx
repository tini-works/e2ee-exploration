"use client";

import { Suspense, useEffect, useState } from "react";
import {
  ExecutionContextProvider,
  ScopeProvider,
  useAtom,
} from "@pumped-fn/lite-react";
import { DEFAULT_SESSION_STORAGE_KEY } from "../constants";
import { getMatrixScope } from "../state/scope";
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
} from "../state/atoms";
import {
  bootstrapMatrix,
  configureSessionStorageKey,
  markKeyUnlocked,
  primeMatrixState,
  resetBackup,
  signIn,
  signOut,
} from "../state/actions";
import type {
  MatrixContextValue,
  MatrixProviderProps,
} from "../types/react";
import type { CryptoStatus, NotReadyReason, Status } from "../types/state";

export type {
  CryptoStatus,
  MatrixContextValue,
  MatrixProviderProps,
  NotReadyReason,
  Status,
};

export function MatrixProvider({
  children,
  sessionStorageKey = DEFAULT_SESSION_STORAGE_KEY,
}: MatrixProviderProps) {
  // Prime the scope (resolve atoms + controllers) before mounting children, so
  // useMatrix() reads never suspend; then kick off the session bootstrap.
  const [primed, setPrimed] = useState(false);

  useEffect(() => {
    let active = true;
    configureSessionStorageKey(sessionStorageKey);
    void (async () => {
      await primeMatrixState();
      if (active) setPrimed(true);
      await bootstrapMatrix();
    })();
    return () => {
      active = false;
    };
  }, [sessionStorageKey]);

  if (!primed) return null;

  return (
    <ScopeProvider scope={getMatrixScope()}>
      <ExecutionContextProvider>
        <Suspense fallback={null}>{children}</Suspense>
      </ExecutionContextProvider>
    </ScopeProvider>
  );
}

export function useMatrix(): MatrixContextValue {
  const client = useAtom(clientAtom);
  const session = useAtom(sessionAtom);
  const status = useAtom(statusAtom);
  const error = useAtom(errorAtom);
  const syncState = useAtom(syncStateAtom);
  const lastSyncedAt = useAtom(lastSyncedAtAtom);
  const cryptoStatus = useAtom(cryptoStatusAtom);
  const pendingBackup = useAtom(pendingBackupAtom);
  const keyUnlockedThisSession = useAtom(keyUnlockedAtom);
  const { ready, notReadyReason } = useAtom(readinessAtom);

  return {
    client,
    session,
    status,
    error,
    syncState,
    lastSyncedAt,
    cryptoStatus,
    pendingBackup,
    keyUnlockedThisSession,
    markKeyUnlocked,
    ready,
    notReadyReason,
    signIn,
    signOut,
    resetBackup,
  };
}
