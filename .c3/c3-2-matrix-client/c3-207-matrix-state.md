---
id: c3-207
c3-seal: bbe4b6bdd0109f118dbe12bf2810fd682b5fe00c51118082288c46b5854ad273
title: matrix-state
type: component
category: foundation
parent: c3-2
goal: Own the Matrix client's reactive state graph and imperative lifecycle, built on `@pumped-fn/lite`. Holds the writable atoms that project `matrix-js-sdk` events (`client`, `session`, `status`, `syncState`, `lastSyncedAt`, `cryptoStatus`, `pendingBackup`, `keyUnlocked`), the derived `readinessAtom` that is the single recovery-key gate, the process-global scope that keeps the long-lived client alive across remounts, and the imperative actions (`bootstrapMatrix`, `signIn`, `signOut`, `resetBackup`, `markKeyUnlocked`) that drive the client and push SDK events into the atoms. This is the only component in the package that owns React-readable state; `c3-211 matrix-provider` is a thin binding over it.
uses:
    - ref-client-only
    - ref-key-gate
    - ref-matrix-js-sdk
    - ref-pumped-fn-state
    - ref-recovery-key
    - rule-key-gate-disable
---

## Goal

Own the Matrix client's reactive state graph and imperative lifecycle, built on `@pumped-fn/lite`. Holds the writable atoms that project `matrix-js-sdk` events (`client`, `session`, `status`, `syncState`, `lastSyncedAt`, `cryptoStatus`, `pendingBackup`, `keyUnlocked`), the derived `readinessAtom` that is the single recovery-key gate, the process-global scope that keeps the long-lived client alive across remounts, and the imperative actions (`bootstrapMatrix`, `signIn`, `signOut`, `resetBackup`, `markKeyUnlocked`) that drive the client and push SDK events into the atoms. This is the only component in the package that owns React-readable state; `c3-211 matrix-provider` is a thin binding over it.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | feature |
| Consumers | c3-211 matrix-provider reads atoms via useMatrix()/useAtom and re-exports the actions; the web app calls the re-exported actions (e.g. c3-110 sign-in calls signIn). |
| External deps | @pumped-fn/lite (atom, controller, createScope), matrix-js-sdk (ClientEvent, HttpApiEvent, MatrixClient), matrix-js-sdk/lib/crypto-api (CryptoEvent). |
| Persistence | Reads/writes the StoredSession JSON under sessionStorageKey in localStorage; dev tracing toggled via localStorage["matrix-trace"]. |

## Purpose

Owns: the `Status`, `NotReadyReason`, `CryptoStatus`, `Readiness` types; the writable atoms in `state/atoms.ts`; the derived `readinessAtom` gate; the process-global scope singleton (`state/scope.ts`, keyed `__matrix_client_scope__` on `globalThis`); the controller-priming dance (`primeMatrixState`) so reads never suspend; client bootstrap (`start` → c3-201 `createMatrixClient`); SDK listener attach/detach (`Sync`, `KeysChanged`, `KeyBackupStatus`, `KeyBackupDecryptionKeyCached`, `DevicesUpdated`, `KeyBackupSessionsRemaining`, `SessionLoggedOut`); `signIn`, `signOut` (with the "still uploading" guard), `resetBackup`, `markKeyUnlocked`; `teardownClient` (logout-with-timeout, stopClient, clearStores, `wipeLocalMatrixData`); the dev-only `matrix-trace` extension (`state/tracing.ts`).

