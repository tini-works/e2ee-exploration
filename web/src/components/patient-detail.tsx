"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MatrixEvent } from "matrix-js-sdk";
import { useMatrix, usePeerKeyShareState } from "matrix-client/react";
import { requestKeyFromPeers } from "matrix-client";
import {
  fullName,
  getPatient,
  listMessages,
  listPatientHistory,
  sendMessage,
  subscribeRooms,
  type Patient,
  type PatientRecordRevision,
} from "matrix-client/patients";
import { notReadyMessage } from "@/lib/not-ready-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EditPatientDialog } from "./patient-form";
import { toast } from "sonner";

export function PatientDetail({ roomId }: { roomId: string }) {
  const { client, session, ready, notReadyReason } = useMatrix();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<MatrixEvent[]>([]);
  const [history, setHistory] = useState<PatientRecordRevision[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!client) return;
    const refresh = () => {
      setPatient(getPatient(client, roomId));
      setMessages(listMessages(client, roomId));
      setHistory(listPatientHistory(client, roomId));
    };
    refresh();
    return subscribeRooms(client, refresh);
  }, [client, roomId]);

  const editInitial = useMemo(() => {
    const r = patient?.record;
    return {
      firstName: r?.firstName ?? "",
      lastName: r?.lastName ?? "",
      dob: r?.dob ?? "",
      phone: r?.phone ?? "",
      email: r?.email ?? "",
      notes: r?.notes ?? "",
    };
  }, [patient]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !ready || !text.trim()) return;
    setSending(true);
    try {
      await sendMessage(client, roomId, text.trim());
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  if (!patient) {
    return (
      <div className="text-muted-foreground">
        Loading room… If this persists, the room may not be synced yet.
      </div>
    );
  }

  const r = patient.record;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to patients
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[6fr_4fr] lg:items-start">
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{fullName(r)}</h1>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {roomId}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <EditPatientDialog roomId={roomId} initial={editInitial} />
                <Badge>E2E encrypted</Badge>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Date of birth</dt>
                <dd>{r.dob || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{r.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{r.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>
                  {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Times updated</dt>
                <dd className="font-mono">{r.updatedTimes}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap">{r.notes || "—"}</dd>
              </div>
            </dl>
          </div>

          <ProfileHistory
            history={history}
            currentSelf={session?.userId ?? null}
          />
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Encrypted timeline</h2>
            <p className="text-xs text-muted-foreground">
              Messages are visible only to members of this room.
            </p>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-4 space-y-2 text-sm">
            {messages.length === 0 && (
              <div className="text-muted-foreground text-center py-8">
                No messages yet.
              </div>
            )}
            {messages.map((ev) => {
              const sender = ev.getSender();
              const isMe = sender === session?.userId;
              if (ev.isDecryptionFailure()) {
                return (
                  <UndecryptableMessage
                    key={ev.getId()}
                    event={ev}
                    isMe={isMe}
                  />
                );
              }
              const content = ev.getContent() as { body?: string };
              const body = content.body ?? "";
              return (
                <div
                  key={ev.getId()}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 ${
                      isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {!isMe && (
                      <div className="text-xs opacity-70 mb-1">{sender}</div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{body}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={onSend} className="border-t p-3 flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                ready ? "Type a message…" : (notReadyMessage(notReadyReason) || "Not ready")
              }
              disabled={sending || !ready}
              title={notReadyMessage(notReadyReason) || undefined}
            />
            <Button
              type="submit"
              disabled={sending || !text.trim() || !ready}
              title={notReadyMessage(notReadyReason) || undefined}
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

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

function UndecryptableMessage({
  event,
  isMe,
}: {
  event: MatrixEvent;
  isMe: boolean;
}) {
  const { client, session } = useMatrix();
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

  const peerState = usePeerKeyShareState(sessionId);

  useEffect(() => {
    if (!client) return;
    if (!sender || !sessionId || !senderKey || !roomId) return;
    void requestKeyFromPeers(client, {
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
        {hint && (
          <div className="text-xs text-muted-foreground">{hint}</div>
        )}
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

function peerKeyShareLine(
  state: ReturnType<typeof usePeerKeyShareState>,
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

const RECORD_FIELDS = [
  "firstName",
  "lastName",
  "dob",
  "phone",
  "email",
  "notes",
] as const;
type RecordField = (typeof RECORD_FIELDS)[number];

function diffRevisions(
  current: PatientRecordRevision,
  previous: PatientRecordRevision | null,
): { field: RecordField; from: string; to: string }[] {
  if (!previous) return [];
  const out: { field: RecordField; from: string; to: string }[] = [];
  for (const f of RECORD_FIELDS) {
    const a = (previous[f] ?? "") as string;
    const b = (current[f] ?? "") as string;
    if (a !== b) out.push({ field: f, from: a, to: b });
  }
  return out;
}

function ProfileHistory({
  history,
  currentSelf,
}: {
  history: PatientRecordRevision[];
  currentSelf: string | null;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Profile history</h2>
        <p className="text-xs text-muted-foreground">
          {history.length === 0
            ? "No revisions yet."
            : `${history.length} revision${history.length === 1 ? "" : "s"} — newest first`}
        </p>
      </div>
      {history.length > 0 && (
        <ol className="divide-y max-h-[480px] overflow-y-auto">
          {history.map((rev, i) => {
            const previous = history[i + 1] ?? null;
            const changes = diffRevisions(rev, previous);
            const isMe = rev.sender === currentSelf;
            return (
              <li key={rev.eventId} className="px-4 py-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {new Date(rev.ts).toLocaleString()}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {isMe ? "you" : rev.sender}
                    </span>
                  </div>
                  {rev.isRoot && (
                    <Badge variant="secondary" className="text-xs">
                      Initial
                    </Badge>
                  )}
                </div>
                {rev.isRoot || !previous ? (
                  <div className="text-muted-foreground">
                    Created with name{" "}
                    <span className="font-medium">{fullName(rev)}</span>.
                  </div>
                ) : changes.length === 0 ? (
                  <div className="text-muted-foreground italic">
                    No field changes (resaved).
                  </div>
                ) : (
                  <ul className="space-y-0.5">
                    {changes.map((c) => (
                      <li key={c.field} className="font-mono text-xs">
                        <span className="text-muted-foreground">
                          {c.field}:{" "}
                        </span>
                        <span className="line-through text-muted-foreground/70">
                          {c.from || "∅"}
                        </span>
                        <span className="mx-1">→</span>
                        <span>{c.to || "∅"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
