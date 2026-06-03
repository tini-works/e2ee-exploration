"use client";

import { deleteMessage, listMessages, sendMessage } from "./message.messages";

/**
 * Message feature surface for matrix-client. Single namespace object so the host
 * project's own message code doesn't collide with `listMessages` / `sendMessage`.
 */
export const matrixMessage = {
  list: listMessages,
  send: sendMessage,
  delete: deleteMessage,
} as const;

// Re-exported so web can type timeline events without importing matrix-js-sdk
// directly (rule-no-direct-sdk-import). `matrixMessage.list` returns these.
export type { MatrixEvent } from "matrix-js-sdk";
