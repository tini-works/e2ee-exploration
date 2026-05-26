# Matrix Patient Records

End-to-end encrypted patient records built on top of Matrix. Each patient is a
private encrypted room; profile data lives in an `m.thread`, messages live in
the room timeline.

## Architecture

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'background':'#ffffff','primaryTextColor':'#1f2937','lineColor':'#9ca3af','clusterBkg':'#ffffff','clusterBorder':'#ffffff'}}}%%

flowchart LR
    subgraph App["E2EE with matrix.org"]
        direction LR

        subgraph ClinicPOV["Practice software"]
            direction TB
            Clinic(["Clinic"]):::actor
        end

        subgraph PatientPOV["Patient app"]
            direction TB
            Patient(["Patient<br/>own account"]):::actor
        end

        subgraph BrowserZone["Browser session"]
            direction TB

            subgraph Gate["MatrixProvider"]
                direction TB
                SignIn["Sign-in<br/>username + password"]:::command
                RecoveryKey["Enter recovery key"]:::command
                Ready["Session ready"]:::event
                SignIn --> RecoveryKey
                RecoveryKey --> Ready
            end

            subgraph Sdk["matrix-js-sdk"]
                direction TB
                Crypto["End-to-end encryption"]:::policy
            end

            subgraph ClinicFeatures["Clinic features"]
                direction TB
                PatientCRUD["Patient CRUD<br/>Create/Update encrypted rooms"]:::command
                ClinicMsg["Message patient"]:::command
                SendInvite["Invite patient to room"]:::command
            end

            subgraph PatientFeatures["Patient features"]
                direction TB
                ViewHolders["Get connected clinics"]:::command
                ReadMsg["Read clinic messages"]:::command
                RespondInvite["Accept/Decline invites"]:::command
            end
        end

        subgraph SynapseZone["Synapse homeserver"]
            direction TB
            Rooms["Encrypted rooms<br/>profile thread + timeline"]:::external_system
            Account["Account data<br/>SSSS + key backup"]:::external_system
        end
    end

    Clinic --> SignIn
    Patient --> SignIn
    Ready --> PatientCRUD
    Ready --> ClinicMsg
    Ready --> SendInvite
    Ready --> ViewHolders
    Ready --> ReadMsg
    Ready --> RespondInvite
    PatientCRUD --> Crypto
    ClinicMsg --> Crypto
    SendInvite --> Crypto
    ViewHolders --> Crypto
    ReadMsg --> Crypto
    RespondInvite --> Crypto
    Crypto <--> Rooms
    Crypto <--> Account

    classDef actor fill:#ffffff,stroke:#166534,stroke-width:2px,color:#1f2937
    classDef command fill:#ffffff,stroke:#a7c5fc,stroke-width:2px,color:#1f2937
    classDef event fill:#ffffff,stroke:#feae57,stroke-width:2px,color:#1f2937
    classDef policy fill:#ffffff,stroke:#7c3aed,stroke-width:2px,color:#1f2937
    classDef reaction_policy fill:#ffffff,stroke:#da99e6,stroke-width:2px,color:#1f2937
    classDef read_model fill:#ffffff,stroke:#b0deb3,stroke-width:2px,color:#1f2937
    classDef ui fill:#ffffff,stroke:#f5f6f8,stroke-width:2px,color:#1f2937
    classDef external_system fill:#ffffff,stroke:#ffb3c5,stroke-width:2px,color:#1f2937

    style ClinicPOV fill:#ffffff,stroke:#ffffff,stroke-width:0px,color:#6b21a8
    style PatientPOV fill:#ffffff,stroke:#ffffff,stroke-width:0px,color:#6b21a8
    style App fill:#ffffff,stroke:#22d3ee,stroke-width:2px,color:#155e75
    style BrowserZone fill:#ffffff,stroke:#22d3ee,stroke-width:2px,color:#155e75
    style SynapseZone fill:#ffffff,stroke:#22d3ee,stroke-width:2px,color:#155e75
    style Gate fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000
    style Sdk fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000
    style ClinicFeatures fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000
    style PatientFeatures fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000
