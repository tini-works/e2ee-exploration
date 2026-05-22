---
id: rule-key-gate-disable
c3-seal: c476b7e59cd7fb131551ce04ea50903a537a42e2098db54778dd58fef208e249
title: key-gate-disable
type: rule
goal: |-
    Enforce the `AGENTS.md` recovery-key gate at every privileged UI
    surface so no feature can be activated before the user has proven
    they hold the recovery key in the current session.
---

## Goal

Enforce the `AGENTS.md` recovery-key gate at every privileged UI
surface so no feature can be activated before the user has proven
they hold the recovery key in the current session.

## Rule

Every button, dialog trigger, or form submission that mutates Matrix
state must read `ready` and `notReadyReason` from `useMatrix()` and
disable itself with `disabled={!ready} title={notReadyReason ??
undefined}` whenever `ready === false`.

## Golden Example

```tsx
// src/components/patient-form.tsx
const { ready, notReadyReason } = useMatrix();

<DialogTrigger
  render={
    <Button disabled={!ready} title={notReadyReason ?? undefined}> // REQUIRED
      New patient
    </Button>
  }
/>
```

```tsx
// src/components/patient-form.tsx (submit button)
<Button
  type="submit"
  disabled={
    submitting ||
    !values.firstName.trim() ||
    !values.lastName.trim() ||
    !ready                                // REQUIRED
  }
  title={notReadyReason ?? undefined}     // REQUIRED
>
  {submitting ? "Creating…" : "Create patient"}
</Button>
```

REQUIRED: `disabled` must include `!ready`; `title` must surface
`notReadyReason`. OPTIONAL: extra `disabled` clauses (validation,
submission state).

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| <Button onClick={create}>New patient</Button> (no gate) | Use the golden pattern with disabled={!ready}. | Bypasses the AGENTS.md recovery-key gate. |
| Checking only status === "ready" | Use ready from useMatrix() (covers sync + key unlock). | Sync-ready does not imply key-unlocked. |
| Hiding the action when not ready | Disable + tooltip with notReadyReason. | Users need to see why; surprise-hidden UI is worse than a labeled disabled state. |

## Scope

Applies to every component under `src/components/` that calls
`useMatrix()` and triggers a write (room create, message send,
patient delete, profile edit, invite accept, backup reset). Read-only
displays (status bar badges, history list) are exempt.

## Override

The status bar Recovery-key, Reset-backup, and Sign-out buttons are
the only writes allowed while `ready === false` — they are the
mechanism that unlocks `ready`. New overrides require an ADR
referencing this rule.
