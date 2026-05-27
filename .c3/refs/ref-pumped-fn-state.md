---
id: ref-pumped-fn-state
c3-seal: 87d0d3a55a4b2cc9b7533917e1861a8c6de538daf05bbba423a6b01390b47481
title: pumped-fn-state
type: ref
goal: Standardize where reactive client state lives so there is one source of truth that (a) outlives React StrictMode double-mounts and Next route remounts, (b) stays a projection of `matrix-js-sdk` events rather than a second copy, and (c) drives the load-bearing recovery-key gate from a single derived value instead of a hand-maintained `useMemo` dependency list. Without this standard, each component would re-derive Matrix state from `useMatrix()` props and the long-lived client would be coupled to the render tree.
---

## Goal

Standardize where reactive client state lives so there is one source of truth that (a) outlives React StrictMode double-mounts and Next route remounts, (b) stays a projection of `matrix-js-sdk` events rather than a second copy, and (c) drives the load-bearing recovery-key gate from a single derived value instead of a hand-maintained `useMemo` dependency list. Without this standard, each component would re-derive Matrix state from `useMatrix()` props and the long-lived client would be coupled to the render tree.

## Choice

Hold cross-cutting Matrix state in `@pumped-fn/lite` atoms inside ONE process-global scope (singleton via `globalThis`, `state/scope.ts`). The imperative actions layer (`state/actions.ts`) grabs atom `controller`s and pushes SDK events into writable atoms; readiness is a derived atom (`readinessAtom`) built from those controllers. React reads through `@pumped-fn/lite-react`'s `useAtom` (`state/atoms.ts`, surfaced by `useMatrix()`). Component-local form state uses `scopedValue` + `useScopedValue` (e.g. `web/src/components/sign-in.tsx`), not a pile of `useState`.

## Why

The `MatrixClient` must outlive the component tree — it owns IndexedDB stores, crypto, and sync. React Context + `useState` tie its lifetime to a mounted provider, so StrictMode double-mount or a route remount would tear it down and re-create it. A process-global pumped scope decouples client lifetime from rendering, the same rationale the codebase already applies to `peer-key-share`'s `globalThis` store. Modeling state as atoms keeps `matrix-js-sdk` the source of truth (atoms are a projection updated by SDK event listeners), and a derived `readinessAtom` makes the recovery-key gate a single computed value instead of a `useMemo` whose dependency array can silently drift and flip `ready` true too early.

## How

REQUIRED — one global scope, created once, reused across remounts (`packages/matrix-client/src/state/scope.ts`):

```ts
const STORE_KEY = "__matrix_client_scope__";
export function getMatrixScope(): Lite.Scope {
  const g = globalThis as unknown as Record<string, Lite.Scope | undefined>;
  let scope = g[STORE_KEY];
  if (!scope) { scope = createScope({ extensions: ... }); g[STORE_KEY] = scope; }
  return scope;
}
```

REQUIRED — writable atoms are a projection of the SDK; readiness is DERIVED via controllers, never a React `useMemo` (`packages/matrix-client/src/state/atoms.ts`):

```ts
export const keyUnlockedAtom = atom<boolean>({ factory: () => false });
export const readinessAtom = atom({
  deps: { status: controller(statusAtom, { resolve: true, watch: true }),
          keyUnlocked: controller(keyUnlockedAtom, { resolve: true, watch: true }), ... },
  factory: (_ctx, d): Readiness => {
    if (!d.keyUnlocked.get()) return { ready: false, notReadyReason: { kind: "needs_recovery_key" } };
    return { ready: true, notReadyReason: null };
  },
});
```

REQUIRED — actions push SDK events into atoms through controllers (`packages/matrix-client/src/state/actions.ts`): resolve atoms once, grab `scope.controller(atom)`, and `set()` from SDK listeners.

OPTIONAL — component-local form state via `scopedValue` (`web/src/components/sign-in.tsx`):

```ts
const signInForm = scopedValue({ name: "sign-in-form", initial: () => ({ ... }),
  actions: ({ get, patch }) => ({ setUsername: (username) => patch({ username }), async submit() { ... } }) });
// const form = useScopedValue(signInForm);
```
