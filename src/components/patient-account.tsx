"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MatrixClient, Room } from "matrix-js-sdk";
import { useMatrix } from "@/lib/matrix/provider";
import { subscribeRooms } from "@/lib/matrix/patients";
import { CLINICS, findClinicByUserId, isClinicUser } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Membership = "invite" | "join";

type ClinicRelation = {
  clinicName: string;
  clinicUserId: string;
  roomId: string;
  roomName: string;
  membership: Membership;
};

function findClinicMember(room: Room): string | null {
  for (const clinic of CLINICS) {
    const member = room.getMember(clinic.userId);
    if (member) return clinic.userId;
  }
  return null;
}

function listClinicRelations(client: MatrixClient): ClinicRelation[] {
  const rels: ClinicRelation[] = [];
  for (const room of client.getRooms()) {
    const membership = room.getMyMembership();
    if (membership !== "invite" && membership !== "join") continue;
    const clinicUserId = findClinicMember(room);
    if (!clinicUserId) continue;
    const clinic = findClinicByUserId(clinicUserId);
    if (!clinic) continue;
    rels.push({
      clinicName: clinic.name,
      clinicUserId,
      roomId: room.roomId,
      roomName: room.name ?? "(unnamed room)",
      membership: membership as Membership,
    });
  }
  return rels.sort((a, b) => a.clinicName.localeCompare(b.clinicName));
}

export function PatientAccount() {
  const { client, session, acceptInvite, declineInvite, ready, notReadyReason } =
    useMatrix();
  const [relations, setRelations] = useState<ClinicRelation[]>([]);
  const [busyRoom, setBusyRoom] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    const refresh = () => setRelations(listClinicRelations(client));
    refresh();
    return subscribeRooms(client, refresh);
  }, [client]);

  const userIsClinic = isClinicUser(session?.userId);
  const ownClinic = useMemo(
    () => findClinicByUserId(session?.userId),
    [session?.userId],
  );

  const handleAccept = async (roomId: string, clinicName: string) => {
    setBusyRoom(roomId);
    try {
      await acceptInvite(roomId);
      toast.success(`Joined ${clinicName}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyRoom(null);
    }
  };

  const handleDecline = async (roomId: string) => {
    setBusyRoom(roomId);
    try {
      await declineInvite(roomId);
      toast.success("Declined.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyRoom(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="text-sm text-muted-foreground">
          This is the patient-side view of your Matrix account. Clinics that
          have started a record for you appear below.
        </p>
      </section>

      <section className="rounded-md border p-4 space-y-3">
        <div className="text-sm font-medium">Profile</div>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">User ID</dt>
          <dd className="font-mono break-all">{session?.userId ?? "—"}</dd>
          <dt className="text-muted-foreground">Device</dt>
          <dd className="font-mono break-all">{session?.deviceId ?? "—"}</dd>
          <dt className="text-muted-foreground">Homeserver</dt>
          <dd className="font-mono break-all">{session?.baseUrl ?? "—"}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>
            {userIsClinic ? (
              <span className="inline-flex items-center gap-2">
                <Badge>Clinic</Badge>
                <span className="text-muted-foreground">
                  {ownClinic?.name}
                </span>
              </span>
            ) : (
              <Badge variant="secondary">Patient</Badge>
            )}
          </dd>
        </dl>
        {userIsClinic && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/patients">Open patient list</Link>}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Clinics</h2>
          <span className="text-xs text-muted-foreground">
            {relations.length} record{relations.length === 1 ? "" : "s"}
          </span>
        </div>
        {relations.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No clinics have invited you yet. When a clinic creates a record for
            you, it will appear here.
          </div>
        ) : (
          <ul className="space-y-2">
            {relations.map((rel) => {
              const busy = busyRoom === rel.roomId;
              const isInvite = rel.membership === "invite";
              return (
                <li
                  key={rel.roomId}
                  className="flex items-center justify-between gap-3 rounded-md border px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium truncate">{rel.clinicName}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {rel.clinicUserId}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Room: {rel.roomName}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={isInvite ? "destructive" : "default"}>
                      {isInvite ? "Invited" : "Joined"}
                    </Badge>
                    {isInvite ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || !!busyRoom}
                          onClick={() => handleDecline(rel.roomId)}
                        >
                          {busy ? "…" : "Decline"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy || !!busyRoom || !ready}
                          title={!ready ? notReadyReason ?? undefined : undefined}
                          onClick={() => handleAccept(rel.roomId, rel.clinicName)}
                        >
                          {busy ? "…" : "Accept"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
