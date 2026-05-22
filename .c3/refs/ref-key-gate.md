---
id: ref-key-gate
c3-seal: e59455be3896ecf7ce183b2e98a97e557772df307c69185755f4c51c6a23af31
title: key-gate
type: ref
goal: |-
    Express the `AGENTS.md` rule "Don't allow users to use functions if
    they have not entered correctly their recovery key" as one boolean
    that every feature reads, instead of every feature re-deriving it.
---

## Goal

Express the `AGENTS.md` rule "Don't allow users to use functions if
they have not entered correctly their recovery key" as one boolean
that every feature reads, instead of every feature re-deriving it.

## Choice

`MatrixProvider` computes a `ready: boolean` flag and a
`notReadyReason: string | null`. `ready` is `true` only when
`status === "ready"`, `syncState ∈ {PREPARED, SYNCING}`, AND
`keyUnlockedThisSession` is `true`. Every privileged action reads
those from `useMatrix()` and disables itself when `ready === false`,
showing `notReadyReason` via `title=`.

## Why

A single source of truth for "are we allowed to act" means we can't
ship a new feature that quietly skips the recovery-key check. Mixing
sync state + key-unlock into the same flag also collapses two
otherwise-separate gates (network not ready vs. key not entered) into
one disabled state with one explanatory string.

## How

```tsx
// src/lib/matrix/provider.tsx
const { ready, notReadyReason } = useMemo(() => {
  if (status !== "ready" || !client) return { ready: false, notReadyReason: "Not signed in." };
  if (syncState !== "PREPARED" && syncState !== "SYNCING") return { ... };
  if (!keyUnlockedThisSession) return {
    ready: false,
    notReadyReason: "Enter your recovery key in the status bar to unlock this session.",
  };
  return { ready: true, notReadyReason: null };
}, [status, client, syncState, keyUnlockedThisSession]);
```

Consumers:

```tsx
// src/components/patient-form.tsx (NewPatientDialog)
const { ready, notReadyReason } = useMatrix();
<Button disabled={!ready} title={notReadyReason ?? undefined}>New patient</Button>
```

`keyUnlockedThisSession` flips to `true` in three places only:
`unlockWithSecurityKey` (status bar Enter), `generateRecoveryKey`
(first-time setup), `resetBackup` (the user re-keyed and proved
ownership). Sign-out clears it.
