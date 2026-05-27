"use client";

import { Suspense, useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  ExecutionContextProvider,
  ScopeProvider,
  useAtom,
} from "@pumped-fn/lite-react";
import type { LoginInput } from "../client";
import { DEFAULT_SESSION_STORAGE_KEY, type StoredSession } from "../types";
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
  type CryptoStatus,
  type NotReadyReason,
  type Status,
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

export type { CryptoStatus, NotReadyReason };

export type MatrixContextValue = {
  client: MatrixClient | null;
  session: StoredSession | null;
  status: Status;
  error: string | null;
  syncState: string | null;
  lastSyncedAt: number | null;
  cryptoStatus: CryptoStatus | null;
  pendingBackup: number;
  /** True once the user has entered a valid recovery key in this session. */
  keyUnlockedThisSession: boolean;
  /** Called when an unlock-style operation (unlock or resetBackup) succeeds. */
  markKeyUnlocked: () => void;
  ready: boolean;
  notReadyReason: NotReadyReason | null;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  resetBackup: (securityKey: string) => Promise<void>;
};

export type MatrixProviderProps = {
  children: React.ReactNode;
  /** localStorage key used to persist the session. Defaults to "matrix-client.session". */
  sessionStorageKey?: string;
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
