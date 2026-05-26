---
id: c3-114
c3-seal: d386fa86daeac1ae14e01b041ea37166b7c8bb360e9bee05b7504ef01ebde232
title: patient-form
type: component
category: feature
parent: c3-1
goal: Centralize the patient profile form fields and host the New-patient and Edit-profile dialog flows. Provides one set of fields (first/last name, dob, phone, email, notes) plus an invite-Matrix-user input on the new-patient path.
uses:
    - ref-room-per-patient
    - rule-key-gate-disable
    - rule-no-confirm
    - rule-no-direct-sdk-import
    - rule-toast-error-shape
---

## Goal

Centralize the patient profile form fields and host the New-patient and Edit-profile dialog flows. Provides one set of fields (first/last name, dob, phone, email, notes) plus an invite-Matrix-user input on the new-patient path.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | patient-table (c3-112) renders <NewPatientDialog>; patient-detail (c3-113) renders <EditPatientDialog>. |
| External deps | matrix-client/react (useMatrix), matrix-client/patients (createPatient, updatePatient, PatientRecord), sonner. |
| Persistence | None local. Mutations go to the patient room via the package. |

## Purpose

Owns: the shared `PatientFormFields` block; `NewPatientDialog` (trigger button + dialog + form + Invite input that validates against `MATRIX_ID_RE`); `EditPatientDialog` (lazy-mounts `EditPatientForm` only when open, seeded from initial values); success/error toasts for both flows. File: `web/src/components/patient-form.tsx`.

Non-goals: persistence layer, profile-history rendering (lives in patient-detail), list refresh (the parent subscribes via `subscribeRooms`).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Inside <MatrixProvider>; provider must be ready for submit to fire. | ref-key-gate |
| Inputs | New: in-component state (values, inviteInput). Edit: roomId, initial values, and a callback fired after a successful update. | ref-room-per-patient |
| State | values, inviteInput, open, submitting per dialog. | ref-client-only |
| Shared deps | Button, Dialog family, Input, Label from c3-101; notReadyMessage from c3-103. | ref-toast-feedback |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Creates a new encrypted patient room or appends a new revision to an existing room's profile thread. | ref-room-per-patient |
| Primary path | New -> validate Matrix invite id if provided -> createPatient(client, values, { inviteUserIds: [inviteId] }) -> success toast and close. Edit -> updatePatient(client, roomId, values) -> success toast and close. | ref-room-per-patient |
| Alternates | New path with empty invite skips inviteUserIds. Bad invite id raises a domain toast and aborts before createPatient. | ref-toast-feedback |
| Failure | Either call rejects -> toast.error(...); dialog stays open. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-room-per-patient | ref | Profile thread + invites | hard | New uses createPatient (which sets the thread and primes Megolm); Edit uses updatePatient (which appends a thread reply). |
| rule-key-gate-disable | rule | Disabled triggers | hard | Both submit buttons read disabled={!ready} with title={notReadyMessage(notReadyReason)}. |
| rule-no-confirm | rule | Dialog usage | hard | Inputs and confirmation live inside shadcn <Dialog>; no confirm() anywhere. |
| rule-no-direct-sdk-import | rule | Imports | hard | All Matrix interactions go through matrix-client/*. |
| rule-toast-error-shape | rule | Error toast | hard | Single-arg today; target shape headline + description. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <NewPatientDialog onCreated?={() => void} /> | IN | Renders the trigger button + dialog; calls onCreated on success. | React | web/src/components/patient-form.tsx |
| <EditPatientDialog roomId initial onUpdated? /> | IN | Renders Edit trigger; lazy-mounts EditPatientForm while open. | React | web/src/components/patient-form.tsx |
| MATRIX_ID_RE | OUT | ^@[^:\s]+:[^:\s]+$; rejects malformed invites at the input layer. | module | web/src/components/patient-form.tsx |
| Submit handlers | OUT | Send PatientRecord-shaped objects (no updatedAt / updatedTimes) to createPatient / updatePatient. | matrix-client/patients | web/src/components/patient-form.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Required fields not enforced | Removing required on first/last name. | Empty-name patient rooms get created. | Re-read PatientFormFields in web/src/components/patient-form.tsx; both inputs must be required |
| Invite id silently bypassed | Removing the MATRIX_ID_RE validation. | Invalid invites reach Synapse and fail late. | grep -n MATRIX_ID_RE web/src/components/patient-form.tsx |
| Edit form keeps stale values across opens | Removing the open && mount guard around EditPatientForm. | Reopening the Edit dialog shows the previous edit's draft. | Re-read <EditPatientDialog> in web/src/components/patient-form.tsx; EditPatientForm must be mounted inside {open && ...} |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Form value shape | Foundational Flow | Omit&lt;PatientRecord, "updatedAt" or "updatedTimes"&gt; — must match the package's PatientRecord. | packages/matrix-client/src/patients.ts |
| Invite validation regex | Contract | Must remain Matrix-user-id-shaped (@local:server). | web/src/components/patient-form.tsx |
