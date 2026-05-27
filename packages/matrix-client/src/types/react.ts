import type { MatrixClient } from "matrix-js-sdk";
import type { LoginInput } from "./auth";
import type { StoredSession } from "./session";
import type { CryptoStatus, NotReadyReason, Status } from "./state";

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
