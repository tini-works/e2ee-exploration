---
id: ref-key-gate
c3-seal: 9b42d96876425af62c9989cb1ae9e006c04e851c3fd19a192ef5039efa3adf7f
title: key-gate
type: ref
goal: 'Standardize when feature UI is reachable: only after the user has signed in AND proven they hold the recovery key in the current browser session. Prevents a half-bootstrapped session from rendering CRUD that would silently encrypt against a session the user can''t actually decrypt later.'
---

## Goal

Standardize when feature UI is reachable: only after the user has signed in AND proven they hold the recovery key in the current browser session. Prevents a half-bootstrapped session from rendering CRUD that would silently encrypt against a session the user can't actually decrypt later.

## Choice

The `MatrixProvider` exposes `{ ready, notReadyReason }`. `ready` is `true` only when (a) the SDK sync state is `PREPARED`/`SYNCING` AND (b) the user called `markKeyUnlocked()` after a successful `unlockWithSecurityKey`. Every feature trigger reads `ready` and disables itself while `false`. `notReadyReason` is a typed union (`needs_recovery_key`, `syncing`, `reconnecting`, `catchup`, `sync_error`, `not_signed_in`) so the UI knows *why* it can't render.

## Why

- An accepted recovery key proves the user can decrypt their own backup; without it, any patient record we create today is unreadable tomorrow from any other device.
- A typed `notReadyReason` keeps the message-mapping in the app (`web/src/lib/not-ready-message.ts`) instead of the package — copy decisions stay app-side.
- One gate at the provider level beats sprinkling `if (!key) return` checks across every mutation site.

## How

```tsx
// web/src/components/patient-table.tsx
const { ready } = useMatrix();

<Button disabled={!ready} onClick={onCreate}>New patient</Button>
```

Inside the provider:

```tsx
// packages/matrix-client/src/react/provider.tsx
const ready = syncState === "PREPARED" && keyUnlockedThisSession;
const notReadyReason = !client
  ? { kind: "not_signed_in" }
  : !keyUnlockedThisSession
    ? { kind: "needs_recovery_key" }
    : syncState === "RECONNECTING" ? { kind: "reconnecting" }
    : /* … */ null;
```

See [[rule-key-gate-disable]] for the enforceable form of this pattern.
