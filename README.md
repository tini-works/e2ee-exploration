# Matrix Patient Records

End-to-end encrypted patient records built on top of Matrix. Each patient is a
private encrypted room; profile data lives in an `m.thread`, messages live in
the room timeline.

## Architecture

```mermaid
flowchart TB
    User(["User<br/>clinician"]):::userNode

    subgraph App["matrix-emr — Next.js E2EE app"]
        direction TB

        subgraph BrowserZone["Browser session · trusted"]
            direction TB

            subgraph Gate["MatrixProvider · recovery-key gate"]
                direction TB
                SignIn["Sign-in<br/>username + password + recovery key"]:::leaf
                Ready["Session ready<br/>keyUnlocked · pendingBackup"]:::leaf
            end

            subgraph Sdk["matrix-js-sdk + Rust crypto"]
                direction TB
                Crypto["End-to-end encryption<br/>megolm · cross-signing · backup"]:::leaf
                Store["IndexedDB<br/>crypto + room stores"]:::leaf
            end

            subgraph Features["Feature surfaces"]
                direction TB
                Patients["Patient CRUD<br/>1 encrypted room / patient"]:::leaf
                Messaging["Per-patient messaging"]:::leaf
                Invites["Invites · send · accept · decline"]:::leaf
            end
        end

        subgraph SynapseZone["Synapse homeserver · sees ciphertext only"]
            direction TB
            Rooms["Encrypted rooms<br/>profile thread + timeline"]:::leaf
            Account["Account data<br/>SSSS + key backup"]:::leaf
        end
    end

    User --> SignIn
    SignIn --> Ready
    Ready --> Patients
    Ready --> Messaging
    Ready --> Invites
    Patients --> Crypto
    Messaging --> Crypto
    Invites --> Crypto
    Crypto --> Store
    Crypto <--> Rooms
    Crypto <--> Account

    classDef leaf fill:#0b1220,stroke:#ec4899,stroke-width:1.5px,color:#f9a8d4
    classDef userNode fill:#1a0a14,stroke:#ec4899,stroke-width:2px,color:#fbcfe8

    style App fill:#0a0f1e,stroke:#22d3ee,stroke-width:2px,color:#a5f3fc
    style BrowserZone fill:#0a0f1e,stroke:#22d3ee,stroke-width:2px,color:#a5f3fc
    style SynapseZone fill:#0a0f1e,stroke:#22d3ee,stroke-width:2px,color:#a5f3fc
    style Gate fill:#0a0f1e,stroke:#f59e0b,stroke-width:2px,color:#fcd34d
    style Sdk fill:#0a0f1e,stroke:#f59e0b,stroke-width:2px,color:#fcd34d
    style Features fill:#0a0f1e,stroke:#f59e0b,stroke-width:2px,color:#fcd34d
```

See `docs/v1.md` for per-flow sequence diagrams.

## Development

```bash
docker compose up -d   # local Synapse homeserver
pnpm install
pnpm dev
```

First session generates a recovery key (shown once). Subsequent sessions must
enter that key on sign-in — no feature is usable until the key is verified.
