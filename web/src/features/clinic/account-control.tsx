"use client";

import { useState } from "react";
import { matrixReact } from "matrix-client/react";
import {
  ChevronsUpDownIcon,
  CopyIcon,
  KeyRoundIcon,
  LogOutIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
import { useRecoveryKey } from "./recovery-key-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function initials(userId: string | undefined): string {
  if (!userId) return "?";
  const name = userId.replace(/^@/, "");
  return name.slice(0, 2).toUpperCase();
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err));
  }
}

export function AccountControl() {
  const { session, pendingBackup, signOut } = matrixReact.useMatrix();
  const { state, isMobile } = useSidebar();
  const { openRecoveryKey, openResetBackup } = useRecoveryKey();

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const collapsed = state === "collapsed" && !isMobile;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground",
                collapsed && "justify-center",
              )}
            >
              <Avatar className="size-7 rounded-md">
                <AvatarFallback className="rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  {initials(session?.userId)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate font-medium">
                      {session?.userId ?? "Account"}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {pendingBackup > 0
                        ? `Backing up ${pendingBackup}…`
                        : (session?.deviceId ?? "")}
                    </span>
                  </div>
                  <ChevronsUpDownIcon className="size-4 shrink-0 opacity-60" />
                </>
              )}
            </button>
          }
        />
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-(--anchor-width) min-w-60"
        >
          <div className="space-y-2 p-1">
            {session?.userId && (
                <button
                  type="button"
                  onClick={() => copy(session.userId, "User ID")}
                  title="Copy user ID"
                  className="group flex w-full items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-left font-mono text-xs hover:bg-muted"
                >
                  <span className="truncate">{session.userId}</span>
                  <CopyIcon className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                </button>
              )}
              {session?.deviceId && (
                <button
                  type="button"
                  onClick={() => copy(session.deviceId, "Device ID")}
                  title="Copy device ID"
                  className="group flex w-full items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-left font-mono text-xs hover:bg-muted"
                >
                  <span className="truncate">{session.deviceId}</span>
                  <CopyIcon className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                </button>
              )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openRecoveryKey}>
            <KeyRoundIcon className="size-4" />
            Recovery key
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openResetBackup}>
            <RotateCcwIcon className="size-4" />
            Reset backup
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={pendingBackup > 0}
            onClick={() => setSignOutOpen(true)}
          >
            <LogOutIcon className="size-4" />
            {pendingBackup > 0 ? `Backing up ${pendingBackup}…` : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
    </>
  );
}
