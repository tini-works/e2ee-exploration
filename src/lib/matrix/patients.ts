"use client";

import {
  ClientEvent,
  EventType,
  MatrixEventEvent,
  MsgType,
  RoomEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from "matrix-js-sdk";
import { CryptoEvent } from "matrix-js-sdk/lib/crypto-api";
import {
  PATIENT_RECORD_EVENT_TYPE,
  PATIENT_TAG,
  PROFILE_THREAD_STATE_TYPE,
  fullName,
  type Patient,
  type PatientRecord,
  type PatientRecordRevision,
  type PendingInvite,
} from "./types";

type ThreadRelation = {
  rel_type: "m.thread";
  event_id: string;
};

type RecordContent = Partial<PatientRecord> & {
  "m.relates_to"?: ThreadRelation;
};

function sendCustomEvent(
  client: MatrixClient,
  roomId: string,
  eventType: string,
  content: Record<string, unknown>,
): Promise<{ event_id: string }> {
  return (
    client.sendEvent as unknown as (
      roomId: string,
      eventType: string,
      content: Record<string, unknown>,
    ) => Promise<{ event_id: string }>
  )(roomId, eventType, content);
}

async function waitForBackupDrain(
  client: MatrixClient,
  timeoutMs = 30_000,
): Promise<void> {
  return new Promise((resolve) => {
    const handler = (remaining: number) => {
      if (remaining === 0) {
        client.off(CryptoEvent.KeyBackupSessionsRemaining, handler);
        resolve();
      }
    };
    client.on(CryptoEvent.KeyBackupSessionsRemaining, handler);
    setTimeout(() => {
      client.off(CryptoEvent.KeyBackupSessionsRemaining, handler);
      resolve();
    }, timeoutMs);
  });
}

async function ensureSessionInBackup(client: MatrixClient): Promise<void> {
  const crypto = client.getCrypto();
  if (!crypto) return;
  const activeVersion = await crypto.getActiveSessionBackupVersion();
  if (!activeVersion) return; // backup not active — nothing we can do here
  const backupManager = (crypto as unknown as {
    backupManager?: { maybeUploadKey?: () => Promise<void> };
  }).backupManager;
  await backupManager?.maybeUploadKey?.();
  await waitForBackupDrain(client);
}

function sendCustomStateEvent(
  client: MatrixClient,
  roomId: string,
  eventType: string,
  content: Record<string, unknown>,
  stateKey = "",
): Promise<{ event_id: string }> {
  return (
    client.sendStateEvent as unknown as (
      roomId: string,
      eventType: string,
      content: Record<string, unknown>,
      stateKey: string,
    ) => Promise<{ event_id: string }>
  )(roomId, eventType, content, stateKey);
}

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

export type RoomEventExport = {
  eventId: string | undefined;
  type: string;
  stateKey: string | undefined;
  sender: string | undefined;
  ts: number;
  content: unknown;
  unsigned: unknown;
  isEncrypted: boolean;
  decryptionFailureReason: string | null;
  wireContent: unknown;
};

function dumpEvent(ev: import("matrix-js-sdk").MatrixEvent): RoomEventExport {
  const failed = ev.isDecryptionFailure();
  return {
    eventId: ev.getId(),
    type: ev.getType(),
    stateKey: ev.getStateKey(),
    sender: ev.getSender() ?? undefined,
    ts: ev.getTs(),
    content: failed ? null : ev.getContent(),
    unsigned: ev.getUnsigned(),
    isEncrypted: ev.isEncrypted(),
    decryptionFailureReason: failed
      ? (ev.decryptionFailureReason ?? "UNKNOWN_ERROR")
      : null,
    wireContent: ev.isEncrypted() ? ev.getWireContent() : null,
  };
}

export function exportRoomEvents(
  client: MatrixClient,
  roomId: string,
): { timeline: RoomEventExport[]; state: RoomEventExport[] } {
  const room = client.getRoom(roomId);
  if (!room) return { timeline: [], state: [] };
  const timeline = room.getLiveTimeline().getEvents().map(dumpEvent);
  const state: RoomEventExport[] = [];
  for (const [, byKey] of room.currentState.events) {
    for (const [, ev] of byKey) state.push(dumpEvent(ev));
  }
  return { timeline, state };
}

export async function deletePatient(
  client: MatrixClient,
  roomId: string,
): Promise<void> {
  await client.leave(roomId);
  await client.forget(roomId);
}

export function subscribeRooms(
  client: MatrixClient,
  cb: () => void,
): () => void {
  const handler = () => cb();
  client.on(ClientEvent.Room, handler);
  client.on(RoomEvent.Timeline, handler);
  client.on(RoomEvent.Tags, handler);
  client.on(RoomEvent.Name, handler);
  client.on(MatrixEventEvent.Decrypted, handler);
  return () => {
    client.off(ClientEvent.Room, handler);
    client.off(RoomEvent.Timeline, handler);
    client.off(RoomEvent.Tags, handler);
    client.off(RoomEvent.Name, handler);
    client.off(MatrixEventEvent.Decrypted, handler);
  };
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

export function listMessages(
  client: MatrixClient,
  roomId: string,
): MatrixEvent[] {
  const room = client.getRoom(roomId);
  if (!room) return [];
  return room
    .getLiveTimeline()
    .getEvents()
    .filter((e) => e.getType() === EventType.RoomMessage);
}

export async function sendMessage(
  client: MatrixClient,
  roomId: string,
  body: string,
): Promise<void> {
  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Text,
    body,
  });
  await ensureSessionInBackup(client);
}

export function listPendingInvites(client: MatrixClient): PendingInvite[] {
  const userId = client.getUserId();
  return client
    .getRooms()
    .filter((room) => room.getMyMembership() === "invite")
    .map<PendingInvite>((room) => {
      // The inviter is whoever set our membership=invite event in the
      // invite-state preview the server returned.
      let inviterId: string | null = null;
      if (userId) {
        const member = room.getMember(userId);
        const ev = member?.events?.member;
        inviterId = ev?.getSender() ?? null;
      }
      return {
        roomId: room.roomId,
        name: room.name ?? "(unnamed room)",
        inviterId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function acceptPatientInvite(
  client: MatrixClient,
  roomId: string,
): Promise<void> {
  await client.joinRoom(roomId);
  try {
    await client.setRoomTag(roomId, PATIENT_TAG, { order: Date.now() });
  } catch {
    /* tag failure is non-fatal — the room is joined */
  }
}

export async function declinePatientInvite(
  client: MatrixClient,
  roomId: string,
): Promise<void> {
  await client.leave(roomId);
}
