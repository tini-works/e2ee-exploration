---
id: c3-105
c3-seal: f9aa349e463842e5a4e3afca64a8eb87ba213b5376194796e213fb71ff179d0a
title: local-wipe
type: component
category: foundation
parent: c3-1
goal: |-
    Delete every browser-local trace of the Matrix session on sign-out so
    the next user starts clean and the recovery-key gate cannot be
    trivially bypassed by reading old IndexedDB stores.
uses:
    - ref-client-only
    - ref-recovery-key
    - ref-room-per-patient
---

## Goal

Delete every browser-local trace of the Matrix session on sign-out so
the next user starts clean and the recovery-key gate cannot be
trivially bypassed by reading old IndexedDB stores.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | matrix-provider (signOut teardown) |
| Storage touched | IndexedDB + localStorage + sessionStorage |

## Purpose

Owns: `wipeLocalMatrixData()`. Enumerates `window.indexedDB.databases()`
(when available) and removes every DB whose name starts with one of
the known prefixes; sweeps `localStorage`/`sessionStorage` for
`mx_`, `matrix-app.`, `matrix-js-sdk*`. Also clears the in-memory SSSS
cache via `clearCachedSecurityKey`.

Non-goals: revoking the access token (provider calls `logout(true)`),
stopping the client (provider calls `stopClient`), UI state reset.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | MatrixClient.logout() and clearStores() already called (or unavailable). | c3-102 |
| Inputs | None; reads window.indexedDB.databases(). | ref-client-only |
| State | None (pure side effects on browser storage). | ref-client-only |
| Shared deps | clearCachedSecurityKey from secret-storage. | c3-103 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | No Matrix-prefixed DBs or storage keys remain. | ref-room-per-patient |
| Primary path | clearCachedSecurityKey -> sweep localStorage -> sweep sessionStorage -> list IndexedDB -> delete matching DBs. | ref-recovery-key |
| Alternates | Firefox lacks indexedDB.databases() — function returns early; DBs are reused on next login by (userId, deviceId) namespace. | c3-101 |
| Failure | Each deleteDatabase resolves on success/error/blocked; never throws upward. | ref-client-only |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-client-only | ref | Browser-only window.indexedDB and localStorage access | hard | Module is "use client". |
| ref-recovery-key | ref | In-memory SSSS cache lifecycle | hard | Must call clearCachedSecurityKey before deleting on-disk crypto stores. |
| ref-room-per-patient | ref | Encrypted room data lives in the wiped IndexedDB | soft | DB prefixes here must cover every patient room's storage. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| wipeLocalMatrixData() | OUT | Awaits all deletes; never throws. | browser storage | src/lib/matrix/wipe.ts |
| DB prefixes | IN | matrix-app:, matrix-app-crypto:, matrix-js-sdk:, @matrix-org/ | IndexedDB | src/lib/matrix/wipe.ts |
| LocalStorage prefixes | IN | mx_, matrix-app., matrix-js-sdk | localStorage | src/lib/matrix/wipe.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| New DB prefix introduced | client.ts uses a new dbName template. | New DBs survive sign-out. | src/lib/matrix/client.ts |
| LocalStorage drift | New keys written under a new prefix. | localStorage shows residue after sign-out. | src/lib/matrix/wipe.ts |
| Wipe blocks sign-out | Synchronous block in deleteDatabase. | Sign-out UI hangs. | src/lib/matrix/provider.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Wipe prefix list | Contract | New SDK versions adding namespaces require updating both DB_PREFIXES and STORAGE_PREFIXES. | src/lib/matrix/wipe.ts |
