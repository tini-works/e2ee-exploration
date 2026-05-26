---
id: c3-115
c3-seal: 0f20075dc57af8538f47913f710cb5cf0c8dc37c7c1f848a740019406323edcc
title: patient-account
type: component
category: feature
parent: c3-1
goal: Patient-facing landing view that answers "which clinics hold records about me?" by listing every room the user is in or invited to whose membership includes a known `CLINICS` entry. For clinic users it also inlines the full patient table so the same page works as their workspace.
uses:
    - ref-key-gate
    - ref-room-per-patient
    - rule-key-gate-disable
    - rule-no-direct-sdk-import
    - rule-toast-error-shape
---

## Goal

Patient-facing landing view that answers "which clinics hold records about me?" by listing every room the user is in or invited to whose membership includes a known `CLINICS` entry. For clinic users it also inlines the full patient table so the same page works as their workspace.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | web/src/app/page.tsx (the root route). |
| External deps | matrix-client/react (useMatrix, usePatientInvites), matrix-client/patients (subscribeRooms), matrix-js-sdk type-only (MatrixClient, Room), sonner. |
| Persistence | None local; reads room membership state. |

## Purpose

Owns: profile section (user id, device id, homeserver, role badge); the `Clinics` list assembled by `listClinicRelations(client)` (walks every room and matches members against `CLINICS`); accept/decline buttons for invite-state relations; conditional inline render of `<PatientTable />` when the user is themselves a clinic. File: `web/src/components/patient-account.tsx`.

Non-goals: clinic UI (delegated to patient-table c3-112); patient-room detail (delegated to patient-detail c3-113); the invite-driven domain side effects (delegated to c3-212 patient-invites via the hook).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Inside <MatrixProvider>; user may be invited or joined to one or more clinic rooms. | ref-room-per-patient |
| Inputs | None directly; reads session, ready, notReadyReason from useMatrix. | ref-client-only |
| State | relations (clinic-room rows), busyRoom (in-flight room id during accept/decline). | ref-client-only |
| Shared deps | CLINICS, findClinicByUserId, isClinicUser from c3-102; Badge, Button from c3-101; notReadyMessage from c3-103. | ref-toast-feedback |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Patient sees a transparent inventory of which clinics have a record about them and can accept new invites or decline. | ref-room-per-patient |
| Primary path | Mount -> listClinicRelations(client) -> subscribe -> show invite/join rows -> user accepts a clinic invite via usePatientInvites().accept -> the row flips from "Invited" to "Joined" via the subscription. | ref-room-per-patient |
| Alternates | If isClinicUser(session.userId) is true, the clinic patient table is rendered below the profile section so the same page works as the clinic workspace. | ref-key-gate |
| Failure | accept/decline reject -> toast.error(...); the row stays in its previous state. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-room-per-patient | ref | Relation enumeration | hard | listClinicRelations walks client.getRooms() and matches against CLINICS. |
| ref-key-gate | ref | Accept gating | hard | Accept button reads ready and disables while false. |
| rule-key-gate-disable | rule | Disabled trigger | hard | Accept disable expression covers busy, any other busy row, and !ready. |
| rule-toast-error-shape | rule | Error toast | hard | Single-arg today; target shape per rule. |
| rule-no-direct-sdk-import | rule | Type-only SDK use | hard | MatrixClient, Room imported as types only. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <PatientAccount /> | IN | Renders the root-page profile + clinic-relations + inlined table for clinic users. | React | web/src/components/patient-account.tsx |
| listClinicRelations(client) | OUT | Returns rows for every joined or invited room with a CLINICS member, sorted alphabetically. | matrix-client/patients consumer | web/src/components/patient-account.tsx |
| Accept / Decline triggers | OUT | Call usePatientInvites().accept / decline; success/error toasts. | matrix-client/react | web/src/components/patient-account.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Relation list goes stale | Removing the subscribeRooms effect. | Acceptances don't flip the badge until reload. | Re-read mount effect in web/src/components/patient-account.tsx; must return subscribeRooms(client, refresh) |
| Clinic-table double-mount | Removing the userIsClinic guard before <PatientTable />. | Non-clinic users see the patient table. | Re-read web/src/components/patient-account.tsx; final block must be {userIsClinic && <PatientTable />} |
| Invited rows act like joined rows | Removing the isInvite branching that wraps joined rows in a <Link>. | Patients try to open a room they haven't joined; the link 404s. | Re-read the row render in web/src/components/patient-account.tsx; only membership === "join" rows wrap in <Link> |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| ClinicRelation row | Contract | May add fields, must keep clinicUserId matching CLINICS. | web/src/components/patient-account.tsx |
| Role badge wording | Foundational Flow | "Clinic" / "Patient" labels may evolve; the source-of-truth is isClinicUser. | web/src/components/patient-account.tsx |
