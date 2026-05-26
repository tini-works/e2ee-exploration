import type { NotReadyReason } from "matrix-client/react";

export function notReadyMessage(reason: NotReadyReason | null): string {
  if (!reason) return "";
  switch (reason.kind) {
    case "not_signed_in":
      return "Not signed in.";
    case "reconnecting":
      return "Reconnecting to homeserver…";
    case "catchup":
      return "Catching up with homeserver…";
    case "sync_error":
      return "Sync error — waiting for reconnection..";
    case "syncing":
      return "Waiting for first sync to finish…";
    case "needs_recovery_key":
      return "Enter your recovery key in the status bar to unlock this session.";
  }
}
