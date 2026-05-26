---
id: c3-211
c3-seal: 3e535e136ca089b31dd6cefdc9dbc9fbb42ac5cbb7360cec5c0777fedff73ceb
title: matrix-provider
type: component
category: feature
parent: c3-2
goal: Hold the long-lived `MatrixClient` for the React tree and expose a single `useMatrix()` hook that surfaces every cross-cutting Matrix state the app needs (status, syncState, lastSyncedAt, cryptoStatus, pendingBackup, ready, notReadyReason, session) plus the imperative methods (`signIn`, `signOut`, `resetBackup`, `markKeyUnlocked`). It is the only component in the package that owns React state.
uses:
    - ref-client-only
    - ref-key-gate
    - ref-matrix-js-sdk
    - ref-recovery-key
    - rule-key-gate-disable
---

## Goal

Hold the long-lived `MatrixClient` for the React tree and expose a single `useMatrix()` hook that surfaces every cross-cutting Matrix state the app needs (status, syncState, lastSyncedAt, cryptoStatus, pendingBackup, ready, notReadyReason, session) plus the imperative methods (`signIn`, `signOut`, `resetBackup`, `markKeyUnlocked`). It is the only component in the package that owns React state.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | feature |
| Consumers | Mounted by web/src/app/layout.tsx; every web component consumes useMatrix(). |
| External deps | matrix-js-sdk (ClientEvent, HttpApiEvent, MatrixClient), matrix-js-sdk/lib/crypto-api (CryptoEvent). |
| Persistence | Reads/writes the StoredSession JSON under sessionStorageKey in localStorage. |

## Purpose

Owns: the `Status` union (`initializing`, `idle`, `connecting`, `ready`, `error`); the `NotReadyReason` union; the `CryptoStatus` shape; the `MatrixContextValue` exposed to consumers; client bootstrap (calls c3-201 `createMatrixClient` after resuming/creating a session); attach/detach of SDK listeners (`Sync`, `KeysChanged`, `KeyBackupStatus`, `KeyBackupDecryptionKeyCached`, `DevicesUpdated`, `KeyBackupSessionsRemaining`, `SessionLoggedOut`); `signIn(input)` flow; `signOut()` flow with the "still uploading" guard; `resetBackup(securityKey)` flow; `teardownClient` (logout-with-timeout, stopClient, clearStores, `wipeLocalMatrixData`); the `ready` / `notReadyReason` derivation memo. File: `packages/matrix-client/src/react/provider.tsx`.

Non-goals: rendering anything (no UI); SSSS / recovery-key mechanics (delegated to c3-203); patient domain (c3-210); device verification (c3-205); peer-key-share state (c3-206); invite enumeration (c3-212).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Mounted as a top-level provider. SSR-safe: loadSession early-returns when window is undefined. | ref-client-only |
| Inputs | sessionStorageKey? prop (defaults to DEFAULT_SESSION_STORAGE_KEY); signIn takes LoginInput; resetBackup takes the existing recovery key. | ref-recovery-key |
| State | client, session, status, error, syncState, lastSyncedAt, cryptoStatus, pendingBackup, keyUnlockedThisSession, plus refs startedRef, detachRef, cleanupRef. | ref-client-only |
| Shared deps | c3-201 createMatrixClient/loginWithPassword; c3-203 cacheSecurityKey/getStatus/hasCachedBackupDecryptionKey; c3-204 wipeLocalMatrixData; c3-202 DEFAULT_SESSION_STORAGE_KEY/StoredSession. | ref-recovery-key |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | App tree has a single source of truth for Matrix lifecycle; UI can render gating purely from status + ready. | ref-key-gate |
| Primary path | Mount -> loadSession -> if present start(session) (-> createMatrixClient -> attachListeners -> refreshCryptoStatus -> hasCachedBackupDecryptionKey may flip keyUnlockedThisSession) -> setStatus("ready"). Otherwise setStatus("idle"). | ref-key-gate |
| Alternates | signIn(input) -> loginWithPassword -> persist StoredSession -> start(session). resetBackup(key) -> cacheSecurityKey -> crypto.resetKeyBackup -> loadSessionBackupPrivateKeyFromSecretStorage (best-effort) -> decryptAllEvents for every room -> flip keyUnlockedThisSession true. | ref-recovery-key |
| Failure | start catches client-create failures and surfaces status = "error" with error message. signOut rejects if pendingBackup > 0 so we never strand un-uploaded keys. SessionLoggedOut event triggers a forced local cleanup. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Single gate | hard | The ready / notReadyReason memo is the authoritative gate everyone reads. |
| ref-recovery-key | ref | Unlock plumbing | hard | markKeyUnlocked is the only way to flip keyUnlockedThisSession true; called by status-bar and resetBackup. |
| ref-client-only | ref | "use client" | hard | loadSession checks for window. |
| ref-matrix-js-sdk | ref | SDK boundary | hard | Listeners attach to SDK enums; the dynamic import("matrix-js-sdk") is the only such site outside c3-201. |
| rule-key-gate-disable | rule | UI gate | hard | Provider supplies the ready boolean and notReadyReason shape consumers must use. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <MatrixProvider> | IN | Mounted once at the layout root; reads/writes sessionStorageKey in localStorage. | React + localStorage | packages/matrix-client/src/react/provider.tsx |
| useMatrix() | OUT | Returns MatrixContextValue; throws when used outside <MatrixProvider>. | React | packages/matrix-client/src/react/provider.tsx |
| ready derivation | OUT | True iff status === "ready" AND syncState in {PREPARED, SYNCING} AND keyUnlockedThisSession. | matrix-client/react | packages/matrix-client/src/react/provider.tsx |
| signOut guard | OUT | Rejects with "still uploading" message when pendingBackup > 0. | matrix-client/react | packages/matrix-client/src/react/provider.tsx |
| resetBackup | OUT | Caches the supplied key, resets backup on the server, reloads private key, re-decrypts every room, flips keyUnlockedThisSession. | matrix-client/react | packages/matrix-client/src/react/provider.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Listener leak | Removing the detach function or the detachRef.current() call. | Multiple sync handlers double-update state after a sign-out / sign-in cycle. | Re-read attachListeners and teardownClient in packages/matrix-client/src/react/provider.tsx; detach must run before the new client starts |
| ready flips true too early | Removing keyUnlockedThisSession from the memo deps. | UI enables mutations before the user proved recovery; encrypted records become unreadable. | Re-read the ready memo in packages/matrix-client/src/react/provider.tsx; condition must require both sync + key-unlocked |
| Sign-out strands key uploads | Removing the pendingBackup > 0 guard in signOut. | Recent keys never reach backup; future devices can't decrypt. | Re-read signOut in packages/matrix-client/src/react/provider.tsx; guard must remain |
| SessionLoggedOut not handled | Removing the HttpApiEvent.SessionLoggedOut listener. | Token expiry leaves the UI in a "ready" zombie state. | grep -n SessionLoggedOut packages/matrix-client/src/react/provider.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| MatrixContextValue | Contract | New fields must be added to the memo deps and value object together. | packages/matrix-client/src/react/provider.tsx |
| NotReadyReason union | Contract | New kinds must also be mapped in web/src/lib/not-ready-message.ts (c3-103). | web/src/lib/not-ready-message.ts |
