import type { Lite } from "@pumped-fn/lite";
import type { ScopedValue } from "@pumped-fn/lite-react";

/**
 * A label -> atom map. pumped-fn atoms carry no name of their own, so the host
 * supplies readable labels (the same trick scope.ts uses for tracing).
 */
export type AtomRegistry = Record<string, Lite.Atom<unknown>>;

/**
 * A label -> scopedValue map. Like atoms, scopedValues are nameless to the
 * devtools, so the host labels each form/state holder it wants tracked.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScopedValueRegistry = Record<string, ScopedValue<any, any>>;

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

/** A point-in-time view of one scopedValue (form), shown in the Forms panel. */
export interface FormSnapshot {
  label: string;
  /** Preview string of the current state object. */
  value: string;
  /** How many times the state has changed (patch/set/update). */
  changes: number;
  /** How many action invocations have been observed. */
  actions: number;
  /** Whether the scopedValue's scope has been disposed. */
  disposed: boolean;
  /** Clock (ms since the store started) of the last activity. */
  updatedAt: number;
}

/**
 * One entry in the flow feed — rendered as a chat bubble. The atom kinds
 * (`resolving`/`resolved`) make the *reactive cascade* visible; `form`/`action`
 * make scopedValue state patches and action invocations visible alongside it.
 */
export type FeedEventKind =
  | "value" // atom resolved to a NEW value
  | "resolving" // atom factory is (re)running
  | "resolved" // atom settled, value unchanged from before
  | "failed" // atom factory threw
  | "form" // scopedValue state changed (patch/set/update)
  | "action"; // a scopedValue action was invoked

export interface FeedEvent {
  id: number;
  label: string;
  kind: FeedEventKind;
  /** Value preview after the event (for `action`, a preview of the args). */
  value: string;
  /** Previous value preview, for `value`/`form` changes only. */
  prev?: string;
  /** Action name, for `action` events only. */
  action?: string;
  /** Short human note — e.g. the changed fields of a `form` event. */
  detail?: string;
  at: number;
}

export interface FeedState {
  atoms: AtomSnapshot[];
  forms: FormSnapshot[];
  events: FeedEvent[];
  /** Total value-changes across all atoms — drives the collapsed badge. */
  totalChanges: number;
}

export interface FeedOptions {
  /** Ring-buffer size for the flow feed. Default 250. */
  maxEvents?: number;
}
