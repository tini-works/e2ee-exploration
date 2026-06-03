## Overview

How `web`, `matrix-client`, and `matrix-js-sdk` collaborate across the three core flows.

### 1. Authentication & Recovery Key

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant W as web
  participant MC as matrix-client
  participant SDK as matrix-js-sdk

  rect rgb(240, 255, 240)
  U->>W: Sign in (username / password)
  W->>MC: matrixReact.signIn()
  MC->>SDK: createClient() + loginRequest()
  MC->>SDK: initRustCrypto() + startClient()
  MC-->>W: status = ready

  U->>W: Open "Recovery key"
  W->>MC: matrixCrypto.hasSecretStorage()
  alt SSSS exists
    U->>W: Enter recovery key
    W->>MC: matrixCrypto.unlockWithSecurityKey()
    MC->>SDK: bootstrapCrossSigning()
    MC->>SDK: loadSessionBackupPrivateKeyFromSecretStorage()
    MC->>SDK: restoreKeyBackup()
  else SSSS missing
    U->>W: Enter password
    W->>MC: matrixCrypto.generateRecoveryKey()
    MC->>SDK: createRecoveryKeyFromPassphrase()
    MC->>SDK: bootstrapCrossSigning() + bootstrapSecretStorage()
    MC-->>W: { recoveryKey }
  end
  W->>MC: matrixReact.markKeyUnlocked()
  end
```

### 2. Patient Management

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant W as web
  participant MC as matrix-client
  participant SDK as matrix-js-sdk

  rect rgb(248, 240, 255)
  U->>W: New patient
  W->>MC: matrixPatient.create(values, {inviteUserIds})
  MC->>SDK: createRoom()
  MC->>SDK: getUserDeviceInfo()
  MC->>SDK: sendStateEvent() + sendEvent()

  U->>W: Open patient detail
  W->>MC: matrixPatient.get(roomId)
  W->>MC: matrixMessage.list(roomId)
  MC->>SDK: getRoom() + getLiveTimeline().getEvents()

  U->>W: Send message
  W->>MC: matrixMessage.send(roomId, body)
  MC->>SDK: sendEvent(roomId, "m.room.message", …)
  end
```

### 3. Handling Undecryptable Messages

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant W as web
  participant MC as matrix-client
  participant SDK as matrix-js-sdk

  U->>W: Open room timeline
  rect rgb(255, 235, 235)
  SDK-->>W: Undecryptable event in timeline
  W->>MC: matrixCrypto.requestKeyFromPeers({fromUserId, roomId, sessionId, senderKey})
  MC->>SDK: getUserDeviceInfo()
  MC->>SDK: encryptAndSendToDevice() — request room key
  Note over MC,SDK: Peer responds with key material
  W->>MC: matrixCrypto.usePeerKeyShareState(sessionId)
  MC->>SDK: importRoomKeysAsJson()
  MC->>SDK: room.decryptAllEvents()
  SDK-->>W: Decrypted messages rendered
  end
  W-->>U: Messages displayed
```
