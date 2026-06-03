---
id: c3-113
c3-seal: 6fd6ce1cc0eb2292e4af30586be2bc874692d6b9919ef1b33e7f08314648aafe
title: patient-detail
type: component
category: feature
parent: c3-1
goal: Render a single patient's profile, profile-revision history, and encrypted timeline in one page. Drives message sending and renders detailed diagnostics for unable-to-decrypt events so the user can see why decryption failed and what peer-key-share is doing about it.
uses:
    - ref-encrypted-attachments
    - ref-key-gate
    - ref-recovery-key
    - ref-room-per-patient
    - rule-key-gate-disable
    - rule-no-direct-sdk-import
    - rule-toast-error-shape
---

## Goal

Render a single patient's profile, profile-revision history, and encrypted timeline in one page. Drives message sending and renders detailed diagnostics for unable-to-decrypt events so the user can see why decryption failed and what peer-key-share is doing about it.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | web/src/app/patients/[roomId]/page.tsx (inside app-shell). |
| External deps | matrix-client/react (useMatrix, usePeerKeyShareState), matrix-client (requestKeyFromPeers), matrix-client/patients (getPatient, listMessages, listPatientHistory, sendMessage, subscribeRooms, fullName), matrix-js-sdk type-only (MatrixEvent), sonner. |
| Persistence | None local. |

## Purpose

Owns: profile card (name, dob, phone, email, notes, updated-at, updated-times); the Edit-profile dialog trigger (delegated to patient-form c3-114); the encrypted-timeline pane with message bubbles, a send-message form, and the special `UndecryptableMessage` panel that shows the failure code, hint copy, full diagnostic payload, copy button, and peer-key-share progress; the profile-history `<ol>` with revision diffs. File: `web/src/components/patient-detail.tsx`.

Non-goals: the actual mutations on the record (delegated to patient-form's `updatePatient`); peer-key-share orchestration (delegated to c3-206 peer-key-share); decryption itself (Matrix SDK + key-backup do the work).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Inside <MatrixProvider>; roomId from the route params; client may still be syncing. | ref-room-per-patient |
| Inputs | roomId: string prop; subscribes to room changes via subscribeRooms. | ref-matrix-js-sdk |
| State | patient, messages, history, text, sending. UndecryptableMessage adds peer-share state per session id. | ref-client-only |
| Shared deps | Button, Input, Badge from c3-101; notReadyMessage from c3-103; FAILURE_HINTS map local to this file. | ref-toast-feedback |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Clinic operator (or invited patient) sees the full patient record + history + encrypted chat in one screen, can send messages, and can self-diagnose decryption failures. | ref-room-per-patient |
| Primary path | Mount -> getPatient + listMessages + listPatientHistory -> subscribe -> user sends a message via sendMessage(client, roomId, text). | ref-room-per-patient |
| Alternates | UTD events render UndecryptableMessage which fires requestKeyFromPeers once per session id and listens to usePeerKeyShareState(sessionId) for status text; users may copy the diagnostic payload via the Copy button. | ref-recovery-key |
| Failure | sendMessage rejects -> toast.error. Patient not yet synced -> "Loading room..." placeholder. Each UTD code maps to a hint copy line. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-room-per-patient | ref | Profile + thread model | hard | Profile history walks the thread; current record is the latest revision. |
| ref-recovery-key | ref | UTD diagnostics | soft | Hint copy explains how a missing recovery key surfaces as HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED and related codes. |
| ref-key-gate | ref | Send + edit gating | hard | Send input and Edit button disabled when !ready. |
| rule-key-gate-disable | rule | Disabled mutations | hard | Send button disable expression covers sending, empty input, and !ready. |
| rule-no-direct-sdk-import | rule | Type-only SDK use | hard | MatrixEvent is imported as a type only; runtime calls go through the package. |
| rule-toast-error-shape | rule | Send-error toast | hard | Currently uses single-arg toast.error; the rule's headline + description shape is the target. |
| ref-encrypted-attachments | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <PatientDetail roomId={roomId} /> | IN | Renders one patient page; subscribes to room changes. | React | web/src/components/patient-detail.tsx |
| UndecryptableMessage | OUT | Renders failure code, hint, diagnostic block, peer-share status; fires requestKeyFromPeers once per session id. | matrix-client | web/src/components/patient-detail.tsx |
| Send-message form | OUT | Calls sendMessage(client, roomId, body); disabled when !ready, while sending, or when input is empty. | matrix-client/patients | web/src/components/patient-detail.tsx |
| Profile-history <ol> | OUT | Newest revision first; revisions diff against the previous entry using RECORD_FIELDS. | React | web/src/components/patient-detail.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| UTD pane stops requesting peer keys | Removing the requestKeyFromPeers effect inside UndecryptableMessage. | Cross-device key forwarding never fires; users continue to see UTDs. | Re-read UndecryptableMessage in web/src/components/patient-detail.tsx; the effect must remain |
| Diagnostic payload leaks decrypted content | Including event.getContent() in the diagnostic block. | Sensitive content lands in the copied diagnostic. | Inspect the lines array in web/src/components/patient-detail.tsx; only wire metadata is included |
| Send fires before sync prepared | Removing !ready from the disable check. | Outgoing messages encrypted against a partial session; recipients see UTD. | Re-read the form in web/src/components/patient-detail.tsx; disable must cover sending, empty input, and !ready |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| FAILURE_HINTS map | Contract | Hint copy may evolve; codes must match decryptionFailureReason enum from matrix-js-sdk. | web/src/components/patient-detail.tsx |
| peerKeyShareLine mapping | Contract | Text may evolve; each PeerKeyShareState.kind must map to a line. | web/src/components/patient-detail.tsx |
