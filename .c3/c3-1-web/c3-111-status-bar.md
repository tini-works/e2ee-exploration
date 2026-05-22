---
id: c3-111
c3-seal: c43735ba3a6e657cc3e2d189a8781d7ed7cc4928615ce3d3354a428e412de14e
title: status-bar
type: component
category: feature
parent: c3-1
goal: |-
    Surface sync, encryption, backup, invites, and recovery-key state in
    one strip, and host the modals that unlock the session, reset the
    backup, manage invites, and sign out.
uses:
    - ref-key-gate
    - ref-recovery-key
    - ref-toast-feedback
    - rule-no-confirm
    - rule-toast-error-shape
---

## Goal

Surface sync, encryption, backup, invites, and recovery-key state in
one strip, and host the modals that unlock the session, reset the
backup, manage invites, and sign out.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | app-shell (header) |
| Mounts at | src/components/status-bar.tsx |

## Purpose

Owns: status badges (`Ready`, sync, E2E, backup, pending uploads,
invites), user-ID copy button, the Recovery-key modal (Enter or
Generate based on `hasSecretStorage`), the Reset-backup modal, the
Pending-invites modal, the Sign-out modal.

Non-goals: secret-storage cryptography (delegates to c3-103), client
lifecycle (delegates to c3-102), patient data.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | provider status === "ready" (returns null otherwise). | c3-102 |
| Inputs | All of useMatrix() plus user clicks. | c3-102 |
| State | Local useState for each modal's open/busy/text. | c3-107 |
| Shared deps | unlockWithSecurityKey, generateRecoveryKey, hasSecretStorage from secret-storage. | c3-103 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | User can unlock the session, refresh status, manage invites, and sign out. | ref-key-gate |
| Primary path (unlock) | Recovery-key modal -> unlockWithSecurityKey -> markKeyUnlocked -> success toast. | ref-recovery-key |
| Primary path (generate) | First-time setup -> generateRecoveryKey -> show key once -> Copy/Saved. | ref-recovery-key |
| Alternates | Reset-backup modal calls resetBackup on the provider; also flips keyUnlockedThisSession. | ref-recovery-key |
| Failure | Each modal's catch routes through toast.error(err instanceof Error ? err.message : String(err)). | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-recovery-key | ref | One-key UX | hard | No import/export/upload buttons. |
| ref-toast-feedback | ref | Toast + Dialog | hard | All modals are shadcn Dialogs. |
| rule-no-confirm | rule | No window.confirm | hard | Sign-out goes through a <Dialog> with destructive variant. |
| rule-toast-error-shape | rule | Error formatting | hard | Every modal's catch matches the golden shape. |
| ref-key-gate | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <StatusBar /> | IN | Returns null outside status="ready". | React | src/components/status-bar.tsx |
| Recovery-key flow | OUT | Calls markKeyUnlocked() only after unlockWithSecurityKey or generateRecoveryKey succeeds. | provider | src/components/status-bar.tsx |
| Sign-out button | OUT | Disabled while pendingBackup > 0. | provider | src/components/status-bar.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| markKeyUnlocked without proof | Flipping the flag in another modal. | Provider ready true without backup loaded. | src/lib/matrix/provider.tsx |
| Generated key not displayed | Closing modal before the user sees it. | User signed-in but can't decrypt history on a second device. | src/components/status-bar.tsx |
| Sign-out during pending backup | pendingBackup > 0 not checked. | Lost message keys after sign-out. | src/lib/matrix/provider.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Sync-label table | Contract | New states must map to Badge variants. | src/components/status-bar.tsx |
