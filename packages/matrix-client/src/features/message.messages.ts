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
