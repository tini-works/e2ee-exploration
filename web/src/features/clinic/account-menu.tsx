"use client";

import { useMemo } from "react";
import { matrixReact } from "matrix-client/react";
import { findClinicByUserId, isClinicUser } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

function CopyField({ label, value }: { label: string; value: string }) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <button
        type="button"
        onClick={onCopy}
        title={`Copy ${label}`}
        className="group flex w-full items-center justify-between gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-left font-mono text-xs hover:bg-muted"
      >
        <span className="truncate">{value}</span>
        <CopyIcon className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
      </button>
    </div>
  );
}

export function AccountMenu() {
  const { session } = matrixReact.useMatrix();

  const userIsClinic = isClinicUser(session?.userId);
  const ownClinic = useMemo(
    () => findClinicByUserId(session?.userId),
    [session?.userId],
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Your Matrix identity and role on this device.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your Matrix identity and role.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {session?.userId && (
            <CopyField label="User ID" value={session.userId} />
          )}
          {session?.deviceId && (
            <CopyField label="Device" value={session.deviceId} />
          )}
          {session?.baseUrl && (
            <CopyField label="Homeserver" value={session.baseUrl} />
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">Role</span>
            {userIsClinic ? (
              <span className="inline-flex items-center gap-2">
                <Badge>Clinic</Badge>
                <span className="text-sm text-muted-foreground">
                  {ownClinic?.name}
                </span>
              </span>
            ) : (
              <Badge variant="secondary">Patient</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
