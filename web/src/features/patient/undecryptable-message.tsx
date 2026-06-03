"use client";

import { useEffect } from "react";
import type { MatrixEvent } from "matrix-client/message";
import { matrixReact } from "matrix-client/react";
import { matrixCrypto } from "matrix-client/crypto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FAILURE_HINTS: Record<string, string> = {
  MEGOLM_UNKNOWN_INBOUND_SESSION_ID:
    "This device never received the session key. The sender likely hasn't (yet) uploaded it to backup, or didn't share it with this device.",
  MEGOLM_KEY_WITHHELD:
    "The sender explicitly refused to share the session key with this device.",
  MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE:
    "The sender refused to share the key because this device isn't verified.",
  OLM_UNKNOWN_MESSAGE_INDEX:
    "We have the session, but it was shared at a later ratchet index than this message. The earlier ratchet is only retrievable from key backup.",
  HISTORICAL_MESSAGE_NO_KEY_BACKUP:
    "Sent before this device logged in, and there's no key backup on the server.",
  HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED:
    "Sent before this device logged in. A backup exists, but this device doesn't have the backup decryption key.",
  HISTORICAL_MESSAGE_WORKING_BACKUP:
    "Sent before this device logged in. Backup is working but the key hasn't been fetched yet (or isn't in backup).",
  HISTORICAL_MESSAGE_USER_NOT_JOINED:
    "Sent when this user wasn't a member of the room.",
  SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
    "Sender's identity changed after previously being verified.",
  UNSIGNED_SENDER_DEVICE: "Sender's device isn't cross-signed.",
  UNKNOWN_SENDER_DEVICE: "Sender's device is unknown.",
  UNKNOWN_ERROR: "Unclassified decryption error.",
};

function peerKeyShareLine(
  state: ReturnType<typeof matrixCrypto.usePeerKeyShareState>,
): string | null {
  switch (state.kind) {
    case "idle":
      return "peer-share: idle (request not fired)";
    case "requesting":
      return "⟳ Asking your other devices for this key…";
    case "received":
      return "↓ Got the key, decrypting…";
    case "imported":
      return "✓ Key imported";
    case "no-responders":
      return "No other devices online to ask";
    case "timeout":
      return "No reply from your other devices";
    case "error":
      return `Key share failed: ${state.message}`;
    default:
      return null;
  }
}

/**
 * A message this device couldn't decrypt (megolm UTD). Shows the failure code,
 * a human hint, full wire diagnostics, and a live peer-key-share status while
 * it asks the user's other devices for the missing session key.
 */
export function UndecryptableMessage({
  event,
  isMe,
}: {
  event: MatrixEvent;
  isMe: boolean;
}) {
  const { client } = matrixReact.useMatrix();
  const wire = event.getWireContent() as {
    session_id?: string;
    sender_key?: string;
    device_id?: string;
    algorithm?: string;
  };
  const code = event.decryptionFailureReason ?? "UNKNOWN_ERROR";
  const hint = FAILURE_HINTS[code] ?? "";
  const eventId = event.getId() ?? "";
  const sender = event.getSender() ?? "";
  const ts = event.getTs();
  const sessionId = wire.session_id;
  const senderKey = wire.sender_key;
  const roomId = event.getRoomId();

  const peerState = matrixCrypto.usePeerKeyShareState(sessionId);

  useEffect(() => {
    if (!client) return;
    if (!sender || !sessionId || !senderKey || !roomId) return;
    void matrixCrypto.requestKeyFromPeers(client, {
      fromUserId: sender,
      roomId,
      sessionId,
      senderKey,
    });
  }, [client, sender, sessionId, senderKey, roomId]);

  const lines = [
    `code:       ${code}`,
    `event_id:   ${eventId}`,
    `sender:     ${sender}`,
    `device_id:  ${wire.device_id ?? "—"}`,
    `session_id: ${wire.session_id ?? "—"}`,
    `sender_key: ${wire.sender_key ?? "—"}`,
    `algorithm:  ${wire.algorithm ?? "—"}`,
    `timestamp:  ${ts ? new Date(ts).toISOString() : "—"}`,
  ];
  const block = lines.join("\n");
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(block);
      toast.success("Diagnostic copied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };
  const peerLine = peerKeyShareLine(peerState);
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">
            Unable to decrypt
          </Badge>
          <span className="font-mono text-xs">{code}</span>
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-background/60 rounded px-2 py-1.5">
          {block}
        </pre>
        {peerLine && (
          <div className="text-xs text-muted-foreground">{peerLine}</div>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onCopy}
          >
            Copy diagnostic
          </Button>
        </div>
      </div>
    </div>
  );
}