```

See `docs/v1.md` for per-flow sequence diagrams.

## Package interactions

The repo is a npm workspace with two packages:

- **`web/`** — Next.js app. Owns UI, routing, app-domain config (clinics), and copy. Talks to Matrix only through `matrix-client`.
- **`packages/matrix-client/`** — Matrix wrapper. Three entrypoints:
  - `matrix-client` — core (`createMatrixClient`, `loginWithPassword`, `unlockWithSecurityKey`, `wipeLocalMatrixData`, …)
  - `matrix-client/react` — `MatrixProvider`, `useMatrix`, `usePatientInvites`
  - `matrix-client/patients` — domain helpers (`createPatient`, `listPatients`, `subscribeRooms`, …)

The package depends on `matrix-js-sdk`; the web app never imports `matrix-js-sdk` directly.

### Sign in and session bootstrap

```mermaid
sequenceDiagram
    autonumber
    participant UI as web/sign-in.tsx
    participant Hook as matrix-client/react<br/>MatrixProvider
    participant Core as matrix-client<br/>client.ts
    participant SDK as matrix-js-sdk
    participant HS as Synapse

    UI->>Hook: signIn({baseUrl, user, pass})
    Hook->>Core: loginWithPassword(input)
    Core->>SDK: createClient + loginRequest
    SDK->>HS: POST /login
    HS-->>SDK: access_token, device_id
    SDK-->>Core: login response
    Core-->>Hook: StoredSession
    Hook->>Hook: localStorage[sessionStorageKey] = session
    Hook->>Core: createMatrixClient(session)
    Core->>SDK: startClient + initRustCrypto
    SDK->>HS: GET /sync
    HS-->>SDK: sync state (PREPARED)
    SDK-->>Core: MatrixClient
    Core-->>Hook: client
    Hook-->>UI: ready=false<br/>notReadyReason={kind:"needs_recovery_key"}
```

The provider blocks `ready` on `keyUnlockedThisSession` until the user proves they hold the recovery key — see next diagram.

### Unlock recovery key (the access gate)

```mermaid
sequenceDiagram
    autonumber
    participant UI as web/status-bar.tsx
    participant Core as matrix-client<br/>secret-storage.ts
    participant Hook as matrix-client/react<br/>MatrixProvider
    participant SDK as matrix-js-sdk crypto-api
    participant HS as Synapse

    UI->>Core: unlockWithSecurityKey(client, key)
    Core->>SDK: decodeRecoveryKey + checkKey
    SDK-->>Core: valid
    Core->>SDK: bootstrapCrossSigning
    Core->>SDK: crossSignDevice(deviceId)
    Note over Core,SDK: bootstrap is a no-op when CS already<br/>exists; sign this device explicitly so it<br/>appears verified to itself and to peers
    Core->>SDK: checkKeyBackupAndEnable
    SDK->>HS: GET /room_keys/version
    HS-->>SDK: backup version
    Core->>SDK: loadSessionBackupPrivateKeyFromSecretStorage
    Core->>SDK: restoreKeyBackup
    SDK->>HS: GET /room_keys/keys
    HS-->>SDK: encrypted session keys
    SDK-->>Core: {imported, total}
    Core-->>UI: UnlockOutcome
    UI->>Hook: markKeyUnlocked()
    Hook-->>UI: ready=true, notReadyReason=null
