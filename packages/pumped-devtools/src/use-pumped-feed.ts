"use client";

import { useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { Lite } from "@pumped-fn/lite";
import { ScopeContext, ExecutionContextContext } from "@pumped-fn/lite-react";
import { PumpedFeedStore } from "./store";
import type {
  AtomRegistry,
  FeedOptions,
  FeedState,
  ScopedValueRegistry,
} from "./types";

export interface UsePumpedFeedResult {
  /** Null when there is no scope in context (and none was passed). */
  state: FeedState | null;
  clear: () => void;
}

/**
 * Subscribe to a pumped-fn scope and expose its atom snapshots, scopedValue
 * (form) snapshots, and a flow feed. Reads the scope from `ScopeProvider`
 * context unless one is passed explicitly; reads the execution context (needed
 * to resolve scopedValues against the same instances the app uses) from
 * `ExecutionContextProvider`. Safe to call outside a provider — `state: null`.
 */
export function usePumpedFeed(
  atoms: AtomRegistry,
  opts?: FeedOptions & {
    scope?: Lite.Scope;
    scopedValues?: ScopedValueRegistry;
  },
): UsePumpedFeedResult {
  const ctxScope = useContext(ScopeContext);
  // Direct context read (not useExecutionContext) so this stays safe to call
  // when no ExecutionContextProvider is present — null just disables forms.
  const ctx = useContext(ExecutionContextContext);
  const scope = opts?.scope ?? ctxScope;
  const maxEvents = opts?.maxEvents;
  const scopedValues = opts?.scopedValues;

  const store = useMemo(
    () =>
      scope
        ? new PumpedFeedStore(scope, atoms, { maxEvents, scopedValues, ctx })
        : null,
    // atoms / scopedValues are expected to be stable module-level objects.
    [scope, atoms, scopedValues, ctx, maxEvents],
  );

  useEffect(() => {
    if (!store) return;
    store.start_();
    return () => store.dispose();
  }, [store]);

  const state = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : nullSnapshot,
    store ? store.getServerSnapshot : nullSnapshot,
  );

  return { state, clear: store ? store.clear : noop };
}

const noop = () => {};
const noopSubscribe = () => noop;
const nullSnapshot = (): null => null;
