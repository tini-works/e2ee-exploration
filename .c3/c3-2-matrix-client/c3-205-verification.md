---
id: c3-205
c3-seal: 0224ce7c2af5b1cb558408a067501030539373d3c9fe178c8966138db887e95e
title: verification
type: component
category: foundation
parent: c3-2
goal: Read the current cross-signing trust state for the active device so the status bar can display "Device verified" / "Device unverified" / "Checking…" without forcing every consumer to call into the crypto-api directly.
uses:
    - ref-client-only
    - ref-matrix-js-sdk
    - ref-recovery-key
---

## Goal

Read the current cross-signing trust state for the active device so the status bar can display "Device verified" / "Device unverified" / "Checking…" without forcing every consumer to call into the crypto-api directly.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | foundation |
| Consumers | useDeviceVerification hook in packages/matrix-client/src/react/verification.ts, which the status-bar (c3-111) consumes. |
| External deps | matrix-js-sdk (MatrixClient, crypto-api). |
| Persistence | None — pure read. |

## Purpose

Owns: the `DeviceVerification` type (`{ deviceVerified, userVerified }`) and `getDeviceVerification(client)` which probes `crypto.getDeviceVerificationStatus(userId, deviceId)` and `crypto.getUserVerificationStatus(userId)` in parallel, returning `null` when crypto isn't ready yet and `{ deviceVerified: false, userVerified: false }` if the probe throws. File: `packages/matrix-client/src/verification.ts`.

Non-goals: cross-signing setup (handled by c3-203 secret-storage), device verification UX, interactive trust acceptance. This module is read-only.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Caller holds a MatrixClient that has run initRustCrypto. | ref-matrix-js-sdk |
| Inputs | client: MatrixClient. | ref-matrix-js-sdk |
| State | None — stateless probe. | ref-client-only |
| Shared deps | None internal; relies on the SDK's crypto-api. | ref-recovery-key |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Caller receives a typed verification snapshot or null while crypto is still initializing. | ref-matrix-js-sdk |
| Primary path | getCrypto() -> read user id + device id -> Promise.all([getDeviceVerificationStatus, getUserVerificationStatus]) -> map signedByOwner and isCrossSigningVerified() into booleans. | ref-recovery-key |
| Alternates | Either probe throws -> returns { deviceVerified: false, userVerified: false } so the UI shows "unverified" instead of crashing. | rule-toast-error-shape |
| Failure | Crypto missing -> returns null; UI shows "Device …" placeholder. | ref-key-gate |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-matrix-js-sdk | ref | SDK access | hard | Calls into crypto-api directly; isolates that surface from the web app. |
| ref-client-only | ref | Module directive | hard | Marked "use client". |
| ref-recovery-key | ref | Trust state | soft | Successful unlock causes signedByOwner to flip true on the next probe. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| getDeviceVerification(client) | OUT | Returns Promise<DeviceVerification> or null. Never throws. | matrix-client | packages/matrix-client/src/verification.ts |
| DeviceVerification type | OUT | { deviceVerified: boolean; userVerified: boolean }. | matrix-client | packages/matrix-client/src/verification.ts |
| Null contract | OUT | null means "crypto not ready", which UI must render as a checking state. | matrix-client | packages/matrix-client/src/verification.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Throw on cold call | Removing the try/catch wrapping the probe. | First-after-sign-in render crashes the status-bar. | Re-read getDeviceVerification in packages/matrix-client/src/verification.ts; try/catch must wrap the Promise.all |
| Lying about trust state | Conflating userVerified with deviceVerified. | Status bar shows "Device verified" before the SSK has signed it. | Compare the mapping in packages/matrix-client/src/verification.ts against the SDK's signedByOwner getter |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| useDeviceVerification hook | Contract | The hook re-runs the probe on DevicesUpdated, UserTrustStatusChanged, KeysChanged. | packages/matrix-client/src/react/verification.ts |
