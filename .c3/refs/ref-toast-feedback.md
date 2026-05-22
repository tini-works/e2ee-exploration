---
id: ref-toast-feedback
c3-seal: e39bea007adee1fa825bde5593b693769fcc8c4f007432d31b272f3ba75fa43b
title: toast-feedback
type: ref
goal: |-
    Standardize how user-facing feedback (success and error) is delivered
    so every async action looks and behaves the same.
---

## Goal

Standardize how user-facing feedback (success and error) is delivered
so every async action looks and behaves the same.

## Choice

`sonner` toasts for all transient feedback (`toast.success` /
`toast.error`); shadcn `Dialog` for destructive confirmation or
multi-field intake. Never `window.confirm`, `window.alert`, or
`window.prompt`.

## Why

`AGENTS.md` explicitly forbids `confirm` dialogs because they are
unstyled, block the event loop, and ignore React state. `sonner` is
already mounted once in `src/app/layout.tsx`; reusing it keeps every
toast in the same visual lane. Destructive intent (delete patient,
sign out, reset backup) needs explicit acknowledgement, so those go
through a `Dialog` with a separate `variant="destructive"` button.

## How

Errors uniformly normalise `unknown -> message`:

```tsx
// src/components/patient-form.tsx (NewPatientDialog onSubmit)
try {
  await createPatient(client, values, { inviteUserIds: ... });
  toast.success(`Patient room created for ${display}`);
} catch (err) {
  toast.error(err instanceof Error ? err.message : String(err));
}
```

Destructive intent uses a Dialog instead of confirm():

```tsx
// src/components/patient-table.tsx
<Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete patient?</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>
    <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
  </DialogContent>
</Dialog>
```

`<Toaster />` is mounted exactly once, at the root layout.
