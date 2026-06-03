"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MatrixClient, Room } from "matrix-js-sdk";
import { matrixReact } from "matrix-client/react";
import { matrixPatient } from "matrix-client/patient";
import { matrixRooms } from "matrix-client/rooms";
import { CLINICS, findClinicByUserId, isClinicUser } from "@/lib/config";
import { notReadyMessage } from "@/lib/not-ready-message";
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

export function PatientClinics() {
  const { client, session, ready, notReadyReason } = matrixReact.useMatrix();
  const { accept: acceptInvite, decline: declineInvite } =
    matrixPatient.useInvites();
  const [relations, setRelations] = useState<ClinicRelation[]>([]);
  const [busyRoom, setBusyRoom] = useState<string | null>(null);

  const userIsClinic = isClinicUser(session?.userId);

  useEffect(() => {
    if (!client || userIsClinic) return;
    const refresh = () => setRelations(listClinicRelations(client));
    refresh();
    return matrixRooms.subscribe(client, refresh);
  }, [client, userIsClinic]);

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

  if (userIsClinic) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Patient view only
        </h1>
        <p className="text-sm text-muted-foreground">
          The Clinics page is for patient accounts. As a clinic operator, manage
          your records from the Patients tab.
        </p>
        <Button variant="outline" render={<Link href="/patients">Go to Patients</Link>} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Clinics
        </h1>
        <p className="text-sm text-muted-foreground">
          Clinics that have started a record for you — {relations.length} record
          {relations.length === 1 ? "" : "s"}.
        </p>
      </section>

      {relations.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No clinics have invited you yet. When a clinic creates a record for
          you, it will appear here.
        </div>
      ) : (
        <ul className="space-y-2">
          {relations.map((rel) => {
            const busy = busyRoom === rel.roomId;
            const isInvite = rel.membership === "invite";
            const body = (
              <div className="min-w-0 space-y-1">
                <div className="font-medium truncate">{rel.clinicName}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {rel.clinicUserId}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  Room: {rel.roomName}
                </div>
              </div>
            );
            return (
              <li
                key={rel.roomId}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
              >
                {isInvite ? (
                  body
                ) : (
                  <Link
                    href={`/clinics/${encodeURIComponent(rel.roomId)}`}
                    className="min-w-0 flex-1 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {body}
                  </Link>
                )}
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
                        title={
                          !ready ? notReadyMessage(notReadyReason) : undefined
                        }
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
    </div>
  );
}
