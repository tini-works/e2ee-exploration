---
id: c3-210
c3-seal: f5cd075fe5e88e953c1bc89d3343305d03c277c7456e90e2854b8e74b7f61cbd
title: patients-domain
type: component
category: feature
parent: c3-2
goal: Implement the "rooms-as-records" domain over `matrix-js-sdk`. Owns every patient-record CRUD primitive (`createPatient`, `updatePatient`, `deletePatient`, `listPatients`, `getPatient`), profile-thread reconstruction (`listPatientHistory`), encrypted timeline access (`listMessages`, `sendMessage`), JSON export (`exportRoomEvents`), invite enumeration + accept/decline (`listPendingInvites`, `acceptPatientInvite`, `declinePatientInvite`), and the `ensureSessionInBackup` durability gate.
uses:
    - ref-encrypted-attachments
    - ref-matrix-js-sdk
    - ref-room-per-patient
    - rule-no-data-migration
    - rule-no-direct-sdk-import
---

## Goal

Implement the "rooms-as-records" domain over `matrix-js-sdk`. Owns every patient-record CRUD primitive (`createPatient`, `updatePatient`, `deletePatient`, `listPatients`, `getPatient`), profile-thread reconstruction (`listPatientHistory`), encrypted timeline access (`listMessages`, `sendMessage`), JSON export (`exportRoomEvents`), invite enumeration + accept/decline (`listPendingInvites`, `acceptPatientInvite`, `declinePatientInvite`), and the `ensureSessionInBackup` durability gate.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | feature |
| Consumers | Re-exported as matrix-client/patients for web/ (patient-table, patient-detail, patient-form, patient-account); also used internally by c3-212 patient-invites. |
| External deps | matrix-js-sdk (MatrixClient, Room, MatrixEvent, ClientEvent, RoomEvent, EventType, MsgType, MatrixEventEvent), matrix-js-sdk/lib/crypto-api (CryptoEvent.KeyBackupSessionsRemaining). |
| Persistence | Matrix rooms (one room per patient), Matrix room tags (com.matrix-app.patient), custom events (com.matrix-app.patient.record, com.matrix-app.patient.profile-thread). |

## Purpose

Owns: the `PatientRecord` / `Patient` / `PatientRecordRevision` / `PendingInvite` / `RoomEventExport` types; the room-tag and event-type constants (`PATIENT_TAG`, `PATIENT_RECORD_EVENT_TYPE`, `PROFILE_THREAD_STATE_TYPE`); `createPatient` (creates encrypted room, sets tag, primes Megolm sessions for invitees, writes the initial record, writes the profile-thread state event, awaits backup drain); `updatePatient` (appends a thread-relation reply, derives the thread root if missing, updates the room name); `deletePatient`/`acceptPatientInvite`/`declinePatientInvite`; `listPatients`/`getPatient`/`listPatientHistory`/`listMessages`/`exportRoomEvents`/`listPendingInvites`; `subscribeRooms`; `fullName` helper. File: `packages/matrix-client/src/patients.ts`.

