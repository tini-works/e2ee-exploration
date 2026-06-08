"use client";

import { useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { Lite } from "@pumped-fn/lite";
import { ScopeContext } from "@pumped-fn/lite-react";
import { PumpedFeedStore } from "./store";
import type { AtomRegistry, FeedOptions, FeedState } from "./types";

export interface UsePumpedFeedResult {
  /** Null when there is no scope in context (and none was passed). */
  state: FeedState | null;
  clear: () => void;
}

/**
 * Subscribe to a pumped-fn scope and expose its atom snapshots + flow feed.
 * Reads the scope from `ScopeProvider` context unless one is passed explicitly.
 * Safe to call outside a provider — it simply returns `state: null`.
 */
export function usePumpedFeed(
  atoms: AtomRegistry,
  opts?: FeedOptions & { scope?: Lite.Scope },
): UsePumpedFeedResult {
  const ctxScope = useContext(ScopeContext);
  const scope = opts?.scope ?? ctxScope;
  const maxEvents = opts?.maxEvents;

  const store = useMemo(
    () => (scope ? new PumpedFeedStore(scope, atoms, { maxEvents }) : null),
    // atoms is expected to be a stable module-level object.
    [scope, atoms, maxEvents],
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
