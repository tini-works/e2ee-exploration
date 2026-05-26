---
id: ref-room-per-patient
c3-seal: 5850c9d758c743a81a1cd55701aa00b49f428293d558036e4faf965e45054773
title: room-per-patient
type: ref
goal: Standardize how domain records (patients) map to Matrix primitives so the homeserver never sees plaintext patient data, and sharing reuses Matrix's invite + key-distribution machinery instead of an app-layer ACL.
---

## Goal

Standardize how domain records (patients) map to Matrix primitives so the homeserver never sees plaintext patient data, and sharing reuses Matrix's invite + key-distribution machinery instead of an app-layer ACL.

## Choice

Each patient is a dedicated encrypted Matrix room. The current profile is the most recent `com.matrix-app.patient.record` event in the timeline; older revisions live as thread replies under a `profile-thread` state event. Patient sharing is just Matrix room invites. Chat about a patient lives in standard `m.room.message` events in the same room.

## Why

- Matrix already solves the hard parts: per-room megolm sessions, key sharing only to invited devices, server-side blindness to event content. Reusing the room as the record means we get those guarantees for free.
- Putting history in a thread (instead of state) keeps timeline encryption uniform — state events have weaker encryption semantics in some SDKs.
- Using a custom event type (`com.matrix-app.patient.record`) keeps domain data out of `m.room.message`, so listing patients vs reading their chat is a clean filter.
- Sharing = invites means we never write an ACL; the megolm session is shared exactly with invited devices, and revoking access is `kick` (existing megolm sessions are still readable by exited devices — accepted trade-off).

## How

Create:

```ts
// packages/matrix-client/src/patients.ts
const { room_id } = await client.createRoom({
  preset: Preset.PrivateChat,
  initial_state: [{ type: "m.room.encryption", content: { algorithm: "m.megolm.v1.aes-sha2" } }],
  invite: inviteUserIds,
});
await client.setRoomTag(room_id, PATIENT_TAG);
await client.getCrypto().getUserDeviceInfo([self, ...invitees]);   // prime megolm
await client.sendEvent(room_id, PATIENT_RECORD, record);
await client.sendStateEvent(room_id, PROFILE_THREAD, { rootEventId });
```

Update appends a thread reply with `m.thread` relation to the root; `listPatientHistory` walks the thread.
