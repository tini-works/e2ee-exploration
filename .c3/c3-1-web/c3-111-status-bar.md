---
id: c3-111
c3-seal: a573e6fc7a8314d4c520572f18e1606d3aa519e98e6d58b761954b07b5f8c6ae
title: status-bar
type: component
category: feature
parent: c3-1
goal: 'Single horizontal bar above feature content that exposes every cross-cutting Matrix state in one place: sync status, encryption readiness, device verification, key-backup version and upload progress, pending room invites, recovery-key entry/generation, backup reset, and sign-out. It is the only feature surface allowed to render while `ready` is false because it owns the recovery-key entry UI.'
uses:
    - ref-key-gate
    - ref-recovery-key
    - ref-toast-feedback
    - rule-key-gate-disable
    - rule-no-confirm
    - rule-no-direct-sdk-import
---

## Goal

Single horizontal bar above feature content that exposes every cross-cutting Matrix state in one place: sync status, encryption readiness, device verification, key-backup version and upload progress, pending room invites, recovery-key entry/generation, backup reset, and sign-out. It is the only feature surface allowed to render while `ready` is false because it owns the recovery-key entry UI.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | app-shell (c3-104) — rendered in the authenticated header. |
| External deps | matrix-client (generateRecoveryKey, hasSecretStorage, unlockWithSecurityKey), matrix-client/react (useMatrix, useDeviceVerification, usePatientInvites), lucide-react, sonner. |
| Persistence | None directly; calls unlockWithSecurityKey which writes the SSSS key into the rust crypto store. |

## Purpose

Owns: status badges (sync state, ready/read-only, encryption, device verified, backup version, pending-upload count, pending-invite count, last-synced label); the account popover (user id / device id copy, recovery key, reset backup, sign out); the recovery-key modal with three modes (generate, enter, save-shown-key); the reset-backup modal; the sign-out confirm modal; the pending-invite list with accept/decline. File: `web/src/components/status-bar.tsx`.

Non-goals: actual SSSS / cross-signing mechanics (delegated to c3-203 secret-storage), backup-key plumbing (delegated to c3-203 + c3-211 matrix-provider), peer-key-share state for individual events (rendered inside c3-113 patient-detail).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Provider status === "ready". Renders nothing otherwise. | ref-key-gate |
| Inputs | None — reads everything from useMatrix(), useDeviceVerification(), usePatientInvites(). | ref-matrix-js-sdk |
| State | Local useState for each modal open flag, in-flight booleans (keying, resetting, signingOut), hasSSSS probe result, and the generated-key buffer. | ref-client-only |
| Shared deps | Badge, Button, Label, PasswordInput, Dialog, Popover from c3-101; toast from sonner. | ref-toast-feedback |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | User can observe Matrix state, complete the recovery-key step that flips ready to true, accept/decline invites, reset backup, or sign out. | ref-recovery-key |
| Primary path | First sign-in -> Recovery-key modal probes hasSecretStorage -> Generate flow runs generateRecoveryKey({ password }), shows the encoded key once, copy button, then markKeyUnlocked(). Subsequent sessions -> Enter flow accepts the key and runs unlockWithSecurityKey. | ref-recovery-key |
| Alternates | Reset backup flow: prompts recovery key, calls resetBackup which re-keys SSSS and triggers a re-upload. Pending invites flow: accept goes through usePatientInvites().accept (tags room as patient) or decline (leaves room). | ref-room-per-patient |
| Failure | Every async path is wrapped in try/catch -> toast.error(...). Sign-out is disabled while pendingBackup > 0 so we never strand un-uploaded keys. Sign-out also triggers a beforeunload warning while uploads are in flight (handled at app-shell). | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-recovery-key | ref | Recovery-key UX | hard | Generate + Enter modes; calls generateRecoveryKey / unlockWithSecurityKey exactly once per attempt. |
| ref-key-gate | ref | Self-exemption | hard | Allowed to render while ready=false; it is the only surface that flips ready to true. |
| ref-toast-feedback | ref | Toast usage | hard | Every async success/error path goes through sonner. |
| rule-no-confirm | rule | Confirm modals | hard | Sign-out, delete-room, reset-backup all render shadcn <Dialog> instead of confirm. |
| rule-key-gate-disable | rule | Self-exemption | hard | Explicit exception documented in the rule's Override section. |
| rule-no-direct-sdk-import | rule | Imports | hard | Imports come from matrix-client and matrix-client/react only. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <StatusBar /> | IN | Renders only when provider status === "ready". | React | web/src/components/status-bar.tsx |
| Recovery-key modal | IN/OUT | Probes hasSecretStorage; runs Generate vs Enter; calls markKeyUnlocked() on success. | matrix-client | web/src/components/status-bar.tsx |
| Reset-backup modal | IN/OUT | Requires the existing recovery key as input; calls resetBackup(securityKey) from the provider. | matrix-client | web/src/components/status-bar.tsx |
| Sign-out flow | IN/OUT | Disabled while pendingBackup > 0; calls signOut() from the provider. | matrix-client | web/src/components/status-bar.tsx |
| Pending-invites pill | OUT | Opens a dialog listing usePatientInvites().invites; accept/decline call into that hook. | React | web/src/components/status-bar.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Generate path drops the shown key | Closing the modal before the user saves it. | User loses access to encrypted history. | Inspect web/src/components/status-bar.tsx Save-key dialog: Close must require a click after the key is shown |
| Sign-out strands key uploads | Removing the pendingBackup > 0 disable. | Keys never reach backup; future devices can't decrypt. | Re-read the sign-out menu item in web/src/components/status-bar.tsx; disabled={pendingBackup > 0} must be present |
| Probe race shows wrong modal | hasSecretStorage runs without the cancellation flag and resolves after close. | Generate dialog flashes after user already entered a key. | Re-read the hasSSSS effect in web/src/components/status-bar.tsx; cancellation flag required |
| Reset modal omits the key input | Treating Reset as a no-arg action. | resetBackup rejects because SSSS can't decrypt the new backup key. | Re-read the Reset dialog in web/src/components/status-bar.tsx; <PasswordInput id="reset-security-key"> must be present and required |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Sync state -> badge mapping | Contract | Wording may evolve but every SDK SyncState value must map to a label and variant. | web/src/components/status-bar.tsx |
| Recovery-key dialog copy | Contract | Wording may evolve; the Save-key dialog must keep "this is the only time it will be shown". | web/src/components/status-bar.tsx |
