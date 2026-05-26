---
id: c3-112
c3-seal: c466836e41374f9e7947f36f43c5379dd8b37283b12f6b1eadeadedbd0edf39d
title: patient-table
type: component
category: feature
parent: c3-1
goal: Render the clinic-facing patient list, drive create/export/delete flows, and keep the table reactive to room changes coming from `subscribeRooms`. The single screen clinic operators use to enter the rest of the app.
uses:
    - ref-key-gate
    - ref-room-per-patient
    - rule-key-gate-disable
    - rule-no-confirm
    - rule-no-direct-sdk-import
    - rule-toast-error-shape
---

## Goal

Render the clinic-facing patient list, drive create/export/delete flows, and keep the table reactive to room changes coming from `subscribeRooms`. The single screen clinic operators use to enter the rest of the app.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | web/src/app/patients/page.tsx (wrapped by clinic-guard); inlined inside patient-account for clinic users. |
| External deps | matrix-client/react (useMatrix), matrix-client/patients (listPatients, listPatientHistory, exportRoomEvents, deletePatient, subscribeRooms, fullName), sonner. |
| Persistence | None local; mutations land in Matrix rooms via the package. |

## Purpose

Owns: the patient `<Table>` with columns (name, dob, contact, notes, updated, edit count, room id badge); the `NewPatientDialog` trigger (delegated to patient-form for the form itself); the per-row dropdown menu (Open, Export JSON, Delete); the destructive delete confirmation dialog; the JSON export bundler (`exportedAt`, `roomId`, `record`, `history`, `events`). File: `web/src/components/patient-table.tsx`.

Non-goals: the new-patient and edit forms (lives in patient-form c3-114); patient-side relationship view (patient-account c3-115); single-patient detail (patient-detail c3-113); clinic ACL (clinic-guard c3-105).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Inside <MatrixProvider>, after <ClinicGuard> confirmed the user is a clinic. | ref-room-per-patient |
| Inputs | None directly; subscribes to room changes via subscribeRooms. | ref-matrix-js-sdk |
| State | patients array, pendingDelete (room id + display name), deleting boolean. | ref-client-only |
| Shared deps | Table family, Button, Badge, Dialog, DropdownMenu from c3-101; notReadyMessage from c3-103 for disabled tooltips. | ref-client-only |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Clinic sees the current set of patient rooms and can create, open, export, or delete them. | ref-room-per-patient |
| Primary path | Mount -> listPatients(client) -> subscribe -> on every Matrix event refresh the table -> user clicks New -> opens NewPatientDialog -> on success a new row appears via the subscription. | ref-room-per-patient |
| Alternates | Open links to /patients/[roomId]; Export downloads a JSON bundle assembled from exportRoomEvents + listPatientHistory. | ref-room-per-patient |
| Failure | deletePatient rejects -> toast.error(...); the row stays put. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-room-per-patient | ref | Domain model | hard | One row = one encrypted Matrix room; ordering is alphabetical on fullName. |
| ref-key-gate | ref | Gating | hard | Delete and create triggers read ready and disable when false. |
| rule-key-gate-disable | rule | Disabled buttons | hard | Delete menu item disabled={!ready} with title={notReadyMessage(notReadyReason)}. |
| rule-no-confirm | rule | Delete confirm | hard | Delete uses a shadcn <Dialog>, not confirm. |
| rule-toast-error-shape | rule | Error feedback | hard | Currently single-arg toast.error; target shape is headline + description per the rule. |
| rule-no-direct-sdk-import | rule | Imports | hard | All Matrix calls go via matrix-client/patients. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <PatientTable /> | IN | Renders the patient list; no props. | React | web/src/components/patient-table.tsx |
| listPatients(client) consumption | IN | Returns Patient[] sorted by display name. | matrix-client/patients | packages/matrix-client/src/patients.ts |
| Delete row flow | OUT | Calls deletePatient(client, roomId); on success toasts and refreshes via subscription. | matrix-client/patients | web/src/components/patient-table.tsx |
| Export row flow | OUT | Downloads patient-<slug>-<roomid>.json with { exportedAt, roomId, record, history, events }. | browser download | web/src/components/patient-table.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Table goes stale on remote update | Removing the subscribeRooms effect. | Newly invited rooms or remote edits don't appear without a manual refresh. | Re-read the mount effect in web/src/components/patient-table.tsx; must call subscribeRooms and return its unsubscribe |
| Delete bypasses recovery-key gate | Removing disabled={!ready} on the Delete menu item. | User triggers delete during a partially-bootstrapped session. | Inspect the Delete row in web/src/components/patient-table.tsx; disabled={!ready} required |
| JSON export leaks unredacted data | Adding a sensitive field to PatientRecord without considering the bundle. | New field flows into the exported JSON without intent. | Run git grep -n exportRoomEvents web/src and re-review the bundle keys in web/src/components/patient-table.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Export file name | Contract | Format patient-<slug>-<10char-roomid>.json may evolve, but must remain filename-safe. | web/src/components/patient-table.tsx |
| Sort order | Foundational Flow | Currently alphabetical on fullName; any change must come from matrix-client/patients. | packages/matrix-client/src/patients.ts |
