---
id: c3-2
c3-seal: 07073eb51d2536bf94dba675f8e40c098c81f7b5d8513677602db9ae488435e8
title: matrix-client
type: container
boundary: service
parent: c3-0
goal: 'Opinionated wrapper around `matrix-js-sdk` for E2EE-by-default apps that store domain records as Matrix rooms. Bakes in client bootstrap, Rust crypto init, secret-storage unlock, key-backup wiring, session persistence, and a small "rooms-as-records" pattern. Three entrypoints: `matrix-client`, `matrix-client/react`, `matrix-client/patients`.'
---

## Goal

Opinionated wrapper around `matrix-js-sdk` for E2EE-by-default apps that store domain records as Matrix rooms. Bakes in client bootstrap, Rust crypto init, secret-storage unlock, key-backup wiring, session persistence, and a small "rooms-as-records" pattern. Three entrypoints: `matrix-client`, `matrix-client/react`, `matrix-client/patients`.

## Components

| ID | Name | Category | Status | Goal Contribution |
| --- | --- | --- | --- | --- |
| c3-201 | client | foundation | active | createMatrixClient + loginWithPassword: one call from session to synced client. |
| c3-202 | types | foundation | active | StoredSession shape and default homeserver/identity URLs. |
| c3-203 | secret-storage | foundation | active | Recovery-key generation + unlock, SSSS + key-backup + cross-signing wiring. |
| c3-204 | wipe | foundation | active | Deletes browser-local Matrix data (IndexedDB + localStorage) on sign-out. |
| c3-205 | verification | foundation | active | Device verification state via crypto-api. |
| c3-206 | peer-key-share | foundation | active | Cross-device session forwarding for UTDs (unable-to-decrypt) events. |
| c3-207 | matrix-state | foundation | active | pumped-fn state graph + imperative lifecycle: atoms project SDK events, readinessAtom is the recovery-key gate, signIn/signOut/resetBackup/markKeyUnlocked. |
| c3-210 | patients-domain | feature | active | rooms-as-records CRUD: createPatient, updatePatient, listPatients, history, messages, invites. |
| c3-211 | matrix-provider | feature | active | Thin React binding over c3-207: MatrixProvider mounts the scope + useMatrix() reads atoms; owns no state. |
| c3-212 | patient-invites | feature | active | usePatientInvites hook surfacing pending patient-room invites. |

## Responsibilities

- Own every `matrix-js-sdk` call site; never expose `MatrixClient` or SDK types in ways that force callers to import the SDK.
- Bootstrap a client on `createMatrixClient(session)`: IndexedDB stores keyed by `(userId, deviceId)`, Rust crypto, sync wait, best-effort key-backup restore.
- Collapse Matrix's six-step secret-storage unlock into `unlockWithSecurityKey(client, key)`.
- Hold all reactive Matrix state in one process-global `@pumped-fn/lite` scope (c3-207): atoms project SDK events, the imperative lifecycle (signIn/signOut/resetBackup) drives the client, and `readinessAtom` is the single recovery-key gate.
- Expose that state to React via the thin `MatrixProvider` + `useMatrix()` binding (c3-211); gate `ready` on sync state + `keyUnlockedThisSession`.
- Encrypt every patient record in its own private Matrix room with megolm; prime keys for invited devices before first event.
- Wait for outbound key backup to drain (`KeyBackupSessionsRemaining=0`) before declaring writes durable.

## Complexity Assessment

- Sign-in must wait for `/sync` to reach `PREPARED` before secret-storage operations are safe — `createMatrixClient` enforces this with a 30s timeout.
- Backup uploads run async; `pendingBackup` exposed so sign-out doesn't strand un-uploaded keys.
- IndexedDB cleanup (`wipeLocalMatrixData`) can stall on the rust-crypto store; runs with timeouts + sequencing guard.
- Cross-signing bootstrap is a no-op if CS already exists, so `unlockWithSecurityKey` signs the current device explicitly to make it appear verified to peers.
- Peer-key-share handles UTDs by requesting megolm sessions from sibling devices via to-device events.
