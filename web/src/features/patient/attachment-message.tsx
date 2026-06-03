"use client";

import { useEffect, useState } from "react";
import { Loader2, MoreVertical, Paperclip } from "lucide-react";
import {
  matrixAttachment,
  type AttachmentInfo,
  type AttachmentStore,
  type EncryptedFile,
} from "matrix-client/attachment";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Renders an encrypted attachment. Click to fetch + decrypt in-browser, then
 * preview it inline in the chat bubble (images and PDFs render directly; other
 * types get Open/Download). The event itself decrypted fine (megolm), so
 * failures here are at the storage/integrity/decrypt layer — surfaced with
 * enough detail to debug (per AGENTS.md), distinct from a megolm UTD.
 */
export function AttachmentMessage({
  file,
  info,
  isMe,
  sender,
  store,
  onDelete,
}: {
  file: EncryptedFile;
  info: AttachmentInfo;
  isMe: boolean;
  sender: string;
  store: AttachmentStore;
  onDelete?: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; integrity: boolean }>({
    message: "",
    integrity: false,
  });

  // Revoke the decrypted blob URL when it changes or the bubble unmounts.
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const isImage = info.mimetype.startsWith("image/");
  const isPdf = info.mimetype === "application/pdf";

  const onOpen = async () => {
    if (status === "loading" || status === "ready") return;
    setStatus("loading");
    try {
      const buf = await matrixAttachment.fetchDecrypted(file, store);
      setObjectUrl(URL.createObjectURL(new Blob([buf], { type: info.mimetype })));
      setStatus("ready");
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : String(err),
        integrity: err instanceof matrixAttachment.IntegrityError,
      });
      setStatus("error");
    }
  };

  const saveBlobUrl = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = info.name;
    a.click();
  };

  // Download decrypts on demand if the file hasn't been previewed yet.
  const onDownload = async () => {
    if (objectUrl) {
      saveBlobUrl(objectUrl);
      return;
    }
    setStatus("loading");
    try {
      const buf = await matrixAttachment.fetchDecrypted(file, store);
      const url = URL.createObjectURL(new Blob([buf], { type: info.mimetype }));
      setObjectUrl(url); // tracked for revoke on unmount
      setStatus("ready");
      saveBlobUrl(url);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : String(err),
        integrity: err instanceof matrixAttachment.IntegrityError,
      });
      setStatus("error");
    }
  };

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isMe
            ? "max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 space-y-2 text-foreground"
            : "max-w-[85%] py-0.5 space-y-2"
        }
      >
        {!isMe && (
          <div className="text-xs text-muted-foreground">{sender}</div>
        )}

        {/* Header: click the row to decrypt + preview; ⋮ menu for download/delete */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpen}
            disabled={status === "loading" || status === "ready"}
            title={status === "idle" ? "Click to decrypt & preview" : undefined}
            className="-mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-foreground/5 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <Paperclip className="h-4 w-4 shrink-0 opacity-80" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{info.name}</div>
              <div className="text-xs opacity-70">
                {info.mimetype} · {formatBytes(info.size)}
              </div>
            </div>
            {status === "loading" && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" />
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100"
                  title="Options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void onDownload()}>
                Download
              </DropdownMenuItem>
              {onDelete && (
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Decrypted inline preview */}
        {status === "ready" && objectUrl && (
          <div className="space-y-2">
            {isImage ? (
              // Decrypted in-memory blob URL — next/image can't optimize blob: URLs.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt={info.name}
                className="max-h-80 w-auto rounded border bg-background"
              />
            ) : isPdf ? (
              <iframe
                src={objectUrl}
                title={info.name}
                className="h-96 w-full rounded border bg-background"
              />
            ) : (
              <div className="text-xs opacity-70">
                Decrypted — use the ⋮ menu to download (no inline preview for
                this type).
              </div>
            )}
          </div>
        )}

        {/* Storage/integrity/decrypt failure diagnostic */}
        {status === "error" && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs space-y-1 text-foreground">
            <div className="font-medium text-destructive">
              {error.integrity
                ? "Integrity check failed — ciphertext does not match the hash in the message. The stored file may be corrupted or tampered."
                : "Couldn't fetch or decrypt this attachment."}
            </div>
            <pre className="font-mono whitespace-pre-wrap break-all bg-background/60 rounded px-2 py-1.5">
              {[
                `object_key: ${file.url}`,
                `sha256:     ${file.hashes.sha256}`,
                `mimetype:   ${info.mimetype}`,
                `size:       ${info.size}`,
                `error:      ${error.message}`,
              ].join("\n")}
            </pre>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setStatus("idle");
                  void onOpen();
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