Non-goals: React state (delegated to c3-211 matrix-provider and c3-212 patient-invites), UI rendering, peer-key-share (c3-206), recovery-key UX (c3-203), per-clinic allowlist (lives in web's c3-102 clinic-config).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Caller holds a MatrixClient past first sync; for mutations, ready should be true. | ref-room-per-patient |
| Inputs | PatientRecord-shaped input objects (no updatedAt / updatedTimes); room id strings. | ref-room-per-patient |
| State | None internal; every read pulls live data from client.getRoom(roomId). | ref-matrix-js-sdk |
| Shared deps | matrix-js-sdk events, crypto-api KeyBackupSessionsRemaining. | ref-matrix-js-sdk |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Clinic CRUD + chat works end-to-end against encrypted Matrix rooms; the homeserver never sees plaintext patient data. | ref-room-per-patient |
| Primary path | createPatient -> createRoom({ preset: private_chat, initial_state: m.room.encryption }) -> setRoomTag(PATIENT_TAG) -> getUserDeviceInfo([self, ...invitees]) (prime Megolm) -> sendEvent(PATIENT_RECORD_EVENT_TYPE) -> sendStateEvent(PROFILE_THREAD_STATE_TYPE, { rootEventId }) -> ensureSessionInBackup. updatePatient walks the thread root, appends a record with m.relates_to: m.thread, updates room name, then ensureSessionInBackup. | ref-room-per-patient |
| Alternates | acceptPatientInvite joins + tags (tag failure non-fatal); declinePatientInvite is just client.leave. deletePatient is leave then forget. subscribeRooms fans Matrix events into a single refresh callback. | ref-key-gate |
| Failure | ensureSessionInBackup waits up to 30s for KeyBackupSessionsRemaining = 0; on timeout it resolves anyway so writes never block forever. setRoomName failure in updatePatient is swallowed (room name is a nicety). | rule-no-data-migration |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-room-per-patient | ref | Domain model | hard | All patient state must live in Matrix rooms; never write to a separate database. |
| ref-matrix-js-sdk | ref | SDK boundary | hard | This module owns the largest fraction of SDK calls in the codebase. |
| rule-no-data-migration | rule | Shape evolution | hard | PatientRecord evolves directly; no version field; no compat shims. |
| rule-no-direct-sdk-import | rule | Web isolation | hard | All UI consumers go through matrix-client/patients. |
| ref-encrypted-attachments | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| createPatient(client, input, options?) | OUT | Returns roomId; awaits key-backup drain before resolving. | Matrix room | packages/matrix-client/src/patients.ts |
| updatePatient(client, roomId, input) | OUT | Appends a thread-relation record; bumps updatedTimes; updates room name. | Matrix room | packages/matrix-client/src/patients.ts |
| listPatients(client) / getPatient(client, roomId) | OUT | Filter rooms by PATIENT_TAG; return latest record snapshot per room. | matrix-client/patients | packages/matrix-client/src/patients.ts |
| listPatientHistory(client, roomId) | OUT | Walks thread events newest-first; flags isRoot against the state event. | matrix-client/patients | packages/matrix-client/src/patients.ts |
| listPendingInvites / acceptPatientInvite / declinePatientInvite | OUT | Join+tag on accept; leave on decline; enumeration uses getMyMembership() === "invite". | matrix-client/patients | packages/matrix-client/src/patients.ts |
| Event-type + tag constants | OUT | PATIENT_TAG, PATIENT_RECORD_EVENT_TYPE, PROFILE_THREAD_STATE_TYPE — never rename in place. | Matrix | packages/matrix-client/src/patients.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Megolm session not shared with invitees | Removing the getUserDeviceInfo([self, ...invitees]) priming call. | Invitees see "Unable to decrypt" for the very first event in the room. | Re-read createPatient in packages/matrix-client/src/patients.ts; the prime call must run before sendEvent |
| Write returns before backup drain | Removing the ensureSessionInBackup call inside createPatient / updatePatient / sendMessage. | Sign-out can strand un-uploaded keys; recipients never decrypt. | grep -n ensureSessionInBackup packages/matrix-client/src/patients.ts — must appear after each mutation |
| Profile-thread state missing on legacy rooms | Pre-thread-state rooms updated via updatePatient without the findOldestRecordEventId fallback. | updatePatient throws "No existing profile record to update." | Re-read updatePatient in packages/matrix-client/src/patients.ts; the fallback must remain |
| Event type renamed in place | Changing PATIENT_RECORD_EVENT_TYPE. | Existing rooms list as empty patients ((unknown) placeholder). | Inspect packages/matrix-client/src/patients.ts; constant must stay com.matrix-app.patient.record until rule-no-data-migration is lifted |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| PatientRecord shape | Contract | New fields may be added; renames force a delete-and-recreate per rule-no-data-migration. | packages/matrix-client/src/patients.ts |
| JSON export bundle (in c3-112) | Contract | Bundle composition (exportRoomEvents + listPatientHistory) must stay consistent with these helpers. | web/src/components/patient-table.tsx |
