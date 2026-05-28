"use client";

import type { MatrixClient, Room } from "matrix-js-sdk";
import type {
  Patient,
  PatientRecord,
  PatientRecordRevision,
} from "../types/patient";
import { ensureSessionInBackup } from "../core/backup";
import { sendCustomEvent, sendCustomStateEvent } from "../core/rooms";

export const PATIENT_TAG = "com.matrix-app.patient";
export const PATIENT_RECORD_EVENT_TYPE = "com.matrix-app.patient.record";
export const PROFILE_THREAD_STATE_TYPE =
  "com.matrix-app.patient.profile-thread";

export function fullName(r: { firstName: string; lastName: string }): string {
  return `${r.firstName} ${r.lastName}`.trim();
}

type ThreadRelation = {
  rel_type: "m.thread";
  event_id: string;
};

type RecordContent = Partial<PatientRecord> & {
  "m.relates_to"?: ThreadRelation;
};

export function getProfileThreadRoot(
  client: MatrixClient,
  roomId: string,
): string | null {
  const room = client.getRoom(roomId);
  if (!room) return null;
  const state = room.currentState.getStateEvents(
    PROFILE_THREAD_STATE_TYPE,
    "",
  );
  if (!state) return null;
  const content = state.getContent() as { rootEventId?: string };
  return content.rootEventId ?? null;
}

function isPatientRoom(room: Room): boolean {
  const tags = room.tags ?? {};
  return Object.prototype.hasOwnProperty.call(tags, PATIENT_TAG);
}

function latestRecordFromRoom(room: Room): PatientRecord | null {
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.getType() === PATIENT_RECORD_EVENT_TYPE) {
      const content = ev.getContent() as Partial<PatientRecord>;
      if (
        content &&
        typeof content.firstName === "string" &&
        typeof content.lastName === "string"
      ) {
        return {
          firstName: content.firstName,
          lastName: content.lastName,
          dob: content.dob,
          phone: content.phone,
          email: content.email,
          notes: content.notes,
          updatedAt:
            content.updatedAt ?? new Date(ev.getTs()).toISOString(),
          updatedTimes:
            typeof content.updatedTimes === "number" ? content.updatedTimes : 0,
        };
      }
    }
  }
  return null;
}

export function listPatients(client: MatrixClient): Patient[] {
  return client
    .getRooms()
    .filter(isPatientRoom)
    .map<Patient>((room) => {
      const record = latestRecordFromRoom(room);
      return {
        roomId: room.roomId,
        record: record ?? {
          firstName: room.name ?? "(unknown)",
          lastName: "",
          updatedAt: "",
          updatedTimes: 0,
        },
      };
    })
    .sort((a, b) => fullName(a.record).localeCompare(fullName(b.record)));
}

export async function createPatient(
  client: MatrixClient,
  input: Omit<PatientRecord, "updatedAt" | "updatedTimes">,
  options: { inviteUserIds?: string[] } = {},
): Promise<string> {
  const inviteUserIds = (options.inviteUserIds ?? []).filter(Boolean);
  const { room_id: roomId } = await client.createRoom({
    name: fullName(input),
    visibility: "private" as never,
    preset: "private_chat" as never,
    invite: inviteUserIds.length ? inviteUserIds : undefined,
    initial_state: [
      {
        type: "m.room.encryption",
        state_key: "",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      },
    ],
  });

  await client.setRoomTag(roomId, PATIENT_TAG, { order: Date.now() });

  // Make sure crypto knows about every device that will need to decrypt the
  // first event in this brand-new room — our own other sessions plus any
  // freshly-invited users. Without this, the initial Megolm session is not
  // shared with those devices and they show "Unable to decrypt".
  const crypto = client.getCrypto();
  const userId = client.getUserId();
  if (crypto && userId) {
    const targets = Array.from(new Set([userId, ...inviteUserIds]));
    try {
      await crypto.getUserDeviceInfo(targets, true);
    } catch {
      /* non-fatal */
    }
  }

  const record: PatientRecord = {
    ...input,
    updatedAt: new Date().toISOString(),
    updatedTimes: 0,
  };
  const { event_id: rootEventId } = await sendCustomEvent(
    client,
    roomId,
    PATIENT_RECORD_EVENT_TYPE,
    record as unknown as Record<string, unknown>,
  );

  await sendCustomStateEvent(client, roomId, PROFILE_THREAD_STATE_TYPE, {
    rootEventId,
  });

  await ensureSessionInBackup(client);

  return roomId;
}

