---
id: rule-no-confirm
c3-seal: f6c9760ba9e888e9f4b5ee3f7888d36802260c1cdd7356f2e0978df1bde2431c
title: no-confirm
type: rule
goal: |-
    Keep destructive and intent-confirming UI consistent and themed by
    banning the unstyled, blocking `window.confirm`/`alert`/`prompt`
    dialogs that `AGENTS.md` explicitly forbids.
---

## Goal

Keep destructive and intent-confirming UI consistent and themed by
banning the unstyled, blocking `window.confirm`/`alert`/`prompt`
dialogs that `AGENTS.md` explicitly forbids.

## Rule

Never call `window.confirm`, `window.alert`, or `window.prompt`. Use
`sonner` toasts for transient feedback and shadcn `Dialog` for
destructive confirmation or multi-field intake.

## Golden Example

```tsx
// src/components/patient-table.tsx
const [pendingDelete, setPendingDelete] = useState<{ roomId: string; name: string } | null>(null);

<DropdownMenuItem
  onClick={() => setPendingDelete({ roomId: p.roomId, name: fullName(p.record) })}
  variant="destructive"
>
  Delete
</DropdownMenuItem>

<Dialog
  open={!!pendingDelete}                                       // REQUIRED
  onOpenChange={(o) => !o && setPendingDelete(null)}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete patient?</DialogTitle>               // REQUIRED
      <DialogDescription>...</DialogDescription>               // REQUIRED
    </DialogHeader>
    <Button variant="destructive" onClick={confirmDelete}>     // REQUIRED
      {deleting ? "Deleting…" : "Delete"}
    </Button>
  </DialogContent>
</Dialog>
```

REQUIRED: state-driven `open`, themed `Dialog`, destructive variant on
the destructive action. OPTIONAL: any number of supporting fields and
copy.

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| if (window.confirm("Delete?")) deletePatient(...) | State-driven <Dialog> with a variant="destructive" button. | Forbidden by AGENTS.md; blocks event loop; unthemed. |
| alert(err.message) | toast.error(err instanceof Error ? err.message : String(err)) | Toasts are non-blocking and already wired via <Toaster />. |
| prompt("Recovery key") | A <Dialog> with <PasswordInput> (see status bar). | Plain prompts can't be password-masked or themed. |

## Scope

All client components under `src/`. Server components don't render
modals in this project.

## Override

None. The rule exists to make `AGENTS.md` enforceable; deviating
requires updating `AGENTS.md` itself.
