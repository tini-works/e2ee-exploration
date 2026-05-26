---
id: rule-no-confirm
c3-seal: 9569566db66fc5534cf37cfe690de6c1d4a70ef146d23bbd59397d9c0d3b84b0
title: no-confirm
type: rule
goal: Enforce that the app never uses native browser dialogs (`confirm`, `alert`, `prompt`) for user interaction. All destructive actions go through a custom modal; all transient feedback goes through toasts.
---

## Goal

Enforce that the app never uses native browser dialogs (`confirm`, `alert`, `prompt`) for user interaction. All destructive actions go through a custom modal; all transient feedback goes through toasts.

## Rule

The app never calls `window.confirm`, `window.alert`, or `window.prompt`. Destructive actions render a shadcn `<Dialog>` with explicit confirm/cancel buttons. Transient feedback uses `sonner` toasts.

## Golden Example

```tsx
// web/src/components/patient-table.tsx — destructive action with custom modal
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function DeletePatientDialog({ open, onOpenChange, patient, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>        {/* REQUIRED: shadcn Dialog, not confirm() */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {patient.record.firstName}?</DialogTitle>
        </DialogHeader>
        <p>This deletes the encrypted room and cannot be undone.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={async () => {  // REQUIRED: explicit button, not auto-fire
            await onConfirm();
            toast.success("Patient deleted");                 // REQUIRED: sonner for feedback
          }}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| if (confirm("Delete?")) await deletePatient(...) | Custom shadcn <Dialog> with confirm/cancel buttons | Blocks the event loop; freezes sync callbacks underneath; can't be styled |
| alert("Saved") | toast.success("Saved") | Modal, requires dismissal; we already mount <Toaster /> for this |
| prompt("Recovery key:") | Inline <Input> in the status-bar component | Native prompt has no validation, no masking, and breaks the visual flow |

## Scope

Applies to all code in `web/src/`. The `matrix-client` package never renders UI so the rule is implicit there. Test files (Playwright) may use `page.evaluate(() => confirm(...))` only inside `web.dialog.dismiss` handlers if testing legacy code paths — none exist today.

## Override

No override path. If a future flow genuinely needs a blocking confirm (e.g., for an external SSO redirect), add an ADR proposing an exception with the specific call site.
