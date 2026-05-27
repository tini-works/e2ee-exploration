# matrix-client

## Why does this exist?

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
    B6(["MatrixProvider + useMatrix<br/>React binding over state scope"]):::cyan
    B7(["createPatient / updatePatient<br/>rooms-as-records"]):::cyan
    B8(["usePatientInvites"]):::cyan
    B9(["requestKeyFromPeers<br/>cross-device session forwarding for UTDs"]):::orange
    B10(["signIn / signOut / resetBackup / markKeyUnlocked<br/>imperative state actions on pumped-fn atoms"]):::orange
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
  B6 --> B10
  B10 --> B1
  B10 --> B2
  B9 --> A4
  B9 --> A1

  classDef orange fill:#ffffff,stroke:#f59e0b,stroke-width:2px,color:#000000
  classDef cyan fill:#ffffff,stroke:#06b6d4,stroke-width:2px,color:#000000
  classDef purple fill:#ffffff,stroke:#a855f7,stroke-width:2px,color:#000000
  linkStyle default stroke:#ec4899,stroke-width:2px
```

## Bootstrap: how much code disappears

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

## Recovery-key unlock: one call, six SDK calls

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
  Note over MC: caches key in module-local getSecretStorageKey callback
  MC->>SDK: bootstrapCrossSigning
  MC->>SDK: crossSignDevice deviceId
  Note over MC,SDK: bootstrap is a no-op if CS already exists so we sign this device explicitly
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

## React lifecycle (`MatrixProvider`)

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
  return (
    <ul>
      {patients.map((p) => (
        <li key={p.roomId}>{p.record.firstName}</li>
      ))}
    </ul>
  );
}
```
