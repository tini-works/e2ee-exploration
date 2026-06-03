"use client";

import {
  EventType,
  MsgType,
  type MatrixClient,
  type MatrixEvent,
} from "matrix-js-sdk";
import { ensureSessionInBackup } from "../core/backup";

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

/**
 * Delete a message via Matrix redaction. The homeserver strips the event's
 * content room-wide (it becomes a tombstone all members see as "deleted"),
 * including the `EncryptedFile` of attachment messages. Requires redact
 * permission for the target event (always granted for your own events).
 *
 * NOTE: redaction removes the *reference* to an attachment, not the ciphertext
 * in S3 — the caller deletes the stored object separately (it must capture the
 * object key before redacting, since redaction wipes it).
 */
export async function deleteMessage(
  client: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<void> {
  await client.redactEvent(roomId, eventId);
}
