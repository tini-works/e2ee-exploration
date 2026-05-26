"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMatrix } from "matrix-client/react";
import {
  createPatient,
  updatePatient,
  type PatientRecord,
} from "matrix-client/patients";
import { notReadyMessage } from "@/lib/not-ready-message";
import { toast } from "sonner";

type FormValues = Omit<PatientRecord, "updatedAt" | "updatedTimes">;

const EMPTY: FormValues = {
  firstName: "",
  lastName: "",
  dob: "",
  phone: "",
  email: "",
  notes: "",
};

function PatientFormFields({
  values,
  onChange,
}: {
  values: FormValues;
  onChange: (next: FormValues) => void;
}) {
  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    onChange({ ...values, [k]: v });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input
            id="dob"
            type="date"
            value={values.dob ?? ""}
            onChange={(e) => set("dob", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={values.phone ?? ""}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={values.email ?? ""}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </>
  );
}

const MATRIX_ID_RE = /^@[^:\s]+:[^:\s]+$/;

export function NewPatientDialog({ onCreated }: { onCreated?: () => void }) {
  const { client, ready, notReadyReason } = useMatrix();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [inviteInput, setInviteInput] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !ready) return;
    const inviteId = inviteInput.trim();
    if (inviteId && !MATRIX_ID_RE.test(inviteId)) {
      toast.error(
        `Not a valid Matrix user ID: ${inviteId}. Expected @user:server.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      await createPatient(client, values, {
        inviteUserIds: inviteId ? [inviteId] : [],
      });
      const display = `${values.firstName} ${values.lastName}`.trim();
      toast.success(
        inviteId
          ? `Patient room created for ${display}; invited ${inviteId}.`
          : `Patient room created for ${display}`,
      );
      setValues(EMPTY);
      setInviteInput("");
      setOpen(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={!ready} title={notReadyMessage(notReadyReason) || undefined}>
            New patient
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New patient</DialogTitle>
            <DialogDescription>
              Creates an end-to-end encrypted Matrix room for this patient.
            </DialogDescription>
          </DialogHeader>
          <PatientFormFields values={values} onChange={setValues} />
          <div className="space-y-2">
            <Label htmlFor="invite">Invite Matrix user (optional)</Label>
            <Input
              id="invite"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="@alice:example.org"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              They&apos;ll be invited to the room and can decrypt every
              message from creation onward.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                submitting ||
                !values.firstName.trim() ||
                !values.lastName.trim() ||
                !ready
              }
              title={notReadyMessage(notReadyReason) || undefined}
            >
              {submitting ? "Creating…" : "Create patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditPatientDialog({
  roomId,
  initial,
  onUpdated,
}: {
  roomId: string;
  initial: FormValues;
  onUpdated?: () => void;
}) {
  const { ready, notReadyReason } = useMatrix();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            disabled={!ready}
            title={notReadyMessage(notReadyReason) || undefined}
          >
            Edit profile
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        {open && (
          <EditPatientForm
            roomId={roomId}
            initial={initial}
            onDone={() => {
              setOpen(false);
              onUpdated?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditPatientForm({
  roomId,
  initial,
  onDone,
}: {
  roomId: string;
  initial: FormValues;
  onDone: () => void;
}) {
  const { client, ready, notReadyReason } = useMatrix();
  const [values, setValues] = useState<FormValues>(initial);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !ready) return;
    setSubmitting(true);
    try {
      await updatePatient(client, roomId, values);
      toast.success("Profile updated");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>
          Saves a new revision in the profile thread. Older revisions are kept
          for audit.
        </DialogDescription>
      </DialogHeader>
      <PatientFormFields values={values} onChange={setValues} />
      <DialogFooter>
        <Button
          type="submit"
          disabled={
                submitting ||
                !values.firstName.trim() ||
                !values.lastName.trim() ||
                !ready
              }
          title={notReadyMessage(notReadyReason) || undefined}
        >
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
