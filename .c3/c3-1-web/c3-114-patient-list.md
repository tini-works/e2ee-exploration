---
id: c3-114
c3-seal: bbd46d3a8d40c2c485ea58e443f475be89f757c7c837a0cf1111c1e0a2cddd99
title: patient-list
type: component
category: feature
parent: c3-1
goal: |-
    Render the clinic's patient table — one row per patient room — with
    create, export, and delete actions, all gated on `ready`.
uses:
    - ref-key-gate
    - ref-room-per-patient
    - rule-key-gate-disable
    - rule-no-confirm
    - rule-toast-error-shape
---

## Goal

Render the clinic's patient table — one row per patient room — with
create, export, and delete actions, all gated on `ready`.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | src/app/patients/page.tsx (under clinic-guard). |
| Mounts at | src/components/patient-table.tsx |

## Purpose

Owns: table of patients, "New patient" dialog trigger (delegates to
patient-form), per-row dropdown (Open / Export JSON / Delete), delete
confirmation modal, `subscribeRooms` subscription for live updates.

Non-goals: actual create/update mutation (delegated to
`createPatient`/`updatePatient` via patient-form), clinic-only check
(handled by clinic-guard), single-patient view (patient-detail).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Wrapped in <ClinicGuard>; provider ready decides whether mutations are allowed. | c3-113 |
| Inputs | useMatrix(), query of listPatients(client). | c3-104 |
| State | patients, pendingDelete, deleting. | c3-107 |
| Shared deps | listPatients, deletePatient, subscribeRooms, exportRoomEvents, listPatientHistory, NewPatientDialog. | c3-104 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Each row links to /patients/[roomId]; clinic can create/export/delete. | ref-room-per-patient |
| Primary path | mount -> subscribeRooms -> listPatients -> render rows; row actions call domain functions. | ref-room-per-patient |
| Alternates | "Export JSON" downloads a Blob via URL.createObjectURL. | c3-104 |
| Failure | Errors surface via toast.error. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Disable on !ready | hard | All mutating buttons read ready/notReadyReason. |
| rule-key-gate-disable | rule | Disable + tooltip | hard | Delete menu item disabled with notReadyReason title when not ready. |
| rule-no-confirm | rule | No window.confirm | hard | Delete uses a state-driven <Dialog>. |
| ref-room-per-patient | ref | Source of rows | hard | Rows come from rooms tagged PATIENT_TAG. |
| rule-toast-error-shape | rule | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <PatientTable /> | IN | Mounted under <ClinicGuard>. | React | src/components/patient-table.tsx |
| Row action: Delete | OUT | Calls deletePatient only after the confirm Dialog. | provider | src/components/patient-table.tsx |
| Row action: Export | OUT | Builds { exportedAt, roomId, record, history, events } JSON. | local file | src/components/patient-table.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Delete without confirmation | Wiring Delete to call deletePatient directly. | Click bypasses Dialog. | src/components/patient-table.tsx |
| Export leaks raw decryption keys | Including wireContent when not needed. | Exported JSON contains base64 ciphertext + plain body. | src/lib/matrix/patients.ts |
| Stale rows on remote change | Removing the subscribeRooms effect. | Table doesn't update when invitee joins. | tests/patients-two-browsers.spec.ts |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Row schema | Contract | Adding columns must come with Patient fields. | src/lib/matrix/types.ts |
| Export JSON shape | Contract | Field renames break downstream JSON consumers. | src/components/patient-table.tsx |
