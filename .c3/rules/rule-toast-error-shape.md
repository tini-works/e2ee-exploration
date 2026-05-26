---
id: rule-toast-error-shape
c3-seal: ef760aaf5814bad00d7c537ac3588edaf963fb9d462b9c15ae1f16070230c86f
title: toast-error-shape
type: rule
goal: Enforce a uniform shape for error toasts so the user sees a short headline and the underlying error as a secondary description, without leaking SDK stack traces into the headline.
---

## Goal

Enforce a uniform shape for error toasts so the user sees a short headline and the underlying error as a secondary description, without leaking SDK stack traces into the headline.

## Rule

Error feedback uses `toast.error(<short headline>, { description: String(err) })`. The headline is a complete sentence in app domain language; the description is the raw error stringified. Success toasts use `toast.success(<short past-tense sentence>)`.

## Golden Example

```ts
// web/src/components/patient-form.tsx
import { toast } from "sonner";
import { createPatient } from "matrix-client/patients";

try {
  await createPatient(client, record, { inviteUserIds });
  toast.success("Patient created");                              // REQUIRED: past-tense, app language
} catch (err) {
  toast.error("Could not create patient", {                      // REQUIRED: domain headline
    description: String(err),                                    // REQUIRED: raw error as description
  });
}
```

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| toast.error(String(err)) | toast.error("Could not save", { description: String(err) }) | Surfaces "Error: M_FORBIDDEN ..." as headline; user has no context |
| toast.error("Failed", { description: err.message }) | toast.error("Could not create patient", { description: String(err) }) | err.message swallows non-Error throws (strings, objects); String(err) is safe |
| toast.success("Done") | toast.success("Patient created") | Generic confirmations don't tell the user which action succeeded when toasts stack |

## Scope

All `web/src/components/` and `web/src/app/` files that perform mutations via `matrix-client/*`. Status-bar uses the same pattern for recovery-key errors.

## Override

For non-fatal warnings, use `toast.message(...)` with the same shape; for purely informational events with no error, just `toast.success`.
