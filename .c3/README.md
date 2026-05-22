---
id: c3-0
c3-seal: 4e81c4071ee307cfcb849b31e3309cb081b83ae81078b4f9944c488ccdd694bb
title: matrix
goal: 'E2E-encrypted patient records on Matrix: each patient is a private encrypted room; clinics manage records, patients see who holds them; all crypto runs in the browser.'
---

## Context

| Arg | Value |
| --- | --- |
| PROJECT | matrix (Matrix Patient Records) |
| GOAL | Store and share patient records over Matrix with end-to-end encryption and a fully-automatic key UX. |
| SUMMARY | A browser-only Next.js app where each patient is a private encrypted Matrix room; clinics own a registry of patient rooms, patients see which clinics hold records about them. |

## Abstract Constraints

- All patient data is end-to-end encrypted; the homeserver never sees
plaintext (Megolm + rust crypto via matrix-js-sdk).
- No feature is usable until the user has entered the correct recovery
key in the current session (`AGENTS.md` rule).
- The recovery key is the only manual secret. No import/export,
upload-backup, retry, or pull-backup buttons.
- Every patient record is one Matrix room; access control is room
membership.
- All storage is browser-local (`localStorage` + `IndexedDB`); sign-out
wipes it.
- No `window.confirm`/`alert`/`prompt`. Toasts via `sonner`, modals via
shadcn `Dialog`.

## Containers

- c3-1 web — the Next.js client app (everything in `src/`).

External, not modelled as C3 containers:

- Synapse homeserver (dev-time in `docker/compose.yml`, prod is any
Matrix homeserver).
- PostgreSQL (Synapse storage).

## Architecture Overview

```mermaid
flowchart LR
    UI["React UI<br/>(c3-110..c3-119)"] --> Provider["MatrixProvider<br/>(c3-102)"]
    Provider --> Client["matrix-client<br/>(c3-101)"]
    Provider --> SS["secret-storage<br/>(c3-103)"]
    Provider --> Patients["patients-domain<br/>(c3-104)"]
    Provider --> Wipe["local-wipe<br/>(c3-105)"]
    Client --> SDK["matrix-js-sdk<br/>+ rust crypto"]
    SS --> SDK
    Patients --> SDK
    SDK <--> IDB[("IndexedDB")]
    SDK <--> Synapse[("Synapse homeserver")]
```
