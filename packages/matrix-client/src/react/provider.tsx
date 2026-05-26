"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  DEFAULT_SESSION_STORAGE_KEY,
  type StoredSession,
} from "../types";
import { wipeLocalMatrixData } from "../wipe";

type Status = "initializing" | "idle" | "connecting" | "ready" | "error";

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

const MatrixContext = createContext<MatrixContextValue | null>(null);

export type MatrixProviderProps = {
  children: React.ReactNode;
  /** localStorage key used to persist the session. Defaults to "matrix-client.session". */
  sessionStorageKey?: string;
};

function loadSession(storageKey: string): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function MatrixProvider({
  children,
  sessionStorageKey = DEFAULT_SESSION_STORAGE_KEY,
}: MatrixProviderProps) {
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [status, setStatus] = useState<Status>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [cryptoStatus, setCryptoStatus] = useState<CryptoStatus | null>(null);
  const [pendingBackup, setPendingBackup] = useState(0);
  const [keyUnlockedThisSession, setKeyUnlockedThisSession] = useState(false);
  const startedRef = useRef(false);

  const refreshCryptoStatus = useCallback(async (c: MatrixClient) => {
    try {
      const s = await getStatus(c);
      setCryptoStatus({
        crossSigningReady: s.crossSigningReady,
        secretStorageReady: s.secretStorageReady,
        backupVersion: s.activeBackupVersion,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const attachListeners = useCallback(
    async (c: MatrixClient) => {
      const sdk = await import("matrix-js-sdk");
      const { ClientEvent, HttpApiEvent } = sdk;
      const { CryptoEvent } = await import("matrix-js-sdk/lib/crypto-api");

      const onSync = (state: string) => {
        setSyncState(state);
        if (state === "SYNCING" || state === "PREPARED") {
          setLastSyncedAt(Date.now());
        }
      };
      const onCrypto = () => {
        void refreshCryptoStatus(c);
      };
      const onRemaining = (remaining: number) => {
        setPendingBackup(remaining);
      };
      const onLoggedOut = () => {
        window.localStorage.removeItem(sessionStorageKey);
        setClient(null);
        setSession(null);
        setSyncState(null);
        setLastSyncedAt(null);
        setCryptoStatus(null);
        setPendingBackup(0);
        setKeyUnlockedThisSession(false);
        setStatus("idle");
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
    },
    [refreshCryptoStatus, sessionStorageKey],
  );

  const detachRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<Promise<void> | null>(null);

  const start = useCallback(
    async (s: StoredSession): Promise<MatrixClient | null> => {
      setStatus("connecting");
      setError(null);
      try {
        if (cleanupRef.current) {
          await cleanupRef.current;
          cleanupRef.current = null;
        }
        const c = await createMatrixClient(s);
        detachRef.current = await attachListeners(c);
        setClient(c);
        setSession(s);
        setSyncState(c.getSyncState() ?? null);
        setLastSyncedAt(Date.now());
        await refreshCryptoStatus(c);
        if (await hasCachedBackupDecryptionKey(c)) {
          setKeyUnlockedThisSession(true);
        }
        setStatus("ready");
        return c;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
        return null;
      }
    },
    [attachListeners, refreshCryptoStatus],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const existing = loadSession(sessionStorageKey);
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void start(existing);
    } else {
      setStatus("idle");
    }
  }, [sessionStorageKey, start]);

  const teardownClient = useCallback(
    async (c: MatrixClient | null) => {
      if (detachRef.current) {
        detachRef.current();
        detachRef.current = null;
      }
      window.localStorage.removeItem(sessionStorageKey);
      setClient(null);
      setSession(null);
      setSyncState(null);
      setLastSyncedAt(null);
      setCryptoStatus(null);
      setPendingBackup(0);
      setKeyUnlockedThisSession(false);
      setStatus("idle");

      if (!c) {
        await wipeLocalMatrixData();
        return;
      }
      const withTimeout = <T,>(p: Promise<T>, ms: number) =>
        Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
      cleanupRef.current = (async () => {
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
    },
    [sessionStorageKey],
  );

  const signIn = useCallback(
    async (input: LoginInput) => {
      const s = await loginWithPassword(input);
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(s));
      const c = await start(s);
      if (!c) {
        throw new Error(
          "Signed in but the client failed to start. Try refreshing.",
        );
      }
    },
    [sessionStorageKey, start],
  );

  const signOut = useCallback(async () => {
    if (pendingBackup > 0) {
      throw new Error(
        `Hold on — ${pendingBackup} message key${pendingBackup === 1 ? "" : "s"} still uploading to backup. Wait a moment, otherwise you'll lose access to recent messages.`,
      );
    }
    await teardownClient(client);
  }, [client, pendingBackup, teardownClient]);

  const resetBackup = useCallback(
    async (securityKey: string) => {
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
      await refreshCryptoStatus(client);
      await Promise.all(
        client.getRooms().map((r) => r.decryptAllEvents().catch(() => {})),
      );
      setKeyUnlockedThisSession(true);
    },
    [client, refreshCryptoStatus],
  );

  const markKeyUnlocked = useCallback(() => {
    setKeyUnlockedThisSession(true);
  }, []);

  const { ready, notReadyReason } = useMemo<{
    ready: boolean;
    notReadyReason: NotReadyReason | null;
  }>(() => {
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
    if (!keyUnlockedThisSession) {
      return { ready: false, notReadyReason: { kind: "needs_recovery_key" } };
    }
    return { ready: true, notReadyReason: null };
  }, [status, client, syncState, keyUnlockedThisSession]);

  const value = useMemo<MatrixContextValue>(
    () => ({
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
    }),
    [
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
    ],
  );

  return (
    <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>
  );
}

export function useMatrix() {
  const ctx = useContext(MatrixContext);
  if (!ctx) throw new Error("useMatrix must be used inside MatrixProvider");
  return ctx;
}
