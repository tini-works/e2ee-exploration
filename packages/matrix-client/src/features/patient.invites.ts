"use client";

import type { MatrixClient } from "matrix-js-sdk";
import type { PendingInvite } from "../types/patient";
import { PATIENT_TAG } from "./patient.records";

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
