---
id: c3-204
c3-seal: ae3ff661f8595b23a3573e120c2120bafb1b2acf1e691f0b79795b3a5a6ab9a7
title: wipe
type: component
category: foundation
parent: c3-2
goal: Sweep every browser-local trace of a Matrix session (IndexedDB databases, localStorage keys, sessionStorage keys, in-memory SSSS cache) so sign-out leaves no residue that a subsequent sign-in could pick up. Used at sign-out and as the recovery hatch when schema changes invalidate stored shapes.
uses:
    - ref-client-only
    - ref-recovery-key
    - rule-no-data-migration
    - rule-no-direct-sdk-import
---

## Goal

Sweep every browser-local trace of a Matrix session (IndexedDB databases, localStorage keys, sessionStorage keys, in-memory SSSS cache) so sign-out leaves no residue that a subsequent sign-in could pick up. Used at sign-out and as the recovery hatch when schema changes invalidate stored shapes.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | foundation |
| Consumers | c3-211 matrix-provider (teardownClient); ad-hoc dev/debug invocation. |
| External deps | Browser window.indexedDB, window.localStorage, window.sessionStorage. |
| Persistence | None — purely deletes. |

## Purpose

Owns: `wipeLocalMatrixData()` which (a) clears the in-memory SSSS cache via `clearCachedSecurityKey()`, (b) sweeps localStorage and sessionStorage of any key starting with `mx_`, `matrix-app.`, or `matrix-js-sdk`, and (c) deletes every IndexedDB database whose name starts with `matrix-app:`, `matrix-app-crypto:`, `matrix-js-sdk:`, or `@matrix-org/`. File: `packages/matrix-client/src/wipe.ts`.

Non-goals: server-side logout (handled by `client.logout()` in the provider before wipe), session token rotation, account-level data removal.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Browser context (typeof window !== "undefined"); function early-returns on SSR. | ref-client-only |
| Inputs | None. | ref-matrix-js-sdk |
| State | None internal — interacts only with browser storage. | ref-client-only |
| Shared deps | clearCachedSecurityKey from c3-203. | ref-recovery-key |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | After resolve, a fresh sign-in on the same browser starts with no leftover keys, sessions, or cached crypto state. | ref-recovery-key |
| Primary path | clearCachedSecurityKey() -> sweep localStorage -> sweep sessionStorage (try/catch — may be unavailable) -> indexedDB.databases() -> filter by prefix -> deleteDatabase each in parallel. | ref-matrix-js-sdk |
| Alternates | Firefox lacks indexedDB.databases(); wipe early-returns after the storage sweep. Re-login on Firefox relies on stable per-(userId, deviceId) DB names. | rule-no-data-migration |
| Failure | Every DB delete is wrapped — success, error, and blocked all resolve so a stuck DB doesn't hang sign-out. | rule-no-data-migration |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-recovery-key | ref | SSSS cache reset | hard | Clears the in-memory key before the storage sweep so the next sign-in's SSSS callback returns null. |
| ref-client-only | ref | Browser-only execution | hard | Module is "use client" and early-returns on SSR. |
| rule-no-data-migration | rule | The escape hatch | hard | When a persisted shape drifts, wipe + re-create is the prescribed remedy. |
| rule-no-direct-sdk-import | rule | SDK isolation | hard | Wipe does not import from matrix-js-sdk; it only touches browser storage. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| wipeLocalMatrixData() | OUT | Async function that resolves after best-effort wipe; never rejects. | browser storage | packages/matrix-client/src/wipe.ts |
| DB prefix allowlist | OUT | matrix-app:, matrix-app-crypto:, matrix-js-sdk:, @matrix-org/ — keep aligned with c3-201 store names. | IndexedDB | packages/matrix-client/src/wipe.ts |
| Storage prefix allowlist | OUT | mx_, matrix-app., matrix-js-sdk — covers session marker + SDK device keys. | Web Storage | packages/matrix-client/src/wipe.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Prefix drift orphans data | c3-201 changes its matrix-app: DB prefix without updating DB_PREFIXES. | Sign-out leaves an IndexedDB DB behind; subsequent sign-in inherits ghost rooms. | Run git grep -n matrix-app packages/matrix-client/src — prefixes must match between wipe.ts and client.ts |
| Throw on blocked DB | Removing the onblocked resolver. | Sign-out hangs while a second tab keeps the DB open. | Re-read deleteDatabase in packages/matrix-client/src/wipe.ts; all three callbacks must call resolve() |
| SSR crash | Reintroducing a top-level window access. | Build breaks during Next.js prerender. | grep -n typeof packages/matrix-client/src/wipe.ts |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| DB prefix list | Contract | Must stay aligned with c3-201's store names; any new store prefix must be added here. | packages/matrix-client/src/wipe.ts |
| Storage prefix list | Contract | Must cover every key the package or app writes. | packages/matrix-client/src/wipe.ts |
