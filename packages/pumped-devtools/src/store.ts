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
  FormSnapshot,
  ScopedValueRegistry,
} from "./types";

const EMPTY: FeedState = { atoms: [], forms: [], events: [], totalChanges: 0 };

/**
 * The runtime shape of a resolved scopedValue (its `access`). Declared locally
 * so the store doesn't depend on lite-react's generic ScopedValueAccess type.
 */
interface ScopedAccess {
  readonly disposed: boolean;
  getSnapshot(): unknown;
  subscribe(listener: () => void): () => void;
  actions: Record<string, unknown>;
}

interface StoreOptions extends FeedOptions {
  scopedValues?: ScopedValueRegistry;
  /** Execution context to resolve scopedValues against (must match the app's). */
  ctx?: Lite.ExecutionContext | null;
}

/**
 * Watches a pumped-fn scope: one Controller per registered atom, plus one
 * subscription per registered scopedValue (form). It projects every transition
 * into (a) live snapshots per atom/form and (b) an append-only flow feed —
 * atom resolves/value-changes AND scopedValue state-patches/action-invocations.
 * Designed to back a `useSyncExternalStore`: `getSnapshot` returns a stable
 * reference until something actually changes.
 */
export class PumpedFeedStore {
  private readonly entries: Array<[string, Lite.Atom<unknown>]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly svEntries: Array<[string, any]>;
  private readonly ctx: Lite.ExecutionContext | null;
  private readonly maxEvents: number;
  private readonly start = now();

  private readonly listeners = new Set<() => void>();
  private readonly unsubs: Array<() => void> = [];
  private readonly snapshots = new Map<string, AtomSnapshot>();
  private readonly forms = new Map<string, FormSnapshot>();
  private readonly formRaw = new Map<string, unknown>();
  /** Original action fns we monkeypatched, restored on dispose. */
  private readonly restores: Array<
    [Record<string, unknown>, string, unknown]
  > = [];
  private events: FeedEvent[] = [];
  private seq = 0;
  private totalChanges = 0;

  private cache: FeedState = EMPTY;
  private wired = false;

  constructor(
    private readonly scope: Lite.Scope,
    atoms: AtomRegistry,
    opts?: StoreOptions,
  ) {
    this.entries = Object.entries(atoms);
    this.svEntries = Object.entries(opts?.scopedValues ?? {});
    this.ctx = opts?.ctx ?? null;
    this.maxEvents = opts?.maxEvents ?? 250;
  }

  /** Idempotent: wire a controller per atom and a subscription per scopedValue. */
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

    // scopedValues resolve through the app's execution context (not the raw
    // scope) so we observe the SAME instance components use — letting us read
    // its state and patch its actions in place.
    if (this.ctx) {
      for (const [label, sv] of this.svEntries) {
        void Promise.resolve(this.ctx.resolve(sv))
          .then((access) => this.wireForm(label, access as ScopedAccess))
          .catch(() => {});
      }
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

  // --- scopedValue (form) tracking ----------------------------------------

  private wireForm(label: string, access: ScopedAccess) {
    this.formRaw.set(label, safeSnapshot(access));
    this.forms.set(label, this.readForm(label, access, 0, 0));

    this.unsubs.push(access.subscribe(() => this.onFormChange(label, access)));
    this.patchActions(label, access);
    this.rebuild();
  }

  private onFormChange(label: string, access: ScopedAccess) {
    const prev = this.forms.get(label);
    const prevRaw = this.formRaw.get(label);
    const nextRaw = safeSnapshot(access);
    this.formRaw.set(label, nextRaw);

    const snap = this.readForm(
      label,
      access,
      (prev?.changes ?? 0) + 1,
      prev?.actions ?? 0,
    );
    this.forms.set(label, snap);

    this.push({
      id: ++this.seq,
      label,
      kind: "form",
      value: snap.value,
      prev: previewValue(prevRaw),
      detail: diffFields(prevRaw, nextRaw),
      at: snap.updatedAt,
    });
  }

  /**
   * Replace each action function on the shared `access.actions` object in place.
   * Components hold the same object reference, so their calls flow through these
   * wrappers — giving us the action name + args with zero app-side coupling.
   */
  private patchActions(label: string, access: ScopedAccess) {
    const actions = access.actions;
    if (!actions || typeof actions !== "object" || Object.isFrozen(actions))
      return;

    for (const key of Object.keys(actions)) {
      const original = actions[key];
      if (typeof original !== "function") continue;
      const fn = original as (...args: unknown[]) => unknown;
      const wrapped = (...args: unknown[]) => {
        this.onAction(label, key, args);
        return fn.apply(actions, args);
      };
      try {
        actions[key] = wrapped;
        this.restores.push([actions, key, original]);
      } catch {
        // Non-writable property — skip, state tracking still works.
      }
    }
  }

  private onAction(label: string, name: string, args: unknown[]) {
    const prev = this.forms.get(label);
    if (prev) {
      this.forms.set(label, { ...prev, actions: prev.actions + 1 });
    }
    this.push({
      id: ++this.seq,
      label,
      kind: "action",
      action: name,
      value: args.map((a) => previewValue(a, 40)).join(", "),
      at: now() - this.start,
    });
  }

  private readForm(
    label: string,
    access: ScopedAccess,
    changes: number,
    actions: number,
  ): FormSnapshot {
    let value = "·";
    let disposed = false;
    try {
      disposed = access.disposed;
      value = previewValue(access.getSnapshot());
    } catch {
      // unreadable (disposed) — keep the placeholder
    }
    return { label, value, changes, actions, disposed, updatedAt: now() - this.start };
  }

  // ------------------------------------------------------------------------

  private push(event: FeedEvent) {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    this.rebuild();
  }

  private rebuild() {
    // Preserve registry order for the lists; events stay chronological.
    const atoms = this.entries.map(
      ([label]) => this.snapshots.get(label) ?? atomPlaceholder(label),
    );
    const forms = this.svEntries.map(
      ([label]) => this.forms.get(label) ?? formPlaceholder(label),
    );
    this.cache = {
      atoms,
      forms,
      events: this.events,
      totalChanges: this.totalChanges,
    };
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
    for (const [label, form] of this.forms) {
      this.forms.set(label, { ...form, changes: 0, actions: 0 });
    }
    this.rebuild();
  };

  dispose() {
    for (const off of this.unsubs) off();
    this.unsubs.length = 0;
    // Restore the original action functions we patched in.
    for (const [obj, key, fn] of this.restores) {
      try {
        obj[key] = fn;
      } catch {
        // best-effort
      }
    }
    this.restores.length = 0;
    this.listeners.clear();
  }
}

function safeSnapshot(access: ScopedAccess): unknown {
  try {
    return access.getSnapshot();
  } catch {
    return undefined;
  }
}

/** Compact summary of which top-level fields changed between two states. */
function diffFields(prev: unknown, next: unknown): string | undefined {
  if (!isPlainObject(prev) || !isPlainObject(next)) return undefined;
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (!Object.is(prev[k], next[k])) changed.push(k);
  }
  if (changed.length === 0) return undefined;
  return changed.slice(0, 4).join(", ") + (changed.length > 4 ? "…" : "");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    (v.constructor === Object || v.constructor === undefined)
  );
}

function atomPlaceholder(label: string): AtomSnapshot {
  return { label, state: "idle", value: "·", readable: false, changes: 0, updatedAt: 0 };
}

function formPlaceholder(label: string): FormSnapshot {
  return { label, value: "·", changes: 0, actions: 0, disposed: false, updatedAt: 0 };
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
