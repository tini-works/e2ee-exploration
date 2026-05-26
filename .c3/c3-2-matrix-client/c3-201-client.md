---
id: c3-201
c3-seal: b4f4166ff61bfc1ab28a98a6f363901f81167f749c581c530ba1c5fda30122cb
title: client
type: component
category: foundation
parent: c3-2
goal: 'Boot a configured `MatrixClient` for a stored session: per-device IndexedDB stores, Rust crypto, first-sync wait, peer-key-share listener attach, and best-effort key-backup restore. Also exposes `loginWithPassword` to turn credentials into a `StoredSession`.'
uses:
    - ref-client-only
    - ref-matrix-js-sdk
    - ref-recovery-key
---

## Goal

Boot a configured `MatrixClient` for a stored session: per-device IndexedDB stores, Rust crypto, first-sync wait, peer-key-share listener attach, and best-effort key-backup restore. Also exposes `loginWithPassword` to turn credentials into a `StoredSession`.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | foundation |
| Consumers | c3-211-matrix-provider (sole call site); transitively all web/ components via the React context |
| External deps | matrix-js-sdk, Rust crypto (initRustCrypto), Synapse homeserver |
| Persistence | IndexedDB (matrix-app:<userId>:<deviceId>, matrix-app-crypto:<userId>:<deviceId>) + localStorage backing the SDK store |

## Purpose

Owns: `loginRequest` against the homeserver (`m.login.password` with a derived `initial_device_display_name`), `IndexedDBStore` / `IndexedDBCryptoStore` setup per `(userId, deviceId)`, `initRustCrypto`, `startClient({ initialSyncLimit: 20 })`, waiting for `SyncState.Prepared` (30s timeout), attaching the peer-key-share to-device listener via `startPeerKeyShare`, and best-effort `checkKeyBackupAndEnable` + `restoreKeyBackup` after first sync.

Non-goals: SSSS / recovery-key UX (c3-203), peer-share state and request orchestration (c3-206), React state and sign-out teardown (c3-211), patient room business logic (c3-210).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | A StoredSession exists (just-issued from loginWithPassword or restored from localStorage by the provider). | ref-matrix-js-sdk |
| Inputs | LoginInput (sign-in path) or StoredSession (resume path). | ref-matrix-js-sdk |
| State | Per-(userId, deviceId) IndexedDB stores; Rust crypto store; no module-local state. | ref-matrix-js-sdk |
| Shared deps | makeCryptoCallbacks from c3-203 (wired as cryptoCallbacks); startPeerKeyShare from c3-206. | ref-recovery-key |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Returns a started, sync-prepared MatrixClient ready for feature calls. | ref-matrix-js-sdk |
| Primary path | dynamic import("matrix-js-sdk") -> create IndexedDBStore + IndexedDBCryptoStore -> createClient with cryptoCallbacks -> initRustCrypto -> startClient -> wait PREPARED/SYNCING -> startPeerKeyShare -> checkKeyBackupAndEnable -> restoreKeyBackup. | ref-matrix-js-sdk |
| Alternates | When no backup decryption key is cached, restoreKeyBackup throws and the surrounding try/catch swallows it; the recovery-key step happens in the status-bar (c3-111). | ref-recovery-key |
| Failure | First-sync timeout (30s) rejects with a "check network, then refresh" message; checkKeyBackupAndEnable and restoreKeyBackup are wrapped in try/catch and never throw upward. | ref-matrix-js-sdk |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-matrix-js-sdk | ref | The single createClient call site for the whole monorepo. | hard | Every other component in c3-2 depends on the client this module returns. |
| ref-client-only | ref | Browser-only execution (uses window.indexedDB, window.localStorage, navigator.userAgent). | hard | Module starts with "use client" and dynamic-imports the SDK. |
| ref-recovery-key | ref | Crypto-callback wiring and best-effort backup restore on bootstrap. | hard | Backup restore is best-effort here; full unlock recipe lives in c3-203. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| loginWithPassword(input) | OUT | Returns a StoredSession populated from the m.login.password response. | network -> Synapse | packages/matrix-client/src/client.ts |
| createMatrixClient(session) | OUT | Returns a MatrixClient past SyncState.Prepared; throws on 30s first-sync timeout. | IndexedDB + Synapse | packages/matrix-client/src/client.ts |
| IndexedDB store names | IN/OUT | matrix-app:${userId}:${deviceId} / matrix-app-crypto:${userId}:${deviceId} so re-login on the same device reuses the same DBs. | IndexedDB | packages/matrix-client/src/client.ts |
| LoginInput | IN | { baseUrl, identityServerUrl?, username, password }. | function arg | packages/matrix-client/src/client.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Sign-in hangs on first sync | Synapse down / slow / cold; flaky local docker. | 30s waitForPrepared timeout rejects with a refresh hint. | docker compose -f docker/compose.yml up -d then pnpm dev and sign in. |
| Stale cached backup key | Account was re-keyed on another device. | restoreKeyBackup throws; the wrapping try/catch swallows it. | Re-enter recovery key via the encryption banner (web/src/components/...status-bar); verify history decrypts. |
| Cross-tab DB lock | Two sessions for the same (userId, deviceId) in two tabs. | store.startup() surfaces an open-lock error. | pnpm test:e2e tests/patients-two-browsers.spec.ts (or equivalent). |
| Peer-share listener never attaches | New code path returns a client before reaching startPeerKeyShare. | UTDs never recover via cross-device forwarding. | Sign in on two devices; force a UTD; confirm c3-206 imports the missing session. |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Device-store DB names | Contract | None — must stay aligned with DB_PREFIXES in c3-204 or sign-out leaves residue. | packages/matrix-client/src/client.ts + packages/matrix-client/src/wipe.ts |
| initial_device_display_name | Foundational Flow | UA-derived label is best-effort; falling back to "Matrix App" is acceptable. | packages/matrix-client/src/client.ts |
