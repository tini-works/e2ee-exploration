---
id: ref-recovery-key
c3-seal: ea28c6cc1e39e5c1adec42a01788ddef80a8974c9f7e7f6a28281f4df5d2b17f
title: recovery-key
type: ref
goal: 'Standardize the user-visible E2EE unlock flow: when the recovery key is asked for, what unlocking does, and how the key is cached for the current browser session.'
---

## Goal

Standardize the user-visible E2EE unlock flow: when the recovery key is asked for, what unlocking does, and how the key is cached for the current browser session.

## Choice

The recovery key is the only secret the user holds. On first sign-in, `generateRecoveryKey(client)` creates one and shows it once. On every subsequent session, `unlockWithSecurityKey(client, key)` does the full SSSS + cross-signing + key-backup restore in one call. The decoded key is cached in a module-local `getSecretStorageKey` callback for the lifetime of the page so subsequent SDK calls don't re-prompt. No persistence of the key — closing the tab clears it.

## Why

- Matrix's secret-storage flow is famously many-step (decode → check → bootstrap CS → cross-sign device → enable backup → load backup key → restore). Skipping `loadSessionBackupPrivateKeyFromSecretStorage` leaves the device with an active backup it cannot read; every old event surfaces as a decryption failure. Collapsing the steps into one wrapper makes the pattern impossible to get wrong.
- Caching the key only in memory means a stolen browser session can't replay the key after the tab is closed.
- The provider exposes `notReadyReason: "needs_recovery_key"` so the UI can gate features until unlock completes — see [[rule-key-gate-disable]].

## How

The unlock call site is the status bar:

```ts
// web/src/components/status-bar.tsx
import { unlockWithSecurityKey } from "matrix-client";

const outcome = await unlockWithSecurityKey(client, recoveryKey);
if (outcome.keyBackupRestored) markKeyUnlocked();
```

Inside the wrapper:

```ts
// packages/matrix-client/src/secret-storage.ts
const decoded = decodeRecoveryKey(recoveryKey);
await secretStorage.checkKey(decoded, keyId);
cacheSecurityKey(decoded);                      // memory-only
await crypto.bootstrapCrossSigning({ authUploadDeviceSigningKeys: ... });
await crypto.crossSignDevice(deviceId);
await crypto.checkKeyBackupAndEnable();
await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
const { imported, total } = await crypto.restoreKeyBackup();
```