Non-goals: React rendering or hooks (c3-211 owns `useMatrix`/`MatrixProvider`); SSSS / recovery-key mechanics (c3-203); patient domain (c3-210); device verification (c3-205); peer-key-share (c3-206); invite enumeration (c3-212).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Scope is a globalThis singleton; primeMatrixState() resolves every writable atom + readinessAtom and grabs controllers before first paint so reads never suspend. SSR-safe: loadSession returns null when window is undefined. | ref-pumped-fn-state |
| Inputs | configureSessionStorageKey(key); signIn(LoginInput); resetBackup(securityKey); markKeyUnlocked(). | ref-recovery-key |
| State | Writable atoms: session, client, status, error, syncState, lastSyncedAt, cryptoStatus, pendingBackup, keyUnlocked. Derived: readinessAtom. Module vars: detach, cleanup, bootstrapped, primed, CTRLS. | ref-client-only |
| Shared deps | c3-201 createMatrixClient/loginWithPassword; c3-203 cacheSecurityKey/getStatus/hasCachedBackupDecryptionKey; c3-204 wipeLocalMatrixData; c3-202 DEFAULT_SESSION_STORAGE_KEY/StoredSession. | ref-matrix-js-sdk |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | One reactive source of truth for Matrix lifecycle, decoupled from the React tree; readinessAtom is the single gate the UI renders from. | ref-key-gate |
| Primary path | bootstrapMatrix → loadSession → if present start(session) (createMatrixClient → attachListeners → refreshCryptoStatus → hasCachedBackupDecryptionKey may set keyUnlocked) → status atom "ready"; otherwise status "idle". | ref-key-gate |
| Alternates | signIn(input) → loginWithPassword → persist StoredSession → start. resetBackup(key) → cacheSecurityKey → crypto.resetKeyBackup → loadSessionBackupPrivateKeyFromSecretStorage (best-effort) → decryptAllEvents per room → set keyUnlocked true. | ref-recovery-key |
| Failure | start catches client-create failures and sets status "error" + error atom. signOut rejects when pendingBackup > 0 so un-uploaded keys are never stranded. SessionLoggedOut listener forces local cleanup. | rule-key-gate-disable |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-pumped-fn-state | ref | State mechanism | hard | Defines the scope-singleton + atoms-as-SDK-projection + derived-readiness pattern this component implements. |
| ref-key-gate | ref | Single gate | hard | readinessAtom is the authoritative gate everyone reads via useMatrix(). |
| ref-recovery-key | ref | Unlock plumbing | hard | markKeyUnlocked is the only way to set keyUnlocked true; called by status-bar and resetBackup. |
| ref-client-only | ref | "use client" | hard | All state files are "use client"; loadSession checks for window. |
| ref-matrix-js-sdk | ref | SDK boundary | hard | The dynamic import("matrix-js-sdk") in attachListeners is the only such site outside c3-201. |
| rule-key-gate-disable | rule | Readiness gate | hard | readinessAtom must keep requiring keyUnlocked before returning ready: true. |
| adr-20260527-pumped-fn-state | adr | Origin | hard | Authorizes extracting state from c3-211 into this component. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| atoms (clientAtom, sessionAtom, …, readinessAtom) | OUT | Exported atoms; consumers read them via @pumped-fn/lite-react useAtom. | matrix-client/state | packages/matrix-client/src/state/atoms.ts |
| getMatrixScope() | OUT | Returns the one process-global scope; ScopeProvider mounts it. | matrix-client/state | packages/matrix-client/src/state/scope.ts |
| primeMatrixState() | OUT | Idempotent; resolves atoms + controllers so subsequent reads never suspend. | matrix-client/state | packages/matrix-client/src/state/actions.ts |
| signIn / signOut / resetBackup / markKeyUnlocked | OUT | Imperative actions; re-exported by matrix-client/react. signOut rejects when pendingBackup > 0; resetBackup re-decrypts every room and flips keyUnlocked. | matrix-client/react | packages/matrix-client/src/state/actions.ts |
| readinessAtom | OUT | ready true iff status "ready" AND syncState in {PREPARED, SYNCING} AND keyUnlocked. | matrix-client/state | packages/matrix-client/src/state/atoms.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| ready flips true too early | Removing the !keyUnlocked clause from readinessAtom. | UI enables mutations before recovery proven; encrypted records become unreadable. | Re-read readinessAtom in state/atoms.ts; it must return needs_recovery_key while keyUnlocked is false. |
| Listener leak | Removing the detach() call before a new client starts. | Multiple Sync handlers double-update atoms after a sign-out/sign-in cycle. | Re-read attachListeners + start in state/actions.ts; detach must run before re-attach. |
| Sign-out strands key uploads | Removing the pendingBackup > 0 guard in signOut. | Recent keys never reach backup; future devices can't decrypt. | Re-read signOut in state/actions.ts; guard must remain. |
| Scope re-created per render | Replacing the globalThis singleton with a per-call createScope. | Long-lived client torn down on StrictMode/route remount. | grep -n matrix_client_scope state/scope.ts; one keyed instance. |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| MatrixContextValue (c3-211) | Contract | New fields must be backed by an atom here and read via useAtom in the provider. | packages/matrix-client/src/react/provider.tsx |
| NotReadyReason union | Contract | New kinds must also be mapped in web/src/lib/not-ready-message.ts (c3-103). | web/src/lib/not-ready-message.ts |
