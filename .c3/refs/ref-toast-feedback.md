---
id: ref-toast-feedback
c3-seal: 13a3e3bbfc90b0c91d5a593789e1b934c36c07842a0e227cc5c29dbee27425ba
title: toast-feedback
type: ref
goal: Standardize transient user feedback (success, failure, info) so every feature uses the same notification primitive and there are no native browser dialogs blocking the UI thread.
---

## Goal

Standardize transient user feedback (success, failure, info) so every feature uses the same notification primitive and there are no native browser dialogs blocking the UI thread.

## Choice

`sonner` is the toast library. Mounted once via `<Toaster />` in the app root. Components import `toast` from `sonner` and call `toast.success(...)`, `toast.error(...)`, or `toast.message(...)`. No `alert()`, `confirm()`, or `prompt()` anywhere in the app.

## Why

- Toasts don't block the main thread; modal `confirm` does. With an async, encryption-heavy flow, a blocking dialog can freeze sync callbacks underneath it.
- One primitive everywhere makes error styling and dismissal behavior uniform.
- `sonner` integrates with the existing shadcn theme tokens (light/dark) without extra wiring.

## How

```ts
// web/src/components/patient-form.tsx
import { toast } from "sonner";

try {
  await createPatient(client, record, { inviteUserIds });
  toast.success("Patient created");
} catch (err) {
  toast.error("Could not create patient", { description: String(err) });
}
```

For destructive confirms, render a custom shadcn `<Dialog>` — see [[rule-no-confirm]].
