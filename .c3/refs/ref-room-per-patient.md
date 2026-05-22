---
id: ref-room-per-patient
c3-seal: 279deacad2e4200fb2d5405015adb0afaa77d3ef62a71edf1e1a640d065e1498
title: room-per-patient
type: ref
goal: |-
    Pick a single storage shape for patient records so access control,
    audit, and end-to-end encryption all reuse the same Matrix primitive
    instead of being re-invented per feature.
---

## Goal

Pick a single storage shape for patient records so access control,
audit, and end-to-end encryption all reuse the same Matrix primitive
instead of being re-invented per feature.

## Choice

One private, encrypted Matrix room per patient, tagged
`com.matrix-app.patient`. The patient profile lives as the root event
of an `m.thread`; profile edits are replies pointing at the root via
`m.relates_to`; chat messages live in the same room's main timeline.

## Why

A Matrix room already carries access control (membership), encryption
(`m.room.encryption`), and an append-only audit log (timeline). Using
one room per patient maps "who can see this record" to "who is in this
room" — Synapse enforces it, we don't have to. Threading edits off a
known root event makes "latest profile" a single lookup and gives a
free revision history without inventing a separate event type.

## How

Constants and helpers live in `src/lib/matrix/types.ts`:

```ts
// src/lib/matrix/types.ts
export const PATIENT_TAG = "com.matrix-app.patient";
export const PATIENT_RECORD_EVENT_TYPE = "com.matrix-app.patient.record";
export const PROFILE_THREAD_STATE_TYPE = "com.matrix-app.patient.profile-thread";
```

Creation, edit, and listing always go through `patients.ts`:

```ts
// src/lib/matrix/patients.ts (createPatient excerpt)
const { room_id: roomId } = await client.createRoom({
  name: fullName(input),
  visibility: "private",
  preset: "private_chat",
  invite: inviteUserIds.length ? inviteUserIds : undefined,
  initial_state: [
    { type: "m.room.encryption", state_key: "",
      content: { algorithm: "m.megolm.v1.aes-sha2" } },
  ],
});
await client.setRoomTag(roomId, PATIENT_TAG, { order: Date.now() });

const { event_id: rootEventId } = await sendCustomEvent(
  client, roomId, PATIENT_RECORD_EVENT_TYPE, record,
);
await sendCustomStateEvent(client, roomId, PROFILE_THREAD_STATE_TYPE, { rootEventId });
```

Required: tag every patient room with `PATIENT_TAG`; encrypt with
`m.megolm.v1.aes-sha2`; store the thread root in a state event so
`updatePatient` can recover it without scanning the whole timeline.
