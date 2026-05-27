---
id: c3-211
c3-seal: 0e46e7d0045485e261415482f50979680e05a06ee6568e3c3e765eee73585a64
title: matrix-provider
type: component
category: feature
parent: c3-2
goal: 'Bind the c3-207 matrix-state scope to the React tree: expose a single useMatrix() hook surfacing every cross-cutting Matrix value plus the imperative methods (signIn, signOut, resetBackup, markKeyUnlocked). A thin React binding that owns no state of its own — all state lives in c3-207''s atoms; it mounts the scope, primes it before first paint, and reads atoms via useAtom.'
uses:
    - ref-client-only
    - ref-key-gate
    - ref-matrix-js-sdk
    - ref-pumped-fn-state
    - ref-recovery-key
    - rule-key-gate-disable
---

## Goal

Bind the `c3-207 matrix-state` scope to the React tree and expose a single `useMatrix()` hook that surfaces every cross-cutting Matrix value the app needs (client, session, status, syncState, lastSyncedAt, cryptoStatus, pendingBackup, keyUnlockedThisSession, ready, notReadyReason) plus the imperative methods (`signIn`, `signOut`, `resetBackup`, `markKeyUnlocked`). This is a thin React binding: it owns no state of its own — all state lives in c3-207's atoms — it only mounts the scope, primes it before first paint, and reads atoms via `useAtom`.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | feature |
| Consumers | Mounted by web/src/app/layout.tsx; every web component consumes useMatrix(). |
| External deps | @pumped-fn/lite-react (ScopeProvider, ExecutionContextProvider, useAtom); matrix-js-sdk (MatrixClient, type-only). |
| Persistence | None directly; the sessionStorageKey prop is forwarded to c3-207 via configureSessionStorageKey. |

## Purpose

Owns: the `MatrixContextValue` shape exposed to consumers; the `MatrixProvider` component, which mounts `<ScopeProvider scope={getMatrixScope()}>` + `<ExecutionContextProvider>`, calls `primeMatrixState()` and gates children on `primed` so reads never suspend, then kicks off `bootstrapMatrix()`; the `useMatrix()` hook, which reads each atom via `useAtom` and assembles the context value; the re-export of the c3-207 action functions and the `CryptoStatus`/`NotReadyReason` types.

Non-goals: owning state (c3-207 owns all atoms, the scope, and the imperative lifecycle); SSSS / recovery-key mechanics (c3-203); patient domain (c3-210); device verification (c3-205); peer-key-share (c3-206); invite enumeration (c3-212).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Mounted as a top-level provider. SSR-safe: returns null until primed; the underlying loadSession early-returns when window is undefined. | ref-client-only |
| Inputs | sessionStorageKey? prop (defaults to DEFAULT_SESSION_STORAGE_KEY), forwarded to c3-207 via configureSessionStorageKey. | ref-recovery-key |
| State | None of its own. Reads c3-207 atoms (client, session, status, error, syncState, lastSyncedAt, cryptoStatus, pendingBackup, keyUnlocked, readinessAtom) via useAtom; one local primed boolean to gate first paint. | ref-pumped-fn-state |
| Shared deps | c3-207 getMatrixScope, primeMatrixState, bootstrapMatrix, configureSessionStorageKey, signIn, signOut, resetBackup, markKeyUnlocked; c3-202 DEFAULT_SESSION_STORAGE_KEY/StoredSession. | ref-pumped-fn-state |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | App tree has a single React entry point onto the Matrix state scope; UI renders gating purely from useMatrix().ready / notReadyReason. | ref-key-gate |
| Primary path | Mount → configureSessionStorageKey → primeMatrixState() → setPrimed(true) → render ScopeProvider+children → bootstrapMatrix() resumes any persisted session. | ref-key-gate |
| Alternates | Consumers call the re-exported signIn/signOut/resetBackup/markKeyUnlocked directly or via the value returned by useMatrix(). | ref-recovery-key |
| Failure | Errors surface through the status/error atoms read by useMatrix(); the provider itself only gates first paint and has no failure branch beyond rendering null until primed. | rule-key-gate-disable |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-pumped-fn-state | ref | State binding | hard | Provider reads c3-207 atoms via useAtom and mounts the global scope; must not introduce a competing React state store. |
| ref-key-gate | ref | Single gate | hard | useMatrix().ready/notReadyReason come straight from readinessAtom (c3-207); the provider must not recompute the gate. |
| ref-recovery-key | ref | Unlock surface | hard | markKeyUnlocked re-exported here is the only way the UI flips keyUnlocked; called by status-bar and resetBackup. |
| ref-client-only | ref | "use client" | hard | provider.tsx is "use client"; renders null until primed to stay SSR-safe. |
| ref-matrix-js-sdk | ref | SDK type surface | hard | Exposes client: MatrixClient (type-only import); no runtime SDK calls live here anymore. |
| rule-key-gate-disable | rule | UI gate | hard | Provider supplies the ready boolean + notReadyReason shape consumers must use. |
| adr-20260527-pumped-fn-state | adr | Origin | hard | Authorizes re-scoping this component down to a binding after state moved to c3-207. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <MatrixProvider> | IN | Mounted once at the layout root; sessionStorageKey prop forwarded to c3-207; renders null until the scope is primed. | React | packages/matrix-client/src/react/provider.tsx |
| useMatrix() | OUT | Returns MatrixContextValue assembled from useAtom reads + re-exported actions. | React | packages/matrix-client/src/react/provider.tsx |
| signIn / signOut / resetBackup / markKeyUnlocked | OUT | Re-exported from c3-207 via matrix-client/react; same contracts as the source. | matrix-client/react | packages/matrix-client/src/react/index.ts |
| ready (from useMatrix) | OUT | Mirrors readinessAtom: true iff status "ready" AND syncState in {PREPARED, SYNCING} AND keyUnlocked. | matrix-client/react | packages/matrix-client/src/state/atoms.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Reads suspend on first paint | Removing the primeMatrixState()/primed gate before rendering children. | useAtom throws/suspends; provider crashes on mount. | Re-read MatrixProvider in provider.tsx; children render only after setPrimed(true). |
| Competing state store reintroduced | Adding useState/Context that mirrors c3-207 atoms. | Two sources of truth for the same Matrix value drift apart. | grep -n useState packages/matrix-client/src/react/provider.tsx; only the primed gate is allowed. |
| Gate recomputed in the provider | Deriving ready locally instead of reading readinessAtom. | UI gate diverges from c3-207's authoritative gate. | Re-read useMatrix in provider.tsx; ready/notReadyReason come from useAtom(readinessAtom). |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| MatrixContextValue | Contract | New fields must be backed by a c3-207 atom and added to both the useAtom reads and the returned object. | packages/matrix-client/src/react/provider.tsx |
| NotReadyReason union | c3-207 Contract | New kinds must also be mapped in web/src/lib/not-ready-message.ts (c3-103). | web/src/lib/not-ready-message.ts |
