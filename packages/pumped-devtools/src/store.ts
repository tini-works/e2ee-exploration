import type { Lite } from "@pumped-fn/lite";
import { previewValue } from "./preview";
import type {
  AtomLifecycle,
  AtomRegistry,
  AtomSnapshot,
  FeedEvent,
  FeedEventKind,
  FeedOptions,
  FeedState,
} from "./types";

const EMPTY: FeedState = { atoms: [], events: [], totalChanges: 0 };

/**
 * Watches a pumped-fn scope through one Controller per registered atom and
 * projects every lifecycle transition into (a) a live snapshot per atom and
 * (b) an append-only flow feed. Designed to back a `useSyncExternalStore`:
 * `getSnapshot` returns a stable reference until something actually changes.
 */
export class PumpedFeedStore {
  private readonly entries: Array<[string, Lite.Atom<unknown>]>;
  private readonly maxEvents: number;
  private readonly start = now();

  private readonly listeners = new Set<() => void>();
  private readonly unsubs: Array<() => void> = [];
  private readonly snapshots = new Map<string, AtomSnapshot>();
  private events: FeedEvent[] = [];
  private seq = 0;
  private totalChanges = 0;

  private cache: FeedState = EMPTY;
  private wired = false;

  constructor(
    private readonly scope: Lite.Scope,
    atoms: AtomRegistry,
    opts?: FeedOptions,
  ) {
    this.entries = Object.entries(atoms);
    this.maxEvents = opts?.maxEvents ?? 250;
  }

  /** Idempotent: resolve a controller per atom and subscribe to its changes. */
  start_() {
    if (this.wired) return;
    this.wired = true;

    for (const [label, atom] of this.entries) {
      const ctrl = this.scope.controller(atom) as Lite.Controller<unknown>;
      // Seed an initial snapshot silently (no feed spam on mount)…
      this.snapshots.set(label, this.read(label, ctrl, 0));
      // …then nudge resolution so derived atoms begin tracking their deps.
      void Promise.resolve(ctrl.resolve()).catch(() => {});
      this.unsubs.push(ctrl.on("*", () => this.onChange(label, ctrl)));
    }
    this.rebuild();
  }

  private onChange(label: string, ctrl: Lite.Controller<unknown>) {
    const prev = this.snapshots.get(label);
    const next = this.read(label, ctrl, prev?.changes ?? 0);

    let kind: FeedEventKind;
    if (next.state === "resolving") {
      kind = "resolving";
    } else if (next.state === "failed") {
      kind = "failed";
    } else if (prev && prev.readable && prev.value !== next.value) {
      kind = "value";
    } else {
      kind = "resolved";
    }

    if (kind === "value") {
      next.changes = (prev?.changes ?? 0) + 1;
      this.totalChanges += 1;
    }

    this.snapshots.set(label, next);
    this.push({
      id: ++this.seq,
      label,
      kind,
      value: next.value,
      prev: kind === "value" ? prev?.value : undefined,
      at: next.updatedAt,
    });
  }

  /** Read the controller's current lifecycle + value into a fresh snapshot. */
  private read(
    label: string,
    ctrl: Lite.Controller<unknown>,
    changes: number,
  ): AtomSnapshot {
    const state = ctrl.state as AtomLifecycle;
    try {
      return {
        label,
        state,
        value: previewValue(ctrl.get()),
        readable: true,
        changes,
        updatedAt: now() - this.start,
      };
    } catch (e) {
      return {
        label,
        state,
        value: state === "failed" ? errorText(e) : "·",
        readable: false,
        changes,
        updatedAt: now() - this.start,
      };
    }
  }

  private push(event: FeedEvent) {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    this.rebuild();
  }

  private rebuild() {
    // Preserve registry order for the atom list; events stay chronological.
    const atoms = this.entries.map(
      ([label]) => this.snapshots.get(label) ?? placeholder(label),
    );
    this.cache = { atoms, events: this.events, totalChanges: this.totalChanges };
    for (const fn of this.listeners) fn();
  }

  // --- useSyncExternalStore surface (arrow fns: stable identities) --------
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): FeedState => this.cache;

  getServerSnapshot = (): FeedState => EMPTY;

  clear = () => {
    this.events = [];
    this.seq = 0;
    this.totalChanges = 0;
    for (const snap of this.snapshots.values()) snap.changes = 0;
    this.rebuild();
  };

  dispose() {
    for (const off of this.unsubs) off();
    this.unsubs.length = 0;
    this.listeners.clear();
  }
}

function placeholder(label: string): AtomSnapshot {
  return { label, state: "idle", value: "·", readable: false, changes: 0, updatedAt: 0 };
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
