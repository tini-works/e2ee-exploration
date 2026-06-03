"use client";

import { useEffect, useState } from "react";
import { matrixReact } from "matrix-client/react";
import { matrixPatient } from "matrix-client/patient";
import { matrixCrypto } from "matrix-client/crypto";
import { notReadyMessage } from "@/lib/not-ready-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatAgo(ts: number, now: number): string {
  const secs = Math.max(0, Math.floor((now - ts) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function syncLabel(state: string | null): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (state) {
    case "PREPARED":
    case "SYNCING":
      return { label: "Synced", variant: "default" };
    case "CATCHUP":
      return { label: "Catching up", variant: "secondary" };
    case "RECONNECTING":
      return { label: "Reconnecting", variant: "secondary" };
    case "ERROR":
      return { label: "Sync error", variant: "destructive" };
    case "STOPPED":
      return { label: "Stopped", variant: "destructive" };
    default:
      return { label: state ?? "Connecting", variant: "secondary" };
  }
}

export function SystemStatus() {
  const {
    status,
    syncState,
    lastSyncedAt,
    cryptoStatus,
    ready,
    notReadyReason,
    pendingBackup,
  } = matrixReact.useMatrix();
  const {
    invites: pendingInvites,
    accept: acceptInvite,
    decline: declineInvite,
  } = matrixPatient.useInvites();

  const [now, setNow] = useState(() => Date.now());
  const [invitesOpen, setInvitesOpen] = useState(false);
  const [invitePending, setInvitePending] = useState<string | null>(null);

  const verification = matrixCrypto.useDeviceVerification();
  const deviceVerified = verification?.deviceVerified ?? null;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (status !== "ready") return null;

  const sync = syncLabel(syncState);
  const encOk =
    !!cryptoStatus &&
    cryptoStatus.crossSigningReady &&
    cryptoStatus.secretStorageReady;
  const backupOn = !!cryptoStatus?.backupVersion;

  const health: "ok" | "warn" | "attention" = !ready
    ? "attention"
    : !encOk || deviceVerified === false
      ? "warn"
      : "ok";

  const healthLabel =
    health === "attention"
      ? "Read-only"
      : health === "warn"
        ? "Action needed"
        : "Secure";

  const dotClass =
    health === "attention"
      ? "bg-destructive"
      : health === "warn"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="gap-2">
              <span className="relative flex size-2">
                {health === "ok" && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
                )}
                <span
                  className={cn(
                    "relative inline-flex size-2 rounded-full",
                    dotClass,
                  )}
                />
              </span>
              <span className="hidden sm:inline">{healthLabel}</span>
              {pendingInvites.length > 0 && (
                <Badge variant="destructive" className="ml-0.5">
                  {pendingInvites.length}
                </Badge>
              )}
            </Button>
          }
        />
        <PopoverContent align="end" className="w-80 space-y-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">System status</div>
            <p className="text-xs text-muted-foreground">
              End-to-end encryption, sync, and key-backup health for this
              device.
            </p>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={ready ? "default" : "destructive"}>
              {ready ? "Ready" : "Read-only"}
            </Badge>
            <Badge variant={sync.variant}>{sync.label}</Badge>
            <Badge variant={encOk ? "default" : "secondary"}>
              {encOk ? "E2E ready" : "E2E locked"}
            </Badge>
            <Badge
              variant={
                deviceVerified === null
                  ? "secondary"
                  : deviceVerified
                    ? "default"
                    : "destructive"
              }
              title={
                deviceVerified === null
                  ? "Checking device verification…"
                  : deviceVerified
                    ? "This device is signed by your account's cross-signing key."
                    : "This device is not cross-signed. Unlock with your recovery key to verify it."
              }
            >
              {deviceVerified === null
                ? "Device …"
                : deviceVerified
                  ? "Device verified"
                  : "Device unverified"}
            </Badge>
            <Badge variant={backupOn ? "default" : "secondary"}>
              {backupOn ? `Backup v${cryptoStatus?.backupVersion}` : "No backup"}
            </Badge>
            {backupOn && pendingBackup > 0 && (
              <Badge variant="secondary">
                Uploading {pendingBackup} key{pendingBackup === 1 ? "" : "s"}…
              </Badge>
            )}
          </div>
          {!ready && notReadyReason && (
            <p className="text-xs text-destructive">
              {notReadyMessage(notReadyReason)}
            </p>
          )}
          {lastSyncedAt && (
            <p className="text-xs text-muted-foreground">
              Last synced {formatAgo(lastSyncedAt, now)}
            </p>
          )}
          {pendingInvites.length > 0 && (
            <>
              <Separator />
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between"
                onClick={() => setInvitesOpen(true)}
              >
                Pending invites
                <Badge variant="destructive">{pendingInvites.length}</Badge>
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>

      <Dialog
        open={invitesOpen}
        onOpenChange={(o) => !invitePending && setInvitesOpen(o)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Pending invites</DialogTitle>
            <DialogDescription>
              Accept to join the room and tag it as a patient. Decline to
              reject the invite — the inviter is notified.
            </DialogDescription>
          </DialogHeader>
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          ) : (
            <ul className="space-y-2">
              {pendingInvites.map((inv) => {
                const busy = invitePending === inv.roomId;
                return (
                  <li
                    key={inv.roomId}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {inv.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        from {inv.inviterId ?? "unknown"}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!invitePending}
                        onClick={async () => {
                          setInvitePending(inv.roomId);
                          try {
                            await declineInvite(inv.roomId);
                            toast.success("Declined.");
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : String(err),
                            );
                          } finally {
                            setInvitePending(null);
                          }
                        }}
                      >
                        {busy ? "…" : "Decline"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!!invitePending}
                        onClick={async () => {
                          setInvitePending(inv.roomId);
                          try {
                            await acceptInvite(inv.roomId);
                            toast.success(`Joined ${inv.name}.`);
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : String(err),
                            );
                          } finally {
                            setInvitePending(null);
                          }
                        }}
                      >
                        {busy ? "…" : "Accept"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setInvitesOpen(false)}
              disabled={!!invitePending}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
