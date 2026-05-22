---
id: c3-1
c3-seal: 6baa4427c099a2f297e5b834dd4361dd99318ca0a71518d87e50eb2d20cad749
title: web
type: container
boundary: service
parent: c3-0
goal: |-
    Browser-only Next.js app that lets clinics manage E2E-encrypted patient
    records on a Matrix homeserver and lets patients see which clinics
    hold records about them. All Matrix traffic, encryption, and storage
    runs in the browser; the homeserver is an external dependency.
---

## Goal

Browser-only Next.js app that lets clinics manage E2E-encrypted patient
records on a Matrix homeserver and lets patients see which clinics
hold records about them. All Matrix traffic, encryption, and storage
runs in the browser; the homeserver is an external dependency.

## Components

| ID | Name | Category | Status | Goal Contribution |
| --- | --- | --- | --- | --- |
| c3-101 | matrix-client | foundation | active | Boots and configures the matrix-js-sdk client + rust crypto. |
| c3-102 | matrix-provider | foundation | active | React context wrapping client lifecycle and the recovery-key gate. |
| c3-103 | secret-storage | foundation | active | Recovery-key, SSSS, and key-backup operations. |
| c3-104 | patients-domain | foundation | active | Patient CRUD + messaging on top of encrypted Matrix rooms. |
| c3-105 | local-wipe | foundation | active | Deletes browser-local Matrix data on sign-out. |
| c3-106 | clinic-config | foundation | active | Static clinic registry mapping Matrix user IDs to clinic names. |
| c3-107 | ui-kit | foundation | active | shadcn/Base UI primitives used by all features. |
| c3-110 | sign-in | feature | active | Single-form Matrix login. |
| c3-111 | status-bar | feature | active | Sync, encryption, backup, invites, and recovery-key UI in one bar. |
| c3-112 | app-shell | feature | active | Routes between sign-in, loading, error, and authenticated layouts. |
| c3-113 | clinic-guard | feature | active | Restricts /patients to clinic-registered Matrix users. |
| c3-114 | patient-list | feature | active | Clinic patient table with create/export/delete. |
| c3-115 | patient-detail | feature | active | Single-patient view: profile, history, encrypted timeline. |
| c3-116 | patient-account | feature | active | Patient-side view of clinics that hold records about you. |
| c3-117 | routes | feature | active | Next.js App-Router pages composing features. |
| c3-118 | pumped-fn-demo | feature | active | Isolated @pumped-fn/lite-react demo page. |
| c3-119 | patient-form | feature | active | New + Edit dialogs sharing one set of form fields. |

## Responsibilities

- Bootstrap and tear down one `MatrixClient` per signed-in session.
- Gate every privileged action behind a recovery-key unlock per
`AGENTS.md`.
- Encrypt every patient record in its own private Matrix room with a
Megolm session shared only with explicit invitees.
- Persist all state in `localStorage` and `IndexedDB`; nothing
server-side except the Matrix homeserver itself.
- Wipe all browser storage on sign-out so the next user starts clean.
- Restrict the clinic UI (`/patients`) to user IDs listed in the
`CLINICS` registry.

## Complexity Assessment

Most risk lives in the matrix-js-sdk + rust-crypto interaction:

- Sign-in must wait for `/sync` to reach `PREPARED` before secret
storage operations are safe.
- Backup uploads run async; sign-out must not strand un-uploaded keys.
- IndexedDB cleanup on sign-out can stall on the rust-crypto store and
is therefore run with timeouts + a sequencing guard before the next
sign-in.
- Decryption failures must surface to the user with a diagnostic, not
be silently dropped.
