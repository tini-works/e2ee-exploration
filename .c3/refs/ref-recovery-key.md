---
id: ref-recovery-key
c3-seal: d70e25ab524b2682229e31420b3d16eddf072c3d6c9fb670a8f298cec883ca82
title: recovery-key
type: ref
goal: |-
    Have one user-visible secret — the recovery key — control SSSS,
    cross-signing, and key backup, so the UX doesn't drift into separate
    "unlock backup" and "unlock cross-signing" flows.
---

## Goal

Have one user-visible secret — the recovery key — control SSSS,
cross-signing, and key backup, so the UX doesn't drift into separate
"unlock backup" and "unlock cross-signing" flows.

## Choice

A single recovery key (encoded SSSS private key) drives everything:

- Sign-in only restores `restoreKeyBackup` if the key was previously
cached.
- Otherwise the user enters the key in the status bar; that single
action runs `cacheSecurityKey` -> `bootstrapCrossSigning` ->
`checkKeyBackupAndEnable` ->
`loadSessionBackupPrivateKeyFromSecretStorage` -> `restoreKeyBackup`
-> `decryptAllEvents` (`unlockWithSecurityKey`).
- First-time users hit `generateRecoveryKey`, which sets up SSSS,
cross-signing, and a new key backup under the same key in one call.

No import/export/upload-backup/retry/pull-backup buttons.

## Why

`matrix-js-sdk` exposes ~10 crypto knobs (SSSS, cross-signing private
keys, backup version, backup decryption key, sessions, etc.). Surfacing
them individually leaks the protocol into the UI and breaks
`AGENTS.md`'s "no manual key UX" rule. Funneling everything through
the recovery key lets us delete those buttons; the cost is that
`secret-storage.ts` has to encode the right multi-step recipe.

## How

```ts
// src/lib/matrix/secret-storage.ts (unlockWithSecurityKey)
await cacheSecurityKey(client, recoveryKey);
await crypto.bootstrapCrossSigning({});
await crypto.checkKeyBackupAndEnable();
await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
const result = await crypto.restoreKeyBackup();
if (result.imported > 0) {
  await Promise.all(
    client.getRooms().map((r) => r.decryptAllEvents().catch(() => {})),
  );
}
```

Required: the in-memory SSSS cache (`cached: { keyId, key }`) is the
only place the raw decoded key lives; `clearCachedSecurityKey()` runs
on sign-out. Failures of `loadSessionBackupPrivateKeyFromSecretStorage`
are surfaced — silent failure leaves users thinking they're unlocked.
