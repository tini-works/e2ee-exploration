## Why does this exist?

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

## Install & usage

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
