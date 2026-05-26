---
id: c3-1
c3-seal: eef37be042644734498d53e0a35fb76007abca5bf99976128da48b4583f92c78
title: web
type: container
boundary: service
parent: c3-0
goal: Browser-only Next.js app that lets clinics manage E2EE patient records on a Matrix homeserver and lets patients see which clinics hold records about them. UI, routing, clinic registry, and copy. Talks to Matrix only through the `matrix-client` workspace package.
---

## Goal

Browser-only Next.js app that lets clinics manage E2EE patient records on a Matrix homeserver and lets patients see which clinics hold records about them. UI, routing, clinic registry, and copy. Talks to Matrix only through the `matrix-client` workspace package.

## Components

| ID | Name | Category | Status | Goal Contribution |
| --- | --- | --- | --- | --- |
| c3-101 | ui-kit | foundation | active | shadcn/Base UI primitives used by all features. |
| c3-102 | clinic-config | foundation | active | Static clinic registry mapping Matrix user IDs to clinic names. |
| c3-103 | not-ready-message | foundation | active | Translates typed NotReadyReason from matrix-client/react into user-facing copy. |
| c3-104 | app-shell | foundation | active | Routes between sign-in, loading, error, and authenticated layouts. |
| c3-105 | clinic-guard | foundation | active | Restricts /patients to clinic-registered Matrix users. |
| c3-106 | full-page-loader | foundation | active | Centered spinner shown while session bootstraps. |
| c3-110 | sign-in | feature | active | Single-form Matrix login. |
| c3-111 | status-bar | feature | active | Sync, encryption, backup, invites, peer-key-share, and recovery-key UI in one bar. |
| c3-112 | patient-table | feature | active | Clinic patient table with create/export/delete. |
| c3-113 | patient-detail | feature | active | Single-patient view: profile, history, encrypted timeline. |
| c3-114 | patient-form | feature | active | New + Edit dialogs sharing one set of form fields. |
| c3-115 | patient-account | feature | active | Patient-side view of clinics that hold records about you. |
| c3-116 | routes | feature | active | Next.js App-Router pages composing features. |

## Responsibilities

- Compose the Next.js App Router shell (`web/src/app/`) and gate routes on the matrix-client provider's `ready` flag.
- Restrict the clinic UI (`/patients`) to user IDs listed in the `CLINICS` registry.
- Translate `NotReadyReason` from `matrix-client/react` into status-bar copy; copy lives in the app, not the package.
- Render all patient mutation UX (forms, dialogs, tables, history) and call into `matrix-client/patients` for state changes.
- Never import `matrix-js-sdk` directly — go through the `matrix-client` workspace package.
- Show transient feedback via `sonner` toasts; never use native `confirm`.

## Complexity Assessment

The web app itself is thin — most risk lives across the package boundary in `c3-2-matrix-client`. The non-trivial bits here:

- `status-bar` (714 LOC) is a state-machine hub spanning sync state, recovery-key prompt, key-backup progress, peer-key-share, and invites — it touches almost every provider hook.
- `patient-detail` (445 LOC) drives the encrypted timeline, including decryption failures surfaced as inline diagnostics.
- The recovery-key gate must disable every feature trigger until the user proves they hold the key — `clinic-guard` is one piece, but each feature also reads `ready`.
