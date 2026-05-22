---
id: c3-115
c3-seal: 07969e2977fcb834fa97f65b0f2160e3288ab018d85870627abe0239216466bc
title: patient-detail
type: component
category: feature
parent: c3-1
goal: |-
    Render a single patient: profile card, revision history thread, and
    encrypted chat timeline with diagnostic UTD rendering when decryption
    fails.
uses:
    - ref-key-gate
    - ref-room-per-patient
    - rule-key-gate-disable
    - rule-toast-error-shape
---

## Goal

Render a single patient: profile card, revision history thread, and
encrypted chat timeline with diagnostic UTD rendering when decryption
fails.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | src/app/patients/[roomId]/page.tsx |
| Mounts at | src/components/patient-detail.tsx |

## Purpose

Owns: profile card, ProfileHistory (thread of past revisions with
diffs), encrypted chat timeline, send-message form, edit-profile
dialog trigger (delegates to patient-form), Undecryptable message
diagnostic panel.

Non-goals: write mutations (delegated to `sendMessage`/`updatePatient`
in patients-domain), recovery-key UX, clinic gate.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Provider status === "ready"; route param roomId decoded. | c3-118 |
| Inputs | roomId from URL; provider state. | c3-118 |
| State | patient, messages, history, text, sending. | c3-107 |
| Shared deps | getPatient, listMessages, listPatientHistory, sendMessage, subscribeRooms, EditPatientDialog. | c3-104 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | The user sees profile + history + chat for one room, gated by ready. | ref-room-per-patient |
| Primary path | mount -> subscribeRooms -> getPatient/listMessages/listPatientHistory -> render. | ref-room-per-patient |
| Alternates | Decryption failure renders <UndecryptableMessage> with FAILURE_HINTS and a Copy-diagnostic button. | ref-room-per-patient |
| Failure | Send errors surface via toast.error. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Disable on !ready | hard | Send button + Edit profile button both gated. |
| rule-key-gate-disable | rule | Disable + tooltip | hard | Both buttons follow the golden pattern. |
| ref-room-per-patient | ref | History as thread | hard | ProfileHistory flattens replies into newest-first revisions. |
| rule-toast-error-shape | rule | Catch shape | hard | Send-form and copy-diagnostic both follow the golden shape. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <PatientDetail roomId={...} /> | IN | Renders profile + history + chat for one room. | React | src/components/patient-detail.tsx |
| Send form | OUT | Calls sendMessage; disabled when !ready. | provider | src/components/patient-detail.tsx |
| Undecryptable panel | OUT | Shows FAILURE_HINTS[code] + Copy-diagnostic button. | local | src/components/patient-detail.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Decrypted bodies leaked into the UTD branch | Removing the isDecryptionFailure() check. | UTD panel shows decoded body. | src/components/patient-detail.tsx |
| Chat send works while locked | Dropping the ready check on the form. | Sending while sync is broken. | src/lib/matrix/provider.tsx |
| History diff regression | Changing RECORD_FIELDS without updating diffRevisions. | Diffs omit a field. | src/components/patient-detail.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| FAILURE_HINTS keys | Contract | Must stay aligned with matrix-js-sdk decryption-failure codes. | src/components/patient-detail.tsx |
