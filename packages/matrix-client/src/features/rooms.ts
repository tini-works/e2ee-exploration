"use client";

import {
  sendCustomEvent,
  sendCustomStateEvent,
  subscribeRooms,
  exportRoomEvents,
} from "../core/rooms";

/**
 * Low-level, domain-agnostic room helpers. Single namespace object so the host
 * project's own room/event code doesn't collide with names like `subscribeRooms`.
 */
export const matrixRooms = {
  subscribe: subscribeRooms,
  exportEvents: exportRoomEvents,
  sendCustomEvent,
  sendCustomStateEvent,
} as const;

export type { RoomEventExport } from "../types/rooms";
