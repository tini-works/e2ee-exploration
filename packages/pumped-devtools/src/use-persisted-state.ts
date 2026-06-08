"use client";

import { useEffect, useState } from "react";

/**
 * useState that mirrors a string-ish value to localStorage. SSR-safe (falls
 * back to `initial` when there's no window) and validation-guarded: `decode`
 * returns `undefined` for stale/invalid stored values so they're ignored.
 */
export function usePersistedState<T extends string>(
  key: string,
  initial: T,
  decode: (raw: string) => T | undefined,
): readonly [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return (raw != null ? decode(raw) : undefined) ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode / quota — non-fatal */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/**
 * Like {@link usePersistedState} but for a `{ width, height }` object, stored
 * as JSON. Used by the drag-to-resize handle so the panel size survives reloads.
 */
export function usePersistedSize(
  key: string,
  initial: { width: number; height: number },
): readonly [
  { width: number; height: number },
  (next: { width: number; height: number }) => void,
] {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initial;
      const parsed = JSON.parse(raw);
      return typeof parsed?.width === "number" && typeof parsed?.height === "number"
        ? { width: parsed.width, height: parsed.height }
        : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode / quota — non-fatal */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
