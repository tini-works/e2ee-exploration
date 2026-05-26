"use client";

import { useCallback, useEffect, useState } from "react";
import {
  acceptPatientInvite,
  declinePatientInvite,
  listPendingInvites,
  type PendingInvite,
} from "../patients";
import { useMatrix } from "./provider";

export function usePatientInvites() {
  const { client } = useMatrix();
  const [invites, setInvites] = useState<PendingInvite[]>([]);

  useEffect(() => {
    if (!client) {
      setInvites([]);
      return;
    }
    const refresh = () => {
      try {
        setInvites(listPendingInvites(client));
      } catch {
        /* ignore */
      }
    };
    refresh();
    let unsub = () => {};
    (async () => {
      const { RoomEvent } = await import("matrix-js-sdk");
      const handler = () => refresh();
      client.on(RoomEvent.MyMembership, handler);
      unsub = () => client.off(RoomEvent.MyMembership, handler);
    })();
    return () => unsub();
  }, [client]);

  const accept = useCallback(
    async (roomId: string) => {
      if (!client) throw new Error("Not signed in.");
      await acceptPatientInvite(client, roomId);
      setInvites(listPendingInvites(client));
    },
    [client],
  );

  const decline = useCallback(
    async (roomId: string) => {
      if (!client) throw new Error("Not signed in.");
      await declinePatientInvite(client, roomId);
      setInvites(listPendingInvites(client));
    },
    [client],
  );

  return { invites, accept, decline };
}
