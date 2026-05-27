"use client";

import { useSyncExternalStore } from "react";
import {
  getPeerKeyShareState,
  subscribePeerKeyShareState,
} from "../core/peer-key-share";
import type { PeerKeyShareState } from "../types/peer-key-share";

const IDLE: PeerKeyShareState = { kind: "idle" };

export function usePeerKeyShareState(
  sessionId: string | undefined,
): PeerKeyShareState {
  return useSyncExternalStore(
    (onChange) => {
      if (!sessionId) return () => {};
      return subscribePeerKeyShareState(sessionId, () => onChange());
    },
    () => (sessionId ? getPeerKeyShareState(sessionId) : IDLE),
    () => IDLE,
  );
}