```

`notReadyReason` is a typed union from `matrix-client/react`. The web app's `notReadyMessage()` helper converts it to user-facing copy — copy lives in the app, not the package.

### Create patient (mutation with E2EE)

```mermaid
sequenceDiagram
    autonumber
    participant UI as web/patient-form.tsx
    participant Hook as useMatrix()
    participant Patients as matrix-client/patients<br/>createPatient
    participant SDK as matrix-js-sdk MatrixClient
    participant HS as Synapse

    UI->>Hook: client (from context)
    UI->>Patients: createPatient(client, record, {inviteUserIds})
    Patients->>SDK: createRoom (encryption: megolm)
    SDK->>HS: POST /createRoom
    HS-->>SDK: room_id
    Patients->>SDK: setRoomTag(roomId, PATIENT_TAG)
    Patients->>SDK: getUserDeviceInfo(self + invitees)
    Note over Patients,SDK: Prime megolm session for every device<br/>that must decrypt the first event
    Patients->>SDK: sendEvent(PATIENT_RECORD)
    SDK->>SDK: megolm encrypt
    SDK->>HS: PUT /send/{type}/{txn}
    Patients->>SDK: sendStateEvent(PROFILE_THREAD root)
    Patients->>SDK: wait for KeyBackupSessionsRemaining=0
    SDK->>HS: PUT /room_keys/keys (backup)
    Patients-->>UI: roomId
```

`patient-form.tsx` only knows about the typed `PatientRecord` shape and the `createPatient` call — it never touches `matrix-js-sdk` types directly. The same pattern applies to `updatePatient`, `sendMessage`, `deletePatient`, etc.

## TI-Messenger reference architecture

For comparison, this is gematik's TI-Messenger system overview — the German
healthcare Matrix federation this project could one day plug into.

```mermaid
flowchart LR
    subgraph CLIENT[" "]
        direction TB
        TMC[TI-Messenger-Client]
        OAC[Org-Admin-Client]
        FRD[Frontend des<br/>Registrierungs-Dienstes]
    end

    subgraph VZD[VZD-FHIR-Directory]
        direction LR
        FP[FHIR-Proxy]
        FD[(FHIR-Directory)]
        AS[Auth-Service]
        OAUTH[OAuth]
    end

    subgraph FACH[TI-Messenger-Fachdienst]
        direction TB
        RD[Registrierungs-Dienst]
        PG[Push-Gateway]
        subgraph MS[Messenger-Service]
            direction LR
            MP[Messenger-Proxy]
            MH[Matrix-Homeserver]
        end
    end

    IDP[Zentraler<br/>IDP-Dienst]
    subgraph FACH2[TI-Messenger-Fachdienst]
        F2[ peer provider ]
    end
    AUTH[Authentifizierungsdienst]

    TMC -- "Matrix – Client Server API" --> MP
    TMC -- "I_TiMessengerContactManagement" --> MP
    TMC -- "I_Registration" --> RD
    FRD -- "I_Registration" --> RD
    OAC -- "I_requestToken" --> RD

    MP <-- "HTTP(S) forward" --> MH
    RD -- "I_internVerification" --> MS

    RD -- "FHIRDirectoryTIMProviderAPI" --> FP
    FP --- FD
    FP --- AS
    AS --- OAUTH
    TMC -- "FHIRDirectorySearchAPI" --> FP
    OAC -- "FHIRDirectoryOwnerAPI" --> FP

    AS -- "OIDC" --> IDP
    RD -- "OIDC" --> IDP

    MH <-- "Matrix – Server Server API" --> FACH2

    TMC -- "Authentifizierungsverfahren" --> AUTH
    FACH -- "Authentifizierungsverfahren" --> AUTH

    classDef green    fill:#d4e8c8,stroke:#6b9c4e,color:#000
    classDef orange   fill:#fde2cc,stroke:#d97f3e,color:#000
    classDef blue     fill:#cfe2ef,stroke:#4a90b8,color:#000
    classDef darkblue fill:#a8c8dc,stroke:#3a7a9c,color:#000
    classDef gray     fill:#ececec,stroke:#888,color:#000

    class TMC,OAC,FRD green
    class FP,FD,AS,OAUTH orange
    class RD,PG blue
    class MP,MH darkblue
    class IDP,AUTH,F2 gray

    style CLIENT fill:#d4e8c8,stroke:#6b9c4e
    style VZD    fill:#fde2cc,stroke:#d97f3e
    style FACH   fill:#cfe2ef,stroke:#4a90b8
    style MS     fill:#a8c8dc,stroke:#3a7a9c
    style FACH2  fill:#cfe2ef,stroke:#4a90b8
