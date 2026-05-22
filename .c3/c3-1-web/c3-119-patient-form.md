---
id: c3-119
c3-seal: 20aebf937ad3741459170eaddbdfeb6d84fc2a1121b94211ff2de69b96eb7583
title: patient-form
type: component
category: feature
parent: c3-1
goal: |-
    One set of form fields driving both the New-patient dialog (which can
    also send a Matrix invite) and the Edit-profile dialog, so the data
    shape stays consistent between create and update flows.
uses:
    - ref-key-gate
    - ref-room-per-patient
    - ref-toast-feedback
    - rule-key-gate-disable
    - rule-toast-error-shape
---

## Goal

One set of form fields driving both the New-patient dialog (which can
also send a Matrix invite) and the Edit-profile dialog, so the data
shape stays consistent between create and update flows.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | patient-list (New), patient-detail (Edit). |
| Mounts at | src/components/patient-form.tsx |

## Purpose

Owns: `PatientFormFields` (shared inputs), `NewPatientDialog`
(triggers `createPatient`, also accepting a Matrix-ID invitee), and
`EditPatientDialog`/`EditPatientForm` (triggers `updatePatient` on a
known room). Validates the invite field against `MATRIX_ID_RE` before
calling the domain.

Non-goals: list/table rendering (patient-list), single-patient view
(patient-detail), domain operations (patients-domain).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Provider ready === true (forms disable themselves otherwise). | ref-key-gate |
| Inputs | Form state holding firstName, lastName, dob, phone, email, notes. | c3-104 |
| State | useState per dialog: open, submitting, values, inviteInput. | c3-107 |
| Shared deps | createPatient/updatePatient. | c3-104 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | A new encrypted room with an initial record (and a Matrix invite when supplied), or a new thread revision on edit. | ref-room-per-patient |
| Primary path (new) | open -> fill -> validate invite -> createPatient(client, values, opts) -> toast and reset. | ref-room-per-patient |
| Primary path (edit) | open -> fill -> updatePatient(client, roomId, values) -> toast and close. | ref-room-per-patient |
| Failure | Catch routes through toast.error(err instanceof Error ? err.message : String(err)). | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Disable on !ready | hard | Both DialogTrigger and Submit are disabled with notReadyReason. |
| rule-key-gate-disable | rule | Disable + tooltip | hard | Both buttons match the golden pattern verbatim. |
| ref-toast-feedback | ref | Toast feedback | hard | All submits route through sonner. |
| rule-toast-error-shape | rule | Catch shape | hard | Submit handlers use the literal expression. |
| ref-room-per-patient | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <NewPatientDialog> | IN | Renders a clinic-side "New patient" button. | React | src/components/patient-form.tsx |
| <EditPatientDialog> | IN | Renders an "Edit profile" button on a single-patient page. | React | src/components/patient-form.tsx |
| Invite field | IN | Validated with the regex MATRIX_ID_RE. | local | src/components/patient-form.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Invite validation bypassed | Editing/removing MATRIX_ID_RE. | createRoom rejects invite at the SDK boundary. | src/components/patient-form.tsx |
| Create without first-event device-info | Bypassing createPatient and calling SDK directly. | Invitee shows UTD on first event. | src/lib/matrix/patients.ts |
| Form fields drift from PatientRecord | Adding a field only here. | TypeScript build fails on updatePatient. | src/lib/matrix/types.ts |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| FormValues shape | Contract | Must equal PatientRecord minus updatedAt and updatedTimes. | src/lib/matrix/types.ts |
| MATRIX_ID_RE | Contract | None; matches the Matrix user-ID grammar. | src/components/patient-form.tsx |
