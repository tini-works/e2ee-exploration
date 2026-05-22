---
id: c3-103
c3-seal: e12d4e7d3b5f2a21d7bdfb370e23773c3418b458969c9d07f9cc94e9825caf67
title: secret-storage
type: component
category: foundation
parent: c3-1
goal: |-
    Run every SSSS, cross-signing, and key-backup operation through one
    module so the recovery key is the only secret the user has to manage.
uses:
    - ref-client-only
    - ref-matrix-js-sdk
    - ref-recovery-key
---

## Goal

Run every SSSS, cross-signing, and key-backup operation through one
module so the recovery key is the only secret the user has to manage.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | matrix-provider, status-bar |
| Storage | In-memory cached: { keyId, key }; rust-crypto IndexedDB. |

## Purpose

Owns: `makeCryptoCallbacks` (provides `getSecretStorageKey` to the
SDK), `cacheSecurityKey` (decode + verify), `unlockWithSecurityKey`
(full unlock recipe), `generateRecoveryKey` (first-time setup),
`getStatus`, `hasCachedBackupDecryptionKey`, `hasSecretStorage`,
`clearCachedSecurityKey`.

Non-goals: deciding when to call these (provider/status-bar do),
React state, sign-out wipe orchestration.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | MatrixClient is PREPARED and has rust crypto. | c3-101 |
| Inputs | Encoded recovery key string from the user. | c3-103 |
| State | One in-memory cached slot per page load; rust-crypto store on disk. | ref-recovery-key |
| Shared deps | matrix-js-sdk crypto-api, decodeRecoveryKey from matrix-js-sdk/lib/crypto-api/recovery-key. | ref-matrix-js-sdk |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | The SDK can decrypt historical messages and the user holds proof for the AGENTS.md gate. | ref-recovery-key |
| Primary path (existing user) | cacheSecurityKey -> bootstrapCrossSigning -> checkKeyBackupAndEnable -> loadSessionBackupPrivateKeyFromSecretStorage -> restoreKeyBackup -> decryptAllEvents. | ref-recovery-key |
| Primary path (first-time) | generateRecoveryKey -> createRecoveryKeyFromPassphrase -> bootstrapCrossSigning -> bootstrapSecretStorage(setupNewKeyBackup=true). | ref-recovery-key |
| Failure | loadSessionBackupPrivateKeyFromSecretStorage failure is rethrown (silent failure would mask broken decryption). | ref-recovery-key |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-recovery-key | ref | One-key UX | hard | No import/export/upload-backup buttons — this module is the only path. |
| ref-matrix-js-sdk | ref | rust-crypto access | hard | All calls go through client.getCrypto(). |
| ref-client-only | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| makeCryptoCallbacks() | OUT | Returns getSecretStorageKey plus cacheSecretStorageKey reading the module-local cache. | matrix-js-sdk | src/lib/matrix/secret-storage.ts |
| unlockWithSecurityKey(client, key) | OUT | Throws on decode failure or wrong key; succeeds when SSSS + backup are usable. | rust crypto | src/lib/matrix/secret-storage.ts |
| generateRecoveryKey(client) | OUT | Returns recoveryKey; caller MUST show it to the user (cannot be recovered after). | rust crypto + Synapse | src/lib/matrix/secret-storage.ts |
| cached slot | IN/OUT | Cleared explicitly by clearCachedSecurityKey on sign-out. | module state | src/lib/matrix/secret-storage.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Recovery key shown twice | UI displays it more than once. | Two callsites for generateRecoveryKey. | src/components/status-bar.tsx |
| Backup key not loaded after unlock | Skipping loadSessionBackupPrivateKeyFromSecretStorage. | Historical messages fail with HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED. | src/lib/matrix/secret-storage.ts |
| Cache leaks across signed-in users | clearCachedSecurityKey not called on sign-out. | A new sign-in sees stale cached. | src/lib/matrix/wipe.ts |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| UnlockOutcome | Contract | None | src/lib/matrix/secret-storage.ts |
| CryptoStatus payload | Contract | New fields must add to both getStatus and provider state. | src/lib/matrix/provider.tsx |
