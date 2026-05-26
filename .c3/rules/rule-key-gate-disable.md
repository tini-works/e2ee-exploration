---
id: rule-key-gate-disable
c3-seal: 854e97cb7c5b3f6561a29ed7921adc1743139cb89fa055b20aad94b5115918df
title: key-gate-disable
type: rule
goal: Enforce that no feature-level mutation or navigation trigger is reachable until `useMatrix().ready` is `true`. The recovery-key gate is the load-bearing safety check; bypassing it produces encrypted-but-unreadable data.
---

## Goal

Enforce that no feature-level mutation or navigation trigger is reachable until `useMatrix().ready` is `true`. The recovery-key gate is the load-bearing safety check; bypassing it produces encrypted-but-unreadable data.

## Rule

Every feature trigger (button, form submit, link to a feature route) that depends on Matrix state reads `const { ready } = useMatrix()` and sets `disabled={!ready}` (or returns early). Mutation handlers may also assert `if (!ready || !client) return` as a defensive guard.

## Golden Example

```tsx
// web/src/components/patient-table.tsx
"use client";
import { useMatrix } from "matrix-client/react";
import { Button } from "@/components/ui/button";

export function PatientTable() {
  const { client, ready } = useMatrix();   // REQUIRED: pull ready

  async function onCreate() {
    if (!ready || !client) return;          // REQUIRED: defensive guard in async handlers
    // ...createPatient(client, ...)
  }

  return (
    <Button disabled={!ready} onClick={onCreate}>   {/* REQUIRED: disabled when !ready */}
      New patient
    </Button>
  );
}
```

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| <Button onClick={onCreate}>New patient</Button> (no disabled) | <Button disabled={!ready} onClick={onCreate}> | User can fire a mutation while the provider is still bootstrapping; record gets encrypted against a session that hasn't proven recovery |
| useEffect(() => fetchSomething(), []) without ready in deps | useEffect(() => { if (ready) fetchSomething() }, [ready]) | Effect runs before sync is PREPARED; SDK throws or returns empty |
| Custom if (key) check in each handler | Always read ready from useMatrix() | Different components diverge on what "ready" means; gate becomes inconsistent |

## Scope

Every file under `web/src/components/` and `web/src/app/` that imports from `matrix-client/*`. The `status-bar` itself is the exception — it renders the recovery-key entry UI, so it must be reachable when `ready` is false.

## Override

The status-bar's recovery-key input is the only allowed exception. Document any new exception with an ADR; do not silently bypass.
