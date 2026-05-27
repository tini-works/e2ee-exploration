"use client";

import type { Lite } from "@pumped-fn/lite";

/**
 * A tiny dev-only pumped extension that logs every atom/resource resolution the
 * scope goes through — name, timing, and a short preview of the resolved value.
 * Atoms have no built-in name, so callers pass a label registry (see scope.ts).
 *
 * Enable/disable at runtime from the browser console:
 *   localStorage.setItem("matrix-trace", "1")   // force on
 *   localStorage.setItem("matrix-trace", "0")   // force off
 * Defaults to on in development, off in production.
 */

const TAG = "[matrix-trace]";

export function tracingEnabled(): boolean {
  if (typeof window !== "undefined") {
    const flag = window.localStorage?.getItem("matrix-trace");
    if (flag === "1") return true;
    if (flag === "0") return false;
  }
  return process.env.NODE_ENV !== "production";
}

function preview(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number" || t === "boolean") return String(value);
  if (t === "object") {
    const ctor = (value as object).constructor?.name;
    if (ctor && ctor !== "Object") return `[${ctor}]`; // e.g. [MatrixClient]
    try {
      const json = JSON.stringify(value);
      return json.length > 80 ? `${json.slice(0, 77)}…` : json;
    } catch {
      return "[object]";
    }
  }
  return t;
}

export function tracingExtension(
  labelFor: (target: unknown) => string,
): Lite.Extension {
  return {
    name: "matrix-trace",
    async wrapResolve(next, event) {
      const name = labelFor(event.target);
      const t0 =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      console.log(`${TAG} ▶ ${event.kind} ${name}`);
      try {
        const value = await next();
        const ms = (
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          t0
        ).toFixed(1);
        console.log(`${TAG} ✓ ${event.kind} ${name} (${ms}ms) =`, preview(value));
        return value;
      } catch (e) {
        console.log(`${TAG} ✗ ${event.kind} ${name} failed:`, e);
        throw e;
      }
    },
  };
}
