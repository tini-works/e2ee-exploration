---
id: c3-203
c3-seal: 26978fced9ad0f709328e5a490dad8cded856792a3d4a39e96ad4a548e7a4fb0
title: secret-storage
type: component
category: foundation
parent: c3-2
goal: Run every SSSS, cross-signing, and key-backup operation through one module so the recovery key is the only secret the user has to manage, and the multi-step Matrix unlock recipe is impossible to get partially wrong.
uses:
    - ref-client-only
    - ref-matrix-js-sdk
    - ref-recovery-key
---

## Goal

Run every SSSS, cross-signing, and key-backup operation through one module so the recovery key is the only secret the user has to manage, and the multi-step Matrix unlock recipe is impossible to get partially wrong.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | foundation |
| Consumers | c3-201-client (wires makeCryptoCallbacks); c3-211-matrix-provider (calls cacheSecurityKey, getStatus, hasCachedBackupDecryptionKey); c3-204-wipe (clears the cache). |
| External deps | matrix-js-sdk crypto-api, decodeRecoveryKey from matrix-js-sdk/lib/crypto-api/recovery-key. |
| Persistence | In-memory cached { keyId, key } slot; Rust-crypto IndexedDB owns the durable copy once cached. |

## Purpose

Owns: `makeCryptoCallbacks` (provides `getSecretStorageKey` + `cacheSecretStorageKey` to the SDK), `cacheSecurityKey` (decode + checkKey + cache), `unlockWithSecurityKey` (the full unlock recipe — bootstrap CS, cross-sign device, enable backup, load backup private key, restore, `decryptAllEvents`), `generateRecoveryKey` (first-time setup: create passphrase-derived key, bootstrap CS + SSSS with `setupNewKeyBackup: true`), `getStatus`, `hasCachedBackupDecryptionKey`, `hasSecretStorage`, `clearCachedSecurityKey`.

Non-goals: deciding when to call these (c3-211 and `web/` UI do), React state, sign-out wipe orchestration (c3-204), UI prompts.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | MatrixClient is PREPARED and has Rust crypto initialised. | ref-recovery-key |
| Inputs | Encoded recovery key string from the user (passed verbatim from UI). | ref-recovery-key |
| State | One in-memory cached { keyId, key } slot per page load; Rust-crypto store on disk holds the backup decryption key after a successful unlock. | ref-recovery-key |
| Shared deps | matrix-js-sdk crypto-api; decodeRecoveryKey dynamically imported from matrix-js-sdk/lib/crypto-api/recovery-key. | ref-matrix-js-sdk |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | The SDK can decrypt historical messages and the provider can flip keyUnlockedThisSession, satisfying the AGENTS.md access gate. | ref-recovery-key |
| Primary path | Existing-user unlock: cacheSecurityKey -> bootstrapCrossSigning({}) -> crossSignDevice(deviceId) -> checkKeyBackupAndEnable -> loadSessionBackupPrivateKeyFromSecretStorage -> restoreKeyBackup -> room.decryptAllEvents for every room. | ref-recovery-key |
| Alternates | First-time setup: createRecoveryKeyFromPassphrase -> bootstrapCrossSigning({ setupNewCrossSigning: true, authUploadDeviceSigningKeys }) -> bootstrapSecretStorage({ createSecretStorageKey, setupNewKeyBackup: true }) -> cache the new key. restoreKeyBackup soft-fails on empty backups (regex matches "no backup", "empty", or "not configured"). | ref-recovery-key |
| Failure | loadSessionBackupPrivateKeyFromSecretStorage failure is rethrown — silent failure would leave the device with an "active" backup it cannot read (every old event surfaces as HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED). | ref-recovery-key |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-recovery-key | ref | One-key UX; the package exposes no import/export/upload-backup paths. | hard | This module is the only path to SSSS-related operations. |
| ref-matrix-js-sdk | ref | All crypto reads go through client.getCrypto(); SDK is dynamically imported. | hard | No direct SDK construction here — c3-201 owns that. |
| ref-client-only | ref | Browser-only ("use client"); dynamic import of matrix-js-sdk/lib/crypto-api/recovery-key. | hard | Cache lives in module state — disappears on tab close. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| makeCryptoCallbacks() | OUT | Returns { getSecretStorageKey, cacheSecretStorageKey } reading/writing the module-local cache. | matrix-js-sdk callback | packages/matrix-client/src/secret-storage.ts |
| cacheSecurityKey(client, key) | OUT | Decodes, validates against the account's SSSS default key, caches in memory; throws on decode failure or wrong key. | Rust crypto + Synapse account data | packages/matrix-client/src/secret-storage.ts |
| unlockWithSecurityKey(client, key) | OUT | Returns { crossSigningReady, secretStorageReady, keyBackupRestored }; throws on decode/backup-key load failures. | Rust crypto + Synapse | packages/matrix-client/src/secret-storage.ts |
| generateRecoveryKey(client, { password }) | OUT | Returns { recoveryKey }; caller MUST display it — cannot be recovered after the call returns. | Rust crypto + Synapse | packages/matrix-client/src/secret-storage.ts |
| getStatus(client) | OUT | Returns { crossSigningReady, secretStorageReady, status, activeBackupVersion }. | Rust crypto | packages/matrix-client/src/secret-storage.ts |
| hasCachedBackupDecryptionKey(client) | OUT | True when crypto.getSessionBackupPrivateKey() returns non-null — lets the provider skip the unlock prompt after a refresh. | Rust crypto store | packages/matrix-client/src/secret-storage.ts |
| clearCachedSecurityKey() | OUT | Clears the module-local cached slot; called by c3-204 on sign-out. | module state | packages/matrix-client/src/secret-storage.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Backup key not loaded after unlock | Reordering or skipping loadSessionBackupPrivateKeyFromSecretStorage. | Historical messages surface as HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED. | Re-read unlockWithSecurityKey in packages/matrix-client/src/secret-storage.ts; loadSessionBackupPrivateKeyFromSecretStorage must run between checkKeyBackupAndEnable and restoreKeyBackup |
| Cache leaks across signed-in users | clearCachedSecurityKey not called on sign-out. | New sign-in sees a stale cached slot and the getSecretStorageKey callback may answer with the wrong key. | grep -n clearCachedSecurityKey packages/matrix-client/src — must appear in wipe.ts and run on sign-out |
| Cross-signing device skipped | crossSignDevice(deviceId) removed because bootstrapCrossSigning looked sufficient. | New device shows as "unverified" to itself and other users; c3-205 reports deviceVerified: false. | Re-read unlockWithSecurityKey in packages/matrix-client/src/secret-storage.ts; crossSignDevice(deviceId) must follow bootstrapCrossSigning |
| First-time setup misses setupNewKeyBackup | bootstrapSecretStorage called without setupNewKeyBackup: true. | Recovery key generated but no backup version exists. | Re-read generateRecoveryKey in packages/matrix-client/src/secret-storage.ts; bootstrapSecretStorage must pass setupNewKeyBackup: true |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| UnlockOutcome type | Contract | None — keyBackupRestored is either { total, imported } or null; the shape is consumed verbatim by UI. | packages/matrix-client/src/secret-storage.ts |
| CryptoStatus payload in the provider | Contract | New fields must be added to both getStatus and the provider's CryptoStatus together. | packages/matrix-client/src/react/provider.tsx |
