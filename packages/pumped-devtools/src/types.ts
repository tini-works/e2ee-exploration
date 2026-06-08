import type { Lite } from "@pumped-fn/lite";

/**
 * A label -> atom map. pumped-fn atoms carry no name of their own, so the host
 * supplies readable labels (the same trick scope.ts uses for tracing).
 */
export type AtomRegistry = Record<string, Lite.Atom<unknown>>;

/** Mirrors pumped-fn's internal AtomState (not exported as a value). */
export type AtomLifecycle = "idle" | "resolving" | "resolved" | "failed";

/** A point-in-time view of one atom, shown in the State panel. */
export interface AtomSnapshot {
  label: string;
  state: AtomLifecycle;
  /** Preview string of the current value (or the error message if failed). */
  value: string;
  /** Whether the current value could be read (false while idle / failed). */
  readable: boolean;
  /** How many times this atom's value has actually changed. */
  changes: number;
  /** Clock (ms since the store started) of the last activity. */
  updatedAt: number;
}

/**
 * One entry in the flow feed — rendered as a chat bubble. The lifecycle kinds
 * (`resolving`/`resolved`) are what make the *reactive cascade* visible: a write
 * to one atom shows up as that atom changing, then every watcher re-resolving.
 */
export type FeedEventKind =
  | "value" // resolved to a NEW value
  | "resolving" // factory is (re)running
  | "resolved" // settled, value unchanged from before
  | "failed"; // factory threw

export interface FeedEvent {
  id: number;
  label: string;
  kind: FeedEventKind;
  /** Value preview after the event. */
  value: string;
  /** Previous value preview, for `value` changes only. */
  prev?: string;
  at: number;
}

export interface FeedState {
  atoms: AtomSnapshot[];
  events: FeedEvent[];
  /** Total value-changes across all atoms — drives the collapsed badge. */
  totalChanges: number;
}

export interface FeedOptions {
  /** Ring-buffer size for the flow feed. Default 250. */
  maxEvents?: number;
}
