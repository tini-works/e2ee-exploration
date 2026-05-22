"use client";

import { useEffect, useState } from "react";
import { useMatrix } from "@/lib/matrix/provider";
import {
  generateRecoveryKey,
  hasSecretStorage,
  unlockWithSecurityKey,
} from "@/lib/matrix/secret-storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function StatusBar() {
  const {
    client,
    status,
    syncState,
    lastSyncedAt,
    cryptoStatus,
    session,
    ready,
    notReadyReason,
    pendingBackup,
    pendingInvites,
    acceptInvite,
    declineInvite,
    signOut,
    resetBackup,
    markKeyUnlocked,
  } = useMatrix();
  const [now, setNow] = useState(() => Date.now());

  const [invitesOpen, setInvitesOpen] = useState(false);
  const [invitePending, setInvitePending] = useState<string | null>(null);

  const [keyOpen, setKeyOpen] = useState(false);
  const [keying, setKeying] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  // null = still probing; true = SSSS exists (Enter mode); false = no SSSS
  // (Generate mode).
  const [hasSSSS, setHasSSSS] = useState<boolean | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!keyOpen || !client) {
      setHasSSSS(null);
      return;
    }
    let cancelled = false;
    setHasSSSS(null);
    void hasSecretStorage(client).then((v) => {
      if (!cancelled) setHasSSSS(v);
    });
    return () => {
      cancelled = true;
    };
  }, [keyOpen, client]);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSecurityKey, setResetSecurityKey] = useState("");

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const closeKey = () => {
    setKeyOpen(false);
    setKeyValue("");
    setGeneratedKey(null);
  };

  const confirmKey = async () => {
    if (!client) return;
    if (!keyValue.trim()) return;
    setKeying(true);
    try {
      const outcome = await unlockWithSecurityKey(client, keyValue.trim());
      markKeyUnlocked();
      const imported = outcome.keyBackupRestored?.imported ?? 0;
      toast.success(
        imported > 0
          ? `Unlocked. Restored ${imported} message key${imported === 1 ? "" : "s"} from backup.`
          : "Unlocked.",
      );
      closeKey();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setKeying(false);
    }
  };

  const confirmGenerate = async () => {
    if (!client) return;
    setKeying(true);
    try {
      const { recoveryKey } = await generateRecoveryKey(client);
      setGeneratedKey(recoveryKey);
      markKeyUnlocked();
      toast.success("Recovery key generated. Save it before closing.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setKeying(false);
    }
  };

  const copyGenerated = async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      toast.success("Copied to clipboard.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const closeReset = () => {
    setResetOpen(false);
    setResetSecurityKey("");
  };

  const confirmReset = async () => {
    if (!resetSecurityKey.trim()) return;
    setResetting(true);
    try {
      await resetBackup(resetSecurityKey.trim());
      toast.success(
        "Backup reset. Other devices will re-upload their keys here.",
      );
      closeReset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  };

  const confirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      setSignOutOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={ready ? "default" : "destructive"}>
            {ready ? "Ready" : "Read-only"}
          </Badge>
          <Badge variant={sync.variant}>{sync.label}</Badge>
          <Badge variant={encOk ? "default" : "secondary"}>
            {encOk ? "E2E ready" : "E2E locked"}
          </Badge>
          <Badge variant={backupOn ? "default" : "secondary"}>
            {backupOn ? `Backup v${cryptoStatus?.backupVersion}` : "No backup"}
          </Badge>
          {backupOn && pendingBackup > 0 && (
            <Badge variant="secondary">
              Uploading {pendingBackup} key{pendingBackup === 1 ? "" : "s"}…
            </Badge>
          )}
          {pendingInvites.length > 0 && (
            <button
              type="button"
              onClick={() => setInvitesOpen(true)}
              title="Review pending room invites."
              className="cursor-pointer"
            >
              <Badge variant="destructive">
                {pendingInvites.length} invite
                {pendingInvites.length === 1 ? "" : "s"}
              </Badge>
            </button>
          )}
          {lastSyncedAt && (
            <span className="text-muted-foreground">
              synced {formatAgo(lastSyncedAt, now)}
            </span>
          )}
          {session?.userId && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(session.userId);
                  toast.success("User ID copied.");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : String(err));
                }
              }}
              title="Copy user ID"
              className="text-muted-foreground font-mono hover:text-foreground cursor-pointer"
            >
              {session.userId}
            </button>
          )}
          {session?.deviceId && (
            <span className="text-muted-foreground font-mono">
              {session.deviceId}
            </span>
          )}
          {!ready && notReadyReason && (
            <span className="text-destructive">{notReadyReason}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKeyOpen(true)}
            title="Unlock encrypted history by entering your recovery key."
          >
            Recovery key
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setResetOpen(true)}
            title="Create a fresh key backup. Only do this if your current backup is broken."
          >
            Reset backup
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pendingBackup > 0}
            onClick={() => setSignOutOpen(true)}
            title={
              pendingBackup > 0
                ? `Backing up ${pendingBackup} key${pendingBackup === 1 ? "" : "s"}… please wait`
                : undefined
            }
          >
            {pendingBackup > 0
              ? `Backing up ${pendingBackup}…`
              : "Sign out"}
          </Button>
        </div>
      </div>

      <Dialog
        open={keyOpen}
        onOpenChange={(o) => {
          if (keying) return;
          if (!o) closeKey();
          else setKeyOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          {generatedKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Save your recovery key</DialogTitle>
                <DialogDescription>
                  Write this down or copy it to a password manager. This is
                  the only time it will be shown. Without it you can&apos;t
                  read encrypted messages on other devices.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
                {generatedKey}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={copyGenerated}>
                  Copy
                </Button>
                <Button onClick={closeKey}>I&apos;ve saved it</Button>
              </div>
            </>
          ) : hasSSSS === null ? (
            <>
              <DialogHeader>
                <DialogTitle>Recovery key</DialogTitle>
                <DialogDescription>
                  Checking your account&apos;s secret storage…
                </DialogDescription>
              </DialogHeader>
            </>
          ) : hasSSSS ? (
            <>
              <DialogHeader>
                <DialogTitle>Enter recovery key</DialogTitle>
                <DialogDescription>
                  Loads the backup decryption key into this browser&apos;s
                  crypto store so messages sent from other devices can be
                  decrypted.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="cache-security-key" className="text-xs">
                  Recovery key
                </Label>
                <PasswordInput
                  id="cache-security-key"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder="EsTz cDAu oLhr WV1d …"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={keying}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeKey} disabled={keying}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmKey}
                  disabled={keying || !keyValue.trim()}
                >
                  {keying ? "Unlocking…" : "Unlock"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Set up recovery key</DialogTitle>
                <DialogDescription>
                  Your account doesn&apos;t have secret storage set up yet.
                  Generate a recovery key to enable encrypted backups and
                  cross-device decryption.
                </DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                We&apos;ll create a new secret storage entry, store your
                cross-signing keys in it, and create a new key backup — all
                encrypted under the recovery key shown next.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeKey} disabled={keying}>
                  Cancel
                </Button>
                <Button onClick={confirmGenerate} disabled={keying}>
                  {keying ? "Generating…" : "Generate recovery key"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetOpen}
        onOpenChange={(o) => {
          if (resetting) return;
          if (!o) closeReset();
          else setResetOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Reset key backup?</DialogTitle>
            <DialogDescription>
              This creates a new server-side backup version and stores a fresh
              decryption key in your secret storage. Use this only when the
              current backup is in a broken state (e.g. the recovery key
              doesn&apos;t match the backup).
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>
              <span className="font-medium text-foreground">What changes:</span>{" "}
              the previous backup is replaced. Other devices will detect the
              new version and re-upload their message keys.
            </p>
            <p>
              <span className="font-medium text-foreground">What you lose:</span>{" "}
              any Megolm sessions that lived only in the old backup are
              unreachable. Past messages where the sender device still has the
              session locally will eventually become readable again.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-security-key" className="text-xs">
              Recovery key (needed to encrypt the new backup key into SSSS)
            </Label>
            <PasswordInput
              id="reset-security-key"
              value={resetSecurityKey}
              onChange={(e) => setResetSecurityKey(e.target.value)}
              placeholder="EsTz cDAu oLhr WV1d …"
              autoComplete="off"
              spellCheck={false}
              disabled={resetting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={closeReset}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReset}
              disabled={resetting || !resetSecurityKey.trim()}
            >
              {resetting ? "Resetting…" : "Reset backup"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={signOutOpen}
        onOpenChange={(o) => !signingOut && setSignOutOpen(o)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Sign out of this device?</DialogTitle>
            <DialogDescription>
              The session token will be revoked and this browser&apos;s local
              message keys, room cache, and SSSS cache will be wiped. Other
              devices stay signed in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setSignOutOpen(false)}
              disabled={signingOut}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <p className="text-sm text-muted-foreground">
              No pending invites.
            </p>
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
