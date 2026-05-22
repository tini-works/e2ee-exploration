---
id: c3-104
c3-seal: 1dc89ad832aecbcbb250e631458e272353ee45ccd9a5e90490b6e4dd378304ed
title: patients-domain
type: component
category: foundation
parent: c3-1
goal: |-
    Express patient records and patient-to-clinic messaging as operations
    on Matrix rooms, so the rest of the app never sees raw event types or
    SDK call shapes.
uses:
    - ref-client-only
    - ref-matrix-js-sdk
    - ref-room-per-patient
---

## Goal

Express patient records and patient-to-clinic messaging as operations
on Matrix rooms, so the rest of the app never sees raw event types or
SDK call shapes.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | patient-list, patient-detail, patient-account, status-bar invites |
| Event types | com.matrix-app.patient.record, com.matrix-app.patient.profile-thread, m.room.message |

## Purpose

Owns: `createPatient`, `updatePatient`, `deletePatient`,
`listPatients`, `getPatient`, `listPatientHistory`, `listMessages`,
`sendMessage`, `subscribeRooms`, `listPendingInvites`,
`acceptPatientInvite`, `declinePatientInvite`, `exportRoomEvents`,
plus the patient-domain constants in `types.ts`.

Non-goals: encryption setup (SDK does it on `m.room.encryption` state
event creation), recovery key UX, React state.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | A signed-in MatrixClient past PREPARED sync. | c3-101 |
| Inputs | PatientRecord form values; invite Matrix user IDs. | ref-room-per-patient |
| State | Read from the live timeline of each tagged room. | ref-room-per-patient |
| Shared deps | crypto.getUserDeviceInfo to pre-share Megolm sessions on room creation. | ref-matrix-js-sdk |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | A patient becomes a private encrypted room with a profile thread and a chat timeline. | ref-room-per-patient |
| Primary path (create) | createRoom (with m.room.encryption initial state) -> setRoomTag(PATIENT_TAG) -> getUserDeviceInfo(invitees) -> sendEvent(PATIENT_RECORD_EVENT_TYPE) -> sendStateEvent(PROFILE_THREAD_STATE_TYPE) -> ensureSessionInBackup. | ref-room-per-patient |
| Primary path (update) | Lookup root via state event -> send PATIENT_RECORD_EVENT_TYPE reply with m.relates_to thread relation. | ref-room-per-patient |
| Alternates | updatePatient backfills the root from the oldest record event if the state event was never written. | ref-room-per-patient |
| Failure | UTD events surface to the UI via MatrixEvent.isDecryptionFailure() and are diagnosed by patient-detail. | ref-room-per-patient |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-room-per-patient | ref | Storage shape | hard | Every operation lives on a tagged encrypted room. |
| ref-matrix-js-sdk | ref | SDK access | hard | No code outside this module sends raw events. |
| ref-client-only | ref | "use client" | hard | Module starts with "use client". |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| createPatient(client, input, opts) | OUT | Returns roomId; pre-shares Megolm with invitees. | Synapse + IndexedDB | src/lib/matrix/patients.ts |
| updatePatient(client, roomId, input) | OUT | Appends a thread reply; bumps updatedTimes. | Synapse | src/lib/matrix/patients.ts |
| listPatients(client) | OUT | Reads tagged rooms from local cache; pure. | IndexedDB | src/lib/matrix/patients.ts |
| subscribeRooms(client, cb) | OUT | Returns an unsubscribe; fans Room/Timeline/Tags/Name/Decrypted into cb. | SDK events | src/lib/matrix/patients.ts |
| exportRoomEvents(client, roomId) | OUT | Dumps timeline + state events for JSON export; decryption failures preserved as wireContent. | local | src/lib/matrix/patients.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| New event type unindexed | Add a new patient event type without registering in latestRecordFromRoom. | listPatients returns "(unknown)". | src/lib/matrix/patients.ts |
| Invitee can't decrypt first event | Skip getUserDeviceInfo before first send. | Invitee shows UTD on the initial profile event. | tests/patients-two-browsers.spec.ts |
| Tag drift | Different PATIENT_TAG string between create and list. | listPatients returns empty. | src/lib/matrix/types.ts |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Patient, PatientRecord, PatientRecordRevision, PendingInvite | Contract | Adding fields requires also updating latestRecordFromRoom shape check. | src/lib/matrix/types.ts |
| RoomEventExport | Contract | None; downstream JSON consumers depend on field names. | src/lib/matrix/patients.ts |
