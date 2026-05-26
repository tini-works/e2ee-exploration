# matrix-client

An opinionated wrapper around [`matrix-js-sdk`](https://github.com/matrix-org/matrix-js-sdk) for building **E2EE-by-default** apps that store domain records as Matrix rooms.

This package is **not** a fork or replacement for `matrix-js-sdk`. It sits on top of it and bakes in the boilerplate you'd otherwise rewrite in every app: client bootstrap, Rust crypto init, secret-storage unlock, key-backup wiring, session persistence, and a small "rooms-as-records" pattern (here: patients).

```
┌──────────────────────────────┐
│      your Next.js app        │
└──────────────┬───────────────┘
               │  useMatrix(), createPatient(), …
┌──────────────▼───────────────┐
│   matrix-client (this pkg)   │   ← opinionated, ~1.2k LOC
└──────────────┬───────────────┘
               │  createClient, crypto API, secret storage
┌──────────────▼───────────────┐
│        matrix-js-sdk         │   ← protocol-level primitives
└──────────────────────────────┘
```

## Why does this exist?

Bare `matrix-js-sdk` gives you primitives. Shipping an E2EE product with it means making the same dozen decisions in every app — which crypto stack, where to store sessions, how to surface sync state, when to call `restoreKeyBackup`, etc. This package makes those decisions once.

### What this package adds on top of `matrix-js-sdk`

```mermaid
%%{init: {'theme':'base','themeVariables':{'background':'#ffffff','primaryColor':'#ffffff','primaryTextColor':'#000000','primaryBorderColor':'#000000','lineColor':'#ec4899','clusterBkg':'#ffffff','clusterBorder':'#000000','fontFamily':'system-ui'}}}%%
flowchart LR
  subgraph PKG["matrix-client"]
    direction TB
    B1(["createMatrixClient<br/>one call to ready client"]):::orange
    B2(["loginWithPassword"]):::orange
    B3(["unlockWithSecurityKey<br/>recovery key to all keys loaded"]):::orange
    B4(["generateRecoveryKey"]):::orange
    B5(["wipeLocalMatrixData<br/>nuke all browser state"]):::orange
    B6(["MatrixProvider + useMatrix<br/>React lifecycle + sync state"]):::cyan
    B7(["createPatient / updatePatient<br/>rooms-as-records"]):::cyan
    B8(["usePatientInvites"]):::cyan
    B9(["requestKeyFromPeers<br/>cross-device session forwarding for UTDs"]):::orange
  end

  subgraph SDK["matrix-js-sdk"]
    direction TB
    A1(["createClient"]):::purple
    A2(["IndexedDBStore<br/>IndexedDBCryptoStore"]):::purple
    A3(["initRustCrypto"]):::purple
    A4(["secretStorage / crypto-api"]):::purple
    A5(["KeyBackup"]):::purple
  end

  B1 --> A1
  B1 --> A2
  B1 --> A3
  B1 --> A5
  B2 --> A1
  B3 --> A4
  B3 --> A5
  B4 --> A4
  B7 --> A1
  B6 --> B1
  B9 --> A4
  B9 --> A1

  classDef orange fill:#ffffff,stroke:#f59e0b,stroke-width:2px,color:#000000
  classDef cyan fill:#ffffff,stroke:#06b6d4,stroke-width:2px,color:#000000
  classDef purple fill:#ffffff,stroke:#a855f7,stroke-width:2px,color:#000000
  linkStyle default stroke:#ec4899,stroke-width:2px
```

## Bootstrap: how much code disappears

The `createMatrixClient(session)` call replaces ~50 lines of setup. Here's the sequence:

```mermaid
%%{init: {'theme':'base','themeVariables':{'background':'#ffffff','primaryTextColor':'#000000','actorBkg':'#ffffff','actorBorder':'#f59e0b','actorTextColor':'#000000','actorLineColor':'#000000','signalColor':'#ec4899','signalTextColor':'#000000','sequenceNumberColor':'#ffffff','noteBkgColor':'#ffffff','noteBorderColor':'#a855f7','noteTextColor':'#000000','labelBoxBkgColor':'#ffffff','labelBoxBorderColor':'#000000','labelTextColor':'#000000','fontFamily':'system-ui'}}}%%
sequenceDiagram
  autonumber
  participant App
  participant MC as matrix-client
  participant SDK as matrix-js-sdk
  participant IDB as IndexedDB
  participant HS as Homeserver

  App->>MC: createMatrixClient(session)
  MC->>IDB: new IndexedDBStore + startup
  MC->>IDB: new IndexedDBCryptoStore
  MC->>SDK: createClient store + cryptoStore
  MC->>SDK: initRustCrypto
  MC->>SDK: startClient initialSyncLimit 20
  MC->>HS: GET /sync
  HS-->>MC: PREPARED
  MC->>MC: startPeerKeyShare<br/>attach to-device listener
  MC->>SDK: crypto.checkKeyBackupAndEnable
  MC->>SDK: crypto.restoreKeyBackup
  Note over MC: silent if no cached backup key yet
  MC-->>App: ready MatrixClient
```

In raw `matrix-js-sdk` you'd write each of those steps yourself, including the "wait until the first sync reaches `PREPARED`" dance and the silent restore-on-best-effort.

## Recovery-key unlock: one call, six SDK calls

Matrix's secret-storage flow is famously many-step. `unlockWithSecurityKey(client, recoveryKey)` collapses it:

```mermaid
%%{init: {'theme':'base','themeVariables':{'background':'#ffffff','primaryTextColor':'#000000','actorBkg':'#ffffff','actorBorder':'#f59e0b','actorTextColor':'#000000','actorLineColor':'#000000','signalColor':'#ec4899','signalTextColor':'#000000','sequenceNumberColor':'#ffffff','noteBkgColor':'#ffffff','noteBorderColor':'#a855f7','noteTextColor':'#000000','labelBoxBkgColor':'#ffffff','labelBoxBorderColor':'#000000','labelTextColor':'#000000','fontFamily':'system-ui'}}}%%
sequenceDiagram
  autonumber
  participant UI
  participant MC as matrix-client
  participant SDK as matrix-js-sdk crypto
  participant SS as Secret Storage
  participant KB as Key Backup

  UI->>MC: unlockWithSecurityKey key
  MC->>SDK: decodeRecoveryKey
  MC->>SS: getDefaultKeyId + checkKey
  Note over MC: caches key in module-local<br/>getSecretStorageKey callback
  MC->>SDK: bootstrapCrossSigning
  MC->>SDK: crossSignDevice deviceId
  Note over MC,SDK: bootstrap is a no-op if CS already exists<br/>so we sign this device explicitly
  MC->>KB: checkKeyBackupAndEnable
  MC->>SDK: loadSessionBackupPrivateKeyFromSecretStorage
  MC->>KB: restoreKeyBackup
  MC->>SDK: room.decryptAllEvents for every room
  MC-->>UI: crossSigningReady, secretStorageReady, keyBackupRestored
```

Without this wrapper, forgetting just the `loadSessionBackupPrivateKeyFromSecretStorage()` step leaves the device with an active backup it cannot read — every old event surfaces as `HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED`.

## Rooms-as-records pattern (patients)

Each patient is a **dedicated encrypted Matrix room**. The latest profile is the most recent custom event in the timeline; older revisions live as thread replies.

```mermaid
%%{init: {'theme':'base','themeVariables':{'background':'#ffffff','primaryTextColor':'#000000','primaryBorderColor':'#000000','lineColor':'#ec4899','clusterBkg':'#ffffff','clusterBorder':'#000000','fontFamily':'system-ui'}}}%%
flowchart TB
  subgraph Room["Encrypted Matrix Room"]
    direction TB
    Tag(["tag<br/>com.matrix-app.patient"]):::orange
    Enc(["m.room.encryption<br/>megolm"]):::purple
    Pthread(["state: profile-thread<br/>rootEventId"]):::cyan
    Root(["event: patient.record root<br/>updatedTimes 0"]):::green
    Rev1(["event: patient.record thread reply<br/>updatedTimes 1"]):::green
    Rev2(["event: patient.record thread reply<br/>updatedTimes 2 - current"]):::green
    Msg1(["event: m.room.message<br/>chat with shared clinicians"]):::cyan
  end

  Pthread -.->|points to| Root
  Root -.->|m.thread| Rev1
  Rev1 -.->|m.thread| Rev2

  classDef orange fill:#ffffff,stroke:#f59e0b,stroke-width:2px,color:#000000
  classDef cyan fill:#ffffff,stroke:#06b6d4,stroke-width:2px,color:#000000
  classDef purple fill:#ffffff,stroke:#a855f7,stroke-width:2px,color:#000000
  classDef green fill:#ffffff,stroke:#10b981,stroke-width:2px,color:#000000
  linkStyle default stroke:#ec4899,stroke-width:2px
```

| Concern              | Where it lives                                                 |
| -------------------- | -------------------------------------------------------------- |
| Patient identity     | `roomId`                                                       |
| Current profile      | Latest `com.matrix-app.patient.record` event in the timeline   |
| History              | Thread of `patient.record` events, oldest = root               |
| Sharing              | Standard Matrix room invites — server never sees patient data  |
| Chat about a patient | Standard `m.room.message` events in the same room              |

API: `createPatient`, `updatePatient`, `listPatients`, `getPatient`, `listPatientHistory`, `deletePatient`, `listMessages`, `sendMessage`, plus invite helpers.

## React lifecycle (`MatrixProvider`)

The provider wraps the client in a state machine that gates feature access on **sync ready + recovery key entered**.

```mermaid
%%{init: {'theme':'base','themeVariables':{'background':'#ffffff','primaryColor':'#ffffff','primaryTextColor':'#000000','primaryBorderColor':'#f59e0b','lineColor':'#ec4899','transitionColor':'#ec4899','transitionLabelColor':'#000000','labelTextColor':'#000000','altBackground':'#ffffff','fontFamily':'system-ui'}}}%%
stateDiagram-v2
  [*] --> initializing
  initializing --> idle: no stored session
  initializing --> connecting: stored session found
  idle --> connecting: signIn
  connecting --> error: bootstrap failed
  connecting --> ready: client started + first sync
  ready --> ready: SYNCING / PREPARED
  ready --> not_ready: RECONNECTING / CATCHUP / sync error
  not_ready --> ready: sync recovers

  state ready {
    [*] --> needs_recovery_key
    needs_recovery_key --> unlocked: unlockWithSecurityKey or cached backup key
  }

  ready --> idle: signOut + wipeLocalMatrixData
```

`useMatrix()` exposes `{ client, ready, notReadyReason, signIn, signOut, resetBackup, … }`. Consumers gate UI on `ready`; `notReadyReason` tells them *why* it isn't ready so they can render the right banner (sync spinner vs. recovery-key prompt).

## Quick comparison

| Task                                  | `matrix-js-sdk` alone                                       | `matrix-client`                             |
| ------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| Sign in + start client                | ~50 lines (stores, crypto, sync wait, backup enable)        | `await createMatrixClient(session)`         |
| Persist session in browser            | DIY                                                         | Built into `MatrixProvider`                 |
| Enter recovery key & restore history  | 6 SDK calls in the right order                              | `await unlockWithSecurityKey(client, key)`  |
| First-time recovery-key setup         | `bootstrapCrossSigning` + `bootstrapSecretStorage` + cache  | `await generateRecoveryKey(client)`         |
| Surface sync state to UI              | Listen to `ClientEvent.Sync`, debounce, etc.                | `useMatrix().syncState` / `ready`           |
| Sign out + scrub all local crypto     | `logout` + `clearStores` + sweep IndexedDB + localStorage   | `signOut()` (runs `wipeLocalMatrixData`)    |
| Wait for outbound key backup to drain | Listen to `CryptoEvent.KeyBackupSessionsRemaining`          | `pendingBackup` exposed; auto-awaited on writes |
| Store a versioned domain record       | DIY event types + thread plumbing                           | `createPatient` / `updatePatient`           |

## Install & usage

This package is currently consumed inside this monorepo only — see `web/` for live usage.

```tsx
import { MatrixProvider, useMatrix } from "matrix-client/react";
import { listPatients, createPatient } from "matrix-client/patients";

function App({ children }) {
  return <MatrixProvider>{children}</MatrixProvider>;
}

function PatientList() {
  const { client, ready } = useMatrix();
  if (!ready || !client) return null;
  const patients = listPatients(client);
  return <ul>{patients.map(p => <li key={p.roomId}>{p.record.firstName}</li>)}</ul>;
}
```

## Module layout

| File                  | Exports                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `src/client.ts`       | `createMatrixClient`, `loginWithPassword`                                |
| `src/secret-storage.ts` | `generateRecoveryKey`, `unlockWithSecurityKey`, `getStatus`, cache helpers |
| `src/wipe.ts`         | `wipeLocalMatrixData`                                                    |
| `src/patients.ts`     | `createPatient`, `updatePatient`, `listPatients`, `listPatientHistory`, invite + message helpers |
| `src/react/provider.tsx` | `MatrixProvider`, `useMatrix`                                         |
| `src/react/invites.ts`   | `usePatientInvites`                                                    |
| `src/peer-key-share.ts`  | `startPeerKeyShare`, `requestKeyFromPeers`, peer-share state store      |
| `src/react/peer-key-share.ts` | `usePeerKeyShareState`                                            |
| `src/verification.ts`    | `getDeviceVerification`                                                |
| `src/types.ts`        | `StoredSession`, default URLs                                            |
