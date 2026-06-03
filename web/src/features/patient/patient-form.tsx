"use client";

import { useState } from "react";
import {
  useForm,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { matrixReact } from "matrix-client/react";
import { matrixPatient } from "matrix-client/patient";
import { notReadyMessage } from "@/lib/not-ready-message";
import { toast } from "sonner";

const MATRIX_ID_RE = /^@[^:\s]+:[^:\s]+$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const recordSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  dob: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || EMAIL_RE.test(v), "Enter a valid email address"),
  notes: z.string().optional(),
});

const newPatientSchema = recordSchema.extend({
  invite: z
    .string()
    .trim()
    .regex(MATRIX_ID_RE, "Enter a valid Matrix user ID (e.g. @alice:example.org)"),
});

type RecordValues = z.infer<typeof recordSchema>;
type NewPatientValues = z.infer<typeof newPatientSchema>;

const EMPTY_RECORD: RecordValues = {
  firstName: "",
  lastName: "",
  dob: "",
  phone: "",
  email: "",
  notes: "",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function PatientFormFields({
  register,
  errors,
}: {
  register: UseFormRegister<FieldValues>;
  errors: FieldErrors<FieldValues>;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            aria-invalid={!!errors.firstName}
            {...register("firstName")}
          />
          <FieldError message={errors.firstName?.message as string | undefined} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            aria-invalid={!!errors.lastName}
            {...register("lastName")}
          />
          <FieldError message={errors.lastName?.message as string | undefined} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input id="dob" type="date" {...register("dob")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        <FieldError message={errors.email?.message as string | undefined} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...register("notes")}
        />
      </div>
    </>
  );
}

export function NewPatientDialog({ onCreated }: { onCreated?: () => void }) {
  const { client, ready, notReadyReason } = matrixReact.useMatrix();
  const [open, setOpen] = useState(false);

  const form = useForm<NewPatientValues>({
    resolver: zodResolver(newPatientSchema),
    defaultValues: { invite: "", ...EMPTY_RECORD },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = handleSubmit(async (data) => {
    if (!client || !ready) return;
    const { invite, ...record } = data;
    try {
      await matrixPatient.create(client, record, {
        inviteUserIds: [invite],
      });
      const display = `${record.firstName} ${record.lastName}`.trim();
      toast.success(`Patient room created for ${display}; invited ${invite}.`);
      reset({ invite: "", ...EMPTY_RECORD });
      setOpen(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset({ invite: "", ...EMPTY_RECORD });
      }}
    >
      <DialogTrigger
        render={
          <Button
            disabled={!ready}
            title={notReadyMessage(notReadyReason) || undefined}
          >
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
          <div className="space-y-2">
            <Label htmlFor="invite">Patient Matrix user</Label>
            <Input
              id="invite"
              placeholder="@alice:example.org"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!errors.invite}
              {...register("invite")}
            />
            <FieldError message={errors.invite?.message} />
            <p className="text-xs text-muted-foreground">
              The patient is invited to the room and can decrypt every message
              from creation onward.
            </p>
          </div>
          <PatientFormFields
            register={register as unknown as UseFormRegister<FieldValues>}
            errors={errors as FieldErrors<FieldValues>}
          />
          <DialogFooter>
            <Button
              type="submit"
              disabled={isSubmitting || !ready}
              title={notReadyMessage(notReadyReason) || undefined}
            >
              {isSubmitting ? "Creating…" : "Create patient"}
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
  initial: RecordValues;
  onUpdated?: () => void;
}) {
  const { ready, notReadyReason } = matrixReact.useMatrix();
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
  initial: RecordValues;
  onDone: () => void;
}) {
  const { client, ready, notReadyReason } = matrixReact.useMatrix();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecordValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: initial,
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!client || !ready) return;
    try {
      await matrixPatient.update(client, roomId, values);
      toast.success("Profile updated");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>
          Saves a new revision in the profile thread. Older revisions are kept
          for audit.
        </DialogDescription>
      </DialogHeader>
      <PatientFormFields
        register={register as unknown as UseFormRegister<FieldValues>}
        errors={errors as FieldErrors<FieldValues>}
      />
      <DialogFooter>
        <Button
          type="submit"
          disabled={isSubmitting || !ready}
          title={notReadyMessage(notReadyReason) || undefined}
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
