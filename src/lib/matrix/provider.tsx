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
} from "./client";
import {
  cacheSecurityKey,
  getStatus,
  hasCachedBackupDecryptionKey,
} from "./secret-storage";
import {
  SESSION_STORAGE_KEY,
  type PendingInvite,
  type StoredSession,
} from "./types";
import {
  acceptPatientInvite,
  declinePatientInvite,
  listPendingInvites,
} from "./patients";
import { wipeLocalMatrixData } from "./wipe";

type Status = "initializing" | "idle" | "connecting" | "ready" | "error";

export type CryptoStatus = {
  crossSigningReady: boolean;
  secretStorageReady: boolean;
  backupVersion: string | null;
};

type Ctx = {
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
  pendingInvites: PendingInvite[];
  acceptInvite: (roomId: string) => Promise<void>;
  declineInvite: (roomId: string) => Promise<void>;
  ready: boolean;
  notReadyReason: string | null;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  resetBackup: (securityKey: string) => Promise<void>;
};

const MatrixContext = createContext<Ctx | null>(null);

function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function MatrixProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [status, setStatus] = useState<Status>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [cryptoStatus, setCryptoStatus] = useState<CryptoStatus | null>(null);
  const [pendingBackup, setPendingBackup] = useState(0);
  const [keyUnlockedThisSession, setKeyUnlockedThisSession] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
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

  const refreshInvites = useCallback((c: MatrixClient) => {
    try {
      setPendingInvites(listPendingInvites(c));
    } catch {
      /* ignore */
    }
  }, []);

  const attachListeners = useCallback(
    async (c: MatrixClient) => {
      const sdk = await import("matrix-js-sdk");
      const { ClientEvent, HttpApiEvent, RoomEvent } = sdk;
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
      const onMembership = () => {
        refreshInvites(c);
      };
      const onLoggedOut = () => {
        // Server rejected our access token (revoked elsewhere or expired).
        // Drop local session so the UI returns to the sign-in screen instead
        // of hanging on dead requests.
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        setClient(null);
        setSession(null);
        setSyncState(null);
        setLastSyncedAt(null);
        setCryptoStatus(null);
        setPendingBackup(0);
        setKeyUnlockedThisSession(false);
        setPendingInvites([]);
        setStatus("idle");
      };

      c.on(ClientEvent.Sync, onSync);
      c.on(CryptoEvent.KeysChanged, onCrypto);
      c.on(CryptoEvent.KeyBackupStatus, onCrypto);
      c.on(CryptoEvent.KeyBackupDecryptionKeyCached, onCrypto);
      c.on(CryptoEvent.DevicesUpdated, onCrypto);
      c.on(CryptoEvent.KeyBackupSessionsRemaining, onRemaining);
      c.on(RoomEvent.MyMembership, onMembership);
      c.on(HttpApiEvent.SessionLoggedOut, onLoggedOut);

      return () => {
        c.off(ClientEvent.Sync, onSync);
        c.off(CryptoEvent.KeysChanged, onCrypto);
        c.off(CryptoEvent.KeyBackupStatus, onCrypto);
        c.off(CryptoEvent.KeyBackupDecryptionKeyCached, onCrypto);
        c.off(CryptoEvent.DevicesUpdated, onCrypto);
        c.off(CryptoEvent.KeyBackupSessionsRemaining, onRemaining);
        c.off(RoomEvent.MyMembership, onMembership);
        c.off(HttpApiEvent.SessionLoggedOut, onLoggedOut);
      };
    },
    [refreshCryptoStatus, refreshInvites],
  );

  const detachRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<Promise<void> | null>(null);

  const start = useCallback(
    async (s: StoredSession): Promise<MatrixClient | null> => {
      setStatus("connecting");
      setError(null);
      try {
        // If a previous sign-out is still cleaning up IndexedDB in the
        // background, wait for it before starting a fresh client. Otherwise
        // the new client deadlocks on a locked store.
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
        refreshInvites(c);
        setStatus("ready");
        return c;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
        return null;
      }
    },
    [attachListeners, refreshCryptoStatus, refreshInvites],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const existing = loadSession();
    if (existing) {
      // Bootstrap a stored session on mount; start() itself drives status transitions.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void start(existing);
    } else {
      setStatus("idle");
    }
  }, [start]);

  useEffect(() => {
    if (pendingBackup <= 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingBackup]);

  const teardownClient = useCallback(async (c: MatrixClient | null) => {
    if (detachRef.current) {
      detachRef.current();
      detachRef.current = null;
    }
    // Flip UI back to sign-in screen immediately. SDK cleanup happens in the
    // background — clearStores() can stall on the rust-crypto IndexedDB.
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setClient(null);
    setSession(null);
    setSyncState(null);
    setLastSyncedAt(null);
    setCryptoStatus(null);
    setPendingBackup(0);
    setKeyUnlockedThisSession(false);
    setPendingInvites([]);
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
  }, []);

  const signIn = useCallback(
    async (input: LoginInput) => {
      const s = await loginWithPassword(input);
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
      const c = await start(s);
      if (!c) {
        throw new Error(
          "Signed in but the client failed to start. Try refreshing.",
        );
      }
    },
    [start],
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
      // Validate the security key and prime the in-memory SSSS cache so the
      // SDK's getSecretStorageKey callback has something to return when
      // resetKeyBackup tries to store the new key into SSSS.
      await cacheSecurityKey(client, securityKey);
      // Creates a new server-side backup version with a fresh decryption key
      // and stores that key in SSSS. Replaces any existing backup; sessions
      // from sender devices need to be re-uploaded to the new version before
      // they're recoverable here.
      await crypto.resetKeyBackup();
      // Cache the freshly-stored private key locally so the SDK can read the
      // new backup on demand.
      try {
        await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
      } catch {
        /* fresh backup means there's nothing to load yet — non-fatal */
      }
      await refreshCryptoStatus(client);
      // Force a retry of any UTD events with the now-matching backup key.
      await Promise.all(
        client.getRooms().map((r) => r.decryptAllEvents().catch(() => {})),
      );
      // The user just proved they hold the recovery key by writing a new
      // backup with it — count that as unlocking this session.
      setKeyUnlockedThisSession(true);
    },
    [client, refreshCryptoStatus],
  );

  const markKeyUnlocked = useCallback(() => {
    setKeyUnlockedThisSession(true);
  }, []);

  const acceptInvite = useCallback(
    async (roomId: string) => {
      if (!client) throw new Error("Not signed in.");
      await acceptPatientInvite(client, roomId);
      refreshInvites(client);
    },
    [client, refreshInvites],
  );

  const declineInvite = useCallback(
    async (roomId: string) => {
      if (!client) throw new Error("Not signed in.");
      await declinePatientInvite(client, roomId);
      refreshInvites(client);
    },
    [client, refreshInvites],
  );

  const { ready, notReadyReason } = useMemo(() => {
    if (status !== "ready" || !client) {
      return { ready: false, notReadyReason: "Not signed in." };
    }
    if (syncState !== "PREPARED" && syncState !== "SYNCING") {
      const label =
        syncState === "RECONNECTING"
          ? "Reconnecting to homeserver…"
          : syncState === "CATCHUP"
            ? "Catching up with homeserver…"
            : syncState === "ERROR"
              ? "Sync error — waiting for reconnection."
              : "Waiting for first sync to finish…";
      return { ready: false, notReadyReason: label };
    }
    // Per the AGENTS.md rule, no functions are usable until the user has
    // proven they hold the recovery key in this session.
    if (!keyUnlockedThisSession) {
      return {
        ready: false,
        notReadyReason:
          "Enter your recovery key in the status bar to unlock this session.",
      };
    }
    return { ready: true, notReadyReason: null };
  }, [status, client, syncState, keyUnlockedThisSession]);

  const value = useMemo<Ctx>(
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
      pendingInvites,
      acceptInvite,
      declineInvite,
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
      pendingInvites,
      acceptInvite,
      declineInvite,
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
