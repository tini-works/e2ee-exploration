"use client";

import { useEffect, useMemo, useState } from "react";
import { matrixReact } from "matrix-client/react";
import {
  matrixPatient,
  type MatrixPatient,
  type MatrixPatientRecordRevision,
} from "matrix-client/patient";
import { matrixRooms } from "matrix-client/rooms";
import { usePageLabel } from "@/features/clinic/app-shell";
import { CLINICS, type Clinic } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { EditPatientDialog } from "./patient-form";
import { ProfileHistory } from "./profile-history";
import { MessageTimeline } from "./message-timeline";

export function PatientDetail({
  roomId,
  variant = "clinic",
}: {
  roomId: string;
  /** "clinic" = the operator's editable view; "patient" = the patient's own read-only view of their record at a clinic. */
  variant?: "clinic" | "patient";
}) {
  const { client, session } = matrixReact.useMatrix();
  const isPatientView = variant === "patient";
  const [patient, setPatient] = useState<MatrixPatient | null>(null);
  const [history, setHistory] = useState<MatrixPatientRecordRevision[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);

  useEffect(() => {
    if (!client) return;
    const refresh = () => {
      setPatient(matrixPatient.get(client, roomId));
      setHistory(matrixPatient.listHistory(client, roomId));
      const room = client.getRoom(roomId);
      setClinic(
        room ? (CLINICS.find((c) => room.getMember(c.userId)) ?? null) : null,
      );
    };
    refresh();
    return matrixRooms.subscribe(client, refresh);
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

  usePageLabel(
    isPatientView
      ? (clinic?.name ?? null)
      : patient
        ? matrixPatient.fullName(patient.record)
        : null,
  );

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
      <div className="grid gap-6 lg:grid-cols-10 lg:items-start">
        <div className="space-y-6 lg:col-span-3">
          <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
            <div className="space-y-3">
              <div className="min-w-0">
                <h1 className="font-heading text-xl font-semibold tracking-tight break-words">
                  {isPatientView
                    ? (clinic?.name ?? "Your record")
                    : matrixPatient.fullName(r)}
                </h1>
                <div className="mt-1 text-xs text-muted-foreground">
                  {isPatientView ? (
                    "Your record at this clinic"
                  ) : (
                    <span className="font-mono break-all">{roomId}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!isPatientView && (
                  <EditPatientDialog roomId={roomId} initial={editInitial} />
                )}
                <Badge>E2E encrypted</Badge>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {isPatientView && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{matrixPatient.fullName(r)}</dd>
                </div>
              )}
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

        <MessageTimeline roomId={roomId} />
      </div>
    </div>
  );
}
