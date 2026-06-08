"use client";

import { useEffect, useState } from "react";
import { scopedValue, useScopedValue } from "@pumped-fn/lite-react";
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

// Derive the matrix client type from the API rather than importing
// matrix-js-sdk directly (project rule: go through matrix-client).
type MatrixClient = Parameters<typeof matrixPatient.create>[0];

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
type FormErrors = Partial<Record<string, string>>;

const EMPTY_RECORD: RecordValues = {
  firstName: "",
  lastName: "",
  dob: "",
  phone: "",
  email: "",
  notes: "",
};

/** Collect the first zod issue per top-level field into a flat map. */
function collectErrors(error: z.ZodError): FormErrors {
  const out: FormErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * New-patient form state in a pumped scopedValue. The submit action validates
 * with zod, then drives matrixPatient.create(); the React layer hands it the
 * `client` since that lives in the matrix provider, not the scope.
 */
export const newPatientForm = scopedValue({
  name: "new-patient-form",
  initial: () => ({
    values: { invite: "", ...EMPTY_RECORD } as NewPatientValues,
    errors: {} as FormErrors,
    submitting: false,
  }),
  actions: ({ get, patch }) => ({
    setField(field: keyof NewPatientValues, value: string) {
      patch({ values: { ...get().values, [field]: value } });
    },
    reset() {
      patch({
        values: { invite: "", ...EMPTY_RECORD },
        errors: {},
        submitting: false,
      });
    },
    async submit(client: MatrixClient): Promise<boolean> {
      const parsed = newPatientSchema.safeParse(get().values);
      if (!parsed.success) {
        patch({ errors: collectErrors(parsed.error) });
        return false;
      }
      patch({ errors: {}, submitting: true });
      try {
        const { invite, ...record } = parsed.data;
        await matrixPatient.create(client, record, { inviteUserIds: [invite] });
        const display = `${record.firstName} ${record.lastName}`.trim();
        toast.success(`Patient room created for ${display}; invited ${invite}.`);
        patch({
          values: { invite: "", ...EMPTY_RECORD },
          errors: {},
          submitting: false,
        });
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
        patch({ submitting: false });
        return false;
      }
    },
  }),
});

/**
 * Edit-patient form state. `load()` seeds the fields from the patient's current
 * record when the dialog opens; submit validates and drives matrixPatient.update().
 */
export const editPatientForm = scopedValue({
  name: "edit-patient-form",
  initial: () => ({
    values: { ...EMPTY_RECORD } as RecordValues,
    errors: {} as FormErrors,
    submitting: false,
  }),
  actions: ({ get, patch }) => ({
    load(values: RecordValues) {
      patch({ values: { ...values }, errors: {}, submitting: false });
    },
    setField(field: keyof RecordValues, value: string) {
      patch({ values: { ...get().values, [field]: value } });
    },
    async submit(client: MatrixClient, roomId: string): Promise<boolean> {
      const parsed = recordSchema.safeParse(get().values);
      if (!parsed.success) {
        patch({ errors: collectErrors(parsed.error) });
        return false;
      }
      patch({ errors: {}, submitting: true });
      try {
        await matrixPatient.update(client, roomId, parsed.data);
        toast.success("Profile updated");
        patch({ submitting: false });
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
        patch({ submitting: false });
        return false;
      }
    },
  }),
});

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function PatientFormFields({
  values,
  errors,
  setField,
}: {
  values: RecordValues;
  errors: FormErrors;
  setField: (field: keyof RecordValues, value: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            aria-invalid={!!errors.firstName}
            value={values.firstName}
            onChange={(e) => setField("firstName", e.target.value)}
          />
          <FieldError message={errors.firstName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            aria-invalid={!!errors.lastName}
            value={values.lastName}
            onChange={(e) => setField("lastName", e.target.value)}
          />
          <FieldError message={errors.lastName} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input
            id="dob"
            type="date"
            value={values.dob ?? ""}
            onChange={(e) => setField("dob", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={values.phone ?? ""}
            onChange={(e) => setField("phone", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          aria-invalid={!!errors.email}
          value={values.email ?? ""}
          onChange={(e) => setField("email", e.target.value)}
        />
        <FieldError message={errors.email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={values.notes ?? ""}
          onChange={(e) => setField("notes", e.target.value)}
        />
      </div>
    </>
  );
}

export function NewPatientDialog({ onCreated }: { onCreated?: () => void }) {
  const { client, ready, notReadyReason } = matrixReact.useMatrix();
  const [open, setOpen] = useState(false);
  const form = useScopedValue(newPatientForm);
  const { values, errors, submitting } = form.snapshot;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !ready) return;
    const ok = await form.actions.submit(client);
    if (ok) {
      setOpen(false);
      onCreated?.();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) form.actions.reset();
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
              value={values.invite}
              onChange={(e) => form.actions.setField("invite", e.target.value)}
            />
            <FieldError message={errors.invite} />
            <p className="text-xs text-muted-foreground">
              The patient is invited to the room and can decrypt every message
              from creation onward.
            </p>
          </div>
          <PatientFormFields
            values={values}
            errors={errors}
            setField={form.actions.setField}
          />
          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || !ready}
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
  const form = useScopedValue(editPatientForm);
  const { values, errors, submitting } = form.snapshot;

  // Seed the shared form state with this patient's current record on open.
  useEffect(() => {
    form.actions.load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !ready) return;
    const ok = await form.actions.submit(client, roomId);
    if (ok) onDone();
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
      <PatientFormFields
        values={values}
        errors={errors}
        setField={form.actions.setField}
      />
      <DialogFooter>
        <Button
          type="submit"
          disabled={submitting || !ready}
          title={notReadyMessage(notReadyReason) || undefined}
        >
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
