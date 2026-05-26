"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMatrix } from "matrix-client/react";
import {
  deletePatient,
  exportRoomEvents,
  fullName,
  listPatientHistory,
  listPatients,
  subscribeRooms,
  type Patient,
} from "matrix-client/patients";
import { notReadyMessage } from "@/lib/not-ready-message";
import { NewPatientDialog } from "./patient-form";
import { toast } from "sonner";

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "patient"
  );
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function PatientTable() {
  const { client, session, ready, notReadyReason } = useMatrix();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{
    roomId: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!client) return;
    const refresh = () => setPatients(listPatients(client));
    refresh();
    return subscribeRooms(client, refresh);
  }, [client]);

  const confirmDelete = async () => {
    if (!client || !ready || !pendingDelete) return;
    setDeleting(true);
    try {
      await deletePatient(client, pendingDelete.roomId);
      toast.success(`Removed ${pendingDelete.name}`);
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-mono">{session?.userId}</span> · each row is
            an E2E-encrypted Matrix room.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewPatientDialog />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>DOB</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[70px] text-right">Edits</TableHead>
              <TableHead className="w-[140px]">Room</TableHead>
              <TableHead className="w-[90px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-12"
                >
                  No patients yet. Click <b>New patient</b> to create one.
                </TableCell>
              </TableRow>
            )}
            {patients.map((p) => (
              <TableRow key={p.roomId}>
                <TableCell className="font-medium">
                  <Link
                    href={`/patients/${encodeURIComponent(p.roomId)}`}
                    className="hover:underline"
                  >
                    {fullName(p.record)}
                  </Link>
                </TableCell>
                <TableCell>{p.record.dob || "—"}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    {p.record.phone && <div>{p.record.phone}</div>}
                    {p.record.email && (
                      <div className="text-muted-foreground">
                        {p.record.email}
                      </div>
                    )}
                    {!p.record.phone && !p.record.email && "—"}
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {p.record.notes || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(p.record.updatedAt)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {p.record.updatedTimes}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {p.roomId.slice(0, 10)}…
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      title="Open"
                      aria-label="Open patient"
                      render={
                        <Link
                          href={`/patients/${encodeURIComponent(p.roomId)}`}
                        >
                          <ArrowRight className="size-4" />
                        </Link>
                      }
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon">
                            ⋯
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            if (!client) return;
                            const history = listPatientHistory(
                              client,
                              p.roomId,
                            );
                            const events = exportRoomEvents(client, p.roomId);
                            downloadJson(
                              `patient-${slugify(fullName(p.record))}-${p.roomId.slice(1, 11)}.json`,
                              {
                                exportedAt: new Date().toISOString(),
                                roomId: p.roomId,
                                record: p.record,
                                history,
                                events,
                              },
                            );
                          }}
                        >
                          Export JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setPendingDelete({
                              roomId: p.roomId,
                              name: fullName(p.record),
                            })
                          }
                          variant="destructive"
                          disabled={!ready}
                          title={notReadyMessage(notReadyReason) || undefined}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete patient?</DialogTitle>
            <DialogDescription>
              This permanently removes the patient room for{" "}
              <span className="font-medium">{pendingDelete?.name}</span>. You
              can&apos;t undo this.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
