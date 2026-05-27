"use client";

import {
  ClientEvent,
  MatrixEventEvent,
  RoomEvent,
  type MatrixClient,
  type MatrixEvent,
} from "matrix-js-sdk";
import type { RoomEventExport } from "../types/rooms";

/**
 * Generic, domain-agnostic helpers over a Matrix room: sending custom event
 * types the SDK's typed overloads don't know about, subscribing to room
 * changes, and dumping raw timeline/state for diagnostics. Feature modules
 * (patient, message, …) build on these.
 */

export function sendCustomEvent(
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

export function sendCustomStateEvent(
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

function dumpEvent(ev: MatrixEvent): RoomEventExport {
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