export async function updatePatient(
  client: MatrixClient,
  roomId: string,
  input: Omit<PatientRecord, "updatedAt" | "updatedTimes">,
): Promise<void> {
  let rootEventId = getProfileThreadRoot(client, roomId);

  if (!rootEventId) {
    rootEventId = findOldestRecordEventId(client, roomId);
    if (!rootEventId) {
      throw new Error("No existing profile record to update.");
    }
    await sendCustomStateEvent(client, roomId, PROFILE_THREAD_STATE_TYPE, {
      rootEventId,
    });
  }

  const previous = latestRecordFromRoom(client.getRoom(roomId)!);
  const record: PatientRecord = {
    ...input,
    updatedAt: new Date().toISOString(),
    updatedTimes: (previous?.updatedTimes ?? 0) + 1,
  };
  const content: RecordContent = {
    ...record,
    "m.relates_to": { rel_type: "m.thread", event_id: rootEventId },
  };
  await sendCustomEvent(
    client,
    roomId,
    PATIENT_RECORD_EVENT_TYPE,
    content as unknown as Record<string, unknown>,
  );

  const room = client.getRoom(roomId);
  const derivedName = fullName(input);
  if (room && room.name !== derivedName) {
    try {
      await client.setRoomName(roomId, derivedName);
    } catch {
      /* non-fatal — room name is a nicety, the record event is the source of truth */
    }
  }

  await ensureSessionInBackup(client);
}

function findOldestRecordEventId(
  client: MatrixClient,
  roomId: string,
): string | null {
  const room = client.getRoom(roomId);
  if (!room) return null;
  const events = room.getLiveTimeline().getEvents();
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.getType() !== PATIENT_RECORD_EVENT_TYPE) continue;
    const id = ev.getId();
    if (id) return id;
  }
  return null;
}

export function listPatientHistory(
  client: MatrixClient,
  roomId: string,
): PatientRecordRevision[] {
  const room = client.getRoom(roomId);
  if (!room) return [];
  const rootEventId = getProfileThreadRoot(client, roomId);
  const events = room.getLiveTimeline().getEvents();
  const out: PatientRecordRevision[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.getType() !== PATIENT_RECORD_EVENT_TYPE) continue;
    const content = ev.getContent() as RecordContent;
    if (
      typeof content.firstName !== "string" ||
      typeof content.lastName !== "string"
    ) {
      continue;
    }
    const eventId = ev.getId();
    const sender = ev.getSender();
    if (!eventId || !sender) continue;
    out.push({
      firstName: content.firstName,
      lastName: content.lastName,
      dob: content.dob,
      phone: content.phone,
      email: content.email,
      notes: content.notes,
      updatedAt:
        content.updatedAt ?? new Date(ev.getTs()).toISOString(),
      updatedTimes:
        typeof content.updatedTimes === "number" ? content.updatedTimes : 0,
      eventId,
      sender,
      ts: ev.getTs(),
      isRoot: rootEventId ? eventId === rootEventId : false,
    });
  }
  return out;
}

export async function deletePatient(
  client: MatrixClient,
  roomId: string,
): Promise<void> {
  await client.leave(roomId);
  await client.forget(roomId);
}

export function getPatient(
  client: MatrixClient,
  roomId: string,
): Patient | null {
  const room = client.getRoom(roomId);
  if (!room) return null;
  const record = latestRecordFromRoom(room);
  return {
    roomId,
    record: record ?? {
      firstName: room.name ?? "(unknown)",
      lastName: "",
      updatedAt: "",
      updatedTimes: 0,
    },
  };
}
