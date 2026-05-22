---
id: c3-101
c3-seal: 5a458581e9d36fe2308c2ae125f6275c486f59441ac5e40610c7986eae8d447a
title: matrix-client
type: component
category: foundation
parent: c3-1
goal: |-
    Boot a configured `MatrixClient` for a stored session: per-device
    IndexedDB stores, rust crypto, first-sync wait, and best-effort backup
    restore.
uses:
    - ref-client-only
    - ref-matrix-js-sdk
    - ref-recovery-key
---

## Goal

Boot a configured `MatrixClient` for a stored session: per-device
IndexedDB stores, rust crypto, first-sync wait, and best-effort backup
restore.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | matrix-provider |
| External deps | matrix-js-sdk, rust crypto, Synapse |
| Persistence | IndexedDB (matrix-app:, matrix-app-crypto:) + localStorage |

## Purpose

Owns: `loginRequest` against the homeserver, `IndexedDBStore`/
`IndexedDBCryptoStore` setup per `(userId, deviceId)`, `initRustCrypto`,
`startClient`, waiting for `SyncState.Prepared`, and best-effort
`checkKeyBackupAndEnable` + `restoreKeyBackup` post-sync.

Non-goals: SSSS, recovery-key UX, room business logic, React state,
sign-out cleanup.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | A StoredSession exists (in memory or localStorage). | ref-matrix-js-sdk |
| Inputs | LoginInput (sign-in) or StoredSession (resume). | ref-matrix-js-sdk |
| State | Per-device IndexedDB stores; rust crypto store. | ref-matrix-js-sdk |
| Shared deps | secret-storage's makeCryptoCallbacks. | ref-recovery-key |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Returns a started, synced MatrixClient. | ref-matrix-js-sdk |
| Primary path | login -> create stores -> initRustCrypto -> startClient -> wait PREPARED -> checkKeyBackupAndEnable -> restoreKeyBackup. | ref-matrix-js-sdk |
| Alternates | restoreKeyBackup fails silently if backup decryption key isn't cached yet (user enters key via status-bar). | ref-recovery-key |
| Failure | First-sync timeout (30s) rejects with a refresh hint. | ref-matrix-js-sdk |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-matrix-js-sdk | ref | SDK + rust crypto choice | hard | This module is the only createClient callsite. |
| ref-client-only | ref | "use client" + dynamic imports | hard | matrix-js-sdk is imported via await import(...). |
| ref-recovery-key | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| loginWithPassword(input) | OUT | Returns StoredSession from m.login.password. | network -> Synapse | src/lib/matrix/client.ts |
| createMatrixClient(session) | OUT | Returns a synced MatrixClient; throws on first-sync timeout. | IndexedDB + Synapse | src/lib/matrix/client.ts |
| IndexedDB stores | IN/OUT | DB names keyed on ${userId}:${deviceId} so re-login reuses them. | IndexedDB | src/lib/matrix/client.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Sign-in hangs on first sync | Synapse down / slow / cold. | 30s timeout rejects. | docker compose -f docker/compose.yml up -d then pnpm dev and sign in. |
| Stale cached backup key | Re-keyed account on another device. | restoreKeyBackup throws; caught. | Re-enter recovery key via status-bar (see src/components/status-bar.tsx). |
| Cross-tab DB lock | Two sessions for same user in two tabs. | store.startup surfaces an open-lock error. | pnpm test:e2e tests/patients-two-browsers.spec.ts. |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| StoredSession shape | Contract | None; field names match matrix-js-sdk login response. | src/lib/matrix/types.ts |
| Device-store DB names | Contract | None | src/lib/matrix/client.ts + src/lib/matrix/wipe.ts (prefixes must stay aligned). |