```

Source: [gematik/api-ti-messenger](https://github.com/gematik/api-ti-messenger).

### English translation

Same diagram with the German labels translated, for readers unfamiliar
with the gematik terminology.

```mermaid
flowchart LR
    subgraph CLIENT[" "]
        direction TB
        TMC[TI-Messenger Client]
        OAC[Org Admin Client]
        FRD[Registration Service<br/>Frontend]
    end

    subgraph VZD[Directory Service<br/>FHIR Directory]
        direction LR
        FP[FHIR Proxy]
        FD[(FHIR Directory)]
        AS[Auth Service]
        OAUTH[OAuth]
    end

    subgraph FACH[TI-Messenger Service]
        direction TB
        RD[Registration Service]
        PG[Push Gateway]
        subgraph MS[Messenger Service]
            direction LR
            MP[Messenger Proxy]
            MH[Matrix Homeserver]
        end
    end

    IDP[Central<br/>IDP Service]
    subgraph FACH2[TI-Messenger Service]
        F2[ peer provider ]
    end
    AUTH[Authentication Service]

    TMC -- "Matrix – Client Server API" --> MP
    TMC -- "I_TiMessengerContactManagement" --> MP
    TMC -- "I_Registration" --> RD
    FRD -- "I_Registration" --> RD
    OAC -- "I_requestToken" --> RD

    MP <-- "HTTP(S) forward" --> MH
    RD -- "I_internVerification" --> MS

    RD -- "FHIRDirectoryTIMProviderAPI" --> FP
    FP --- FD
    FP --- AS
    AS --- OAUTH
    TMC -- "FHIRDirectorySearchAPI" --> FP
    OAC -- "FHIRDirectoryOwnerAPI" --> FP

    AS -- "OIDC" --> IDP
    RD -- "OIDC" --> IDP

    MH <-- "Matrix – Server Server API" --> FACH2

    TMC -- "Authentication" --> AUTH
    FACH -- "Authentication" --> AUTH

    classDef green    fill:#d4e8c8,stroke:#6b9c4e,color:#000
    classDef orange   fill:#fde2cc,stroke:#d97f3e,color:#000
    classDef blue     fill:#cfe2ef,stroke:#4a90b8,color:#000
    classDef darkblue fill:#a8c8dc,stroke:#3a7a9c,color:#000
    classDef gray     fill:#ececec,stroke:#888,color:#000

    class TMC,OAC,FRD green
    class FP,FD,AS,OAUTH orange
    class RD,PG blue
    class MP,MH darkblue
    class IDP,AUTH,F2 gray

    style CLIENT fill:#d4e8c8,stroke:#6b9c4e
    style VZD    fill:#fde2cc,stroke:#d97f3e
    style FACH   fill:#cfe2ef,stroke:#4a90b8
    style MS     fill:#a8c8dc,stroke:#3a7a9c
    style FACH2  fill:#cfe2ef,stroke:#4a90b8
```

Glossary:

- **VZD** (*Verzeichnisdienst*) — Directory Service. The federation-wide
  FHIR directory of organizations and users.
- **Fachdienst** — literally "specialist service"; in gematik terms it
  means a provider-operated service that participates in the TI
  federation. Each TI-Messenger Fachdienst runs its own Matrix homeserver.
- **Registrierungs-Dienst** — Registration Service. Registers users and
  organizations against the directory before they can use the messenger.
- **IDP-Dienst** — Identity Provider Service. The central OIDC issuer
  shared across the federation.
- **Authentifizierungsverfahren** — Authentication procedure (the actual
  method by which a client proves identity to the IDP).

## Development

```bash
docker compose up -d   # local Synapse homeserver
pnpm install
pnpm dev
```

First session generates a recovery key (shown once). Subsequent sessions must
enter that key on sign-in — no feature is usable until the key is verified.
