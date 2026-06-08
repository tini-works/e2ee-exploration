"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { scopedValue, useScopedValue } from "@pumped-fn/lite-react";
import { MoreVertical, Paperclip } from "lucide-react";
import type { MatrixEvent } from "matrix-client/message";
import { matrixReact } from "matrix-client/react";
import { matrixMessage } from "matrix-client/message";
import { matrixRooms } from "matrix-client/rooms";
import { matrixAttachment, type AttachmentStore } from "matrix-client/attachment";
import { notReadyMessage } from "@/lib/not-ready-message";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { createS3AttachmentStore } from "./s3-attachment-store";
import { AttachmentMessage } from "./attachment-message";
import { UndecryptableMessage } from "./undecryptable-message";

// Derive the matrix client type from the API rather than importing
// matrix-js-sdk directly (project rule: go through matrix-client).
type MatrixClient = Parameters<typeof matrixMessage.send>[0];

/**
 * Composer form state in a pumped scopedValue. The send action validates the
 * draft and drives matrixMessage.send(); the React layer hands it the `client`
 * and `roomId` since those live outside the scope.
 */
export const composerForm = scopedValue({
  name: "message-composer",
  initial: () => ({ text: "", sending: false, uploading: false }),
  actions: ({ get, patch }) => ({
    setText: (text: string) => patch({ text }),
    setUploading: (uploading: boolean) => patch({ uploading }),
    async send(client: MatrixClient, roomId: string) {
      const body = get().text.trim();
      if (!body || get().sending) return;
      patch({ sending: true });
      try {
        await matrixMessage.send(client, roomId, body);
        patch({ text: "" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        patch({ sending: false });
      }
    },
  }),
});

/** Encrypted message timeline + composer for one patient room. */
export function MessageTimeline({ roomId }: { roomId: string }) {
  const { client, session, ready, notReadyReason } = matrixReact.useMatrix();
  const selfUserId = session?.userId ?? null;

  const [messages, setMessages] = useState<MatrixEvent[]>([]);
  const composer = useScopedValue(composerForm);
  const { text, sending, uploading } = composer.snapshot;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const store = useMemo<AttachmentStore>(() => createS3AttachmentStore(), []);

  useEffect(() => {
    if (!client) return;
    const refresh = () => setMessages(matrixMessage.list(client, roomId));
    refresh();
    return matrixRooms.subscribe(client, refresh);
  }, [client, roomId]);

  // Jump to the newest message on load and whenever the timeline changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-grow the composer up to a max height as the text gets longer.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const submitMessage = () => {
    if (!client || !ready) return;
    void composer.actions.send(client, roomId);
  };

  const onSend = (e: React.FormEvent) => {
    e.preventDefault();
    void submitMessage();
  };

  // Enter sends; Shift+Enter inserts a newline.
  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitMessage();
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!client || !ready || !file) return;
    composer.actions.setUploading(true);
    const t = toast.loading(`Encrypting & uploading ${file.name}…`);
    try {
      await matrixAttachment.send(client, roomId, file, store, (loaded, total) =>
        toast.loading(
          `Uploading ${file.name}… ${Math.round((loaded / total) * 100)}%`,
          { id: t },
        ),
      );
      toast.success(`Sent ${file.name}`, { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), { id: t });
    } finally {
      composer.actions.setUploading(false);
    }
  };

  const onDelete = async (ev: MatrixEvent) => {
    const eventId = ev.getId();
    if (!client || !eventId) return;
    // Capture the object key BEFORE redacting — redaction wipes the content.
    const attachment = matrixAttachment.read(ev.getContent());
    try {
      await matrixMessage.delete(client, roomId, eventId);
      if (attachment) await store.remove(attachment.file.url);
      toast.success("Message deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  // Toast-action confirm (rule-no-confirm: no native confirm dialogs).
  const requestDelete = (ev: MatrixEvent) => {
    toast("Delete this message?", {
      action: { label: "Delete", onClick: () => void onDelete(ev) },
    });
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm lg:col-span-7">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Encrypted timeline</h2>
        <p className="text-xs text-muted-foreground">
          Messages are visible only to members of this room.
        </p>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[560px] overflow-y-auto p-4 space-y-2 text-sm"
      >
        {messages.length === 0 && (
          <div className="text-muted-foreground text-center py-8">
            No messages yet.
          </div>
        )}
        {messages.map((ev) => {
          const sender = ev.getSender();
          const isMe = sender === selfUserId;
          if (ev.isDecryptionFailure()) {
            return (
              <UndecryptableMessage key={ev.getId()} event={ev} isMe={isMe} />
            );
          }
          if (ev.isRedacted()) {
            return (
              <div
                key={ev.getId()}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[75%] rounded-lg border border-dashed px-3 py-2 text-xs italic text-muted-foreground">
                  Message deleted
                </div>
              </div>
            );
          }
          const attachment = matrixAttachment.read(ev.getContent());
          if (attachment) {
            return (
              <AttachmentMessage
                key={ev.getId()}
                file={attachment.file}
                info={attachment.info}
                isMe={isMe}
                sender={sender ?? ""}
                store={store}
                onDelete={isMe ? () => requestDelete(ev) : undefined}
              />
            );
          }
          const content = ev.getContent() as { body?: string };
          const body = content.body ?? "";
          return (
            <div
              key={ev.getId()}
              className={`group flex items-center gap-1 ${isMe ? "justify-end" : "justify-start"}`}
            >
              {isMe && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Options"
                        className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => requestDelete(ev)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <div
                className={
                  isMe
                    ? "max-w-[75%] rounded-2xl bg-muted px-4 py-2.5 text-foreground"
                    : "max-w-[85%] py-0.5"
                }
              >
                {!isMe && (
                  <div className="text-xs text-muted-foreground mb-1">
                    {sender}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{body}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={onSend} className="border-t p-3 flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onPickFile}
          disabled={uploading || !ready}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !ready}
          title={
            ready
              ? "Attach an encrypted file"
              : notReadyMessage(notReadyReason) || undefined
          }
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => composer.actions.setText(e.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder={
            ready ? "Type a message…" : notReadyMessage(notReadyReason) || "Not ready"
          }
          disabled={sending || !ready}
          title={notReadyMessage(notReadyReason) || undefined}
          className="min-h-8 max-h-40 w-full min-w-0 flex-1 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
  );
}
