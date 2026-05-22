---
id: c3-102
c3-seal: 85065237c6250593fe2de91cc8769d6de50296307e663625a73661f617f28dec
title: matrix-provider
type: component
category: foundation
parent: c3-1
goal: |-
    Own the single `MatrixClient` lifecycle inside React: load the stored
    session on mount, drive sign-in/sign-out, expose readiness, and gate
    every feature behind the recovery-key check.
uses:
    - ref-client-only
    - ref-key-gate
    - ref-matrix-js-sdk
    - ref-recovery-key
---

## Goal

Own the single `MatrixClient` lifecycle inside React: load the stored
session on mount, drive sign-in/sign-out, expose readiness, and gate
every feature behind the recovery-key check.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | All client components via useMatrix() |
| Mounts at | src/app/layout.tsx (one provider per app instance) |

## Purpose

Owns: client startup/teardown sequencing, SDK event listeners (Sync,
Crypto, RoomMembership, HttpApiSessionLoggedOut), `pendingBackup`
beforeunload guard, `keyUnlockedThisSession` flag, the `ready`/
`notReadyReason` derivation, and the `signIn`/`signOut`/`resetBackup`/
`acceptInvite`/`declineInvite` callbacks consumed by features.

Non-goals: actual SDK creation (delegates to matrix-client), recovery
key cryptography (delegates to secret-storage), patient business logic
(delegates to patients-domain).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | StoredSession JSON in localStorage (or none on cold start). | c3-101 |
| Inputs | LoginInput from sign-in; string recovery key from status-bar. | c3-103 |
| State | client, session, status, syncState, cryptoStatus, pendingBackup, keyUnlockedThisSession, pendingInvites. | ref-key-gate |
| Shared deps | matrix-client builder, secret-storage helpers, patients-domain invite helpers, local-wipe sweeper. | ref-matrix-js-sdk |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | A context where ready === true means privileged actions are allowed. | ref-key-gate |
| Primary path | mount -> loadSession -> start (createMatrixClient + attachListeners + getStatus + hasCachedBackupDecryptionKey -> mark unlocked) -> status="ready". | ref-key-gate |
| Alternates | HttpApiEvent.SessionLoggedOut resets state to idle and routes back to sign-in. | c3-101 |
| Failure | start() catches and sets status="error" with error message. | ref-matrix-js-sdk |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | ready derivation, AGENTS.md gate | hard | Only place that flips keyUnlockedThisSession in three known callsites. |
| ref-matrix-js-sdk | ref | client builder dependency | hard | Delegates SDK construction to c3-101. |
| ref-recovery-key | ref | resetBackup recipe | hard | resetBackup must call cacheSecurityKey then resetKeyBackup then loadSessionBackupPrivateKeyFromSecretStorage then decryptAllEvents. |
| ref-client-only | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <MatrixProvider> | IN | One per app, mounted in root layout. | React tree | src/app/layout.tsx |
| useMatrix() | OUT | Returns the Ctx object; throws outside the provider. | React | src/lib/matrix/provider.tsx |
| signOut() | OUT | Throws if pendingBackup > 0; otherwise teardown is fire-and-forget. | IndexedDB + network | src/lib/matrix/provider.tsx |
| ready flag | OUT | True iff status="ready", sync is PREPARED or SYNCING, and keyUnlockedThisSession. | React | ref-key-gate |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Backup keys lost on sign-out | User clicks Sign out while pendingBackup > 0. | signOut() throws; beforeunload guard fires. | src/lib/matrix/provider.tsx |
| ready true without key unlock | New code path flips keyUnlockedThisSession without entering recovery key. | Provider renders ready=true while UTD events appear. | src/lib/matrix/provider.tsx |
| Listener leak across signed-in sessions | attachListeners returns no detacher. | React effect tearing twice. | src/lib/matrix/provider.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Ctx type | Contract | New fields require updating Contract section first. | src/lib/matrix/provider.tsx |
| ready flag semantics | Foundational Flow | None; must match the three-clause guard. | src/lib/matrix/provider.tsx |
