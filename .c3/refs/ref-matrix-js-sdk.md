---
id: ref-matrix-js-sdk
c3-seal: 82bf52d079642ccf80b918b8dcc1b09ef397c4a3f2adfbc694c8f81103242549
title: matrix-js-sdk
type: ref
goal: 'Standardize how the codebase depends on `matrix-js-sdk`: which package owns the SDK, which crypto stack it uses, and how callers reach Matrix functionality.'
---

## Goal

Standardize how the codebase depends on `matrix-js-sdk`: which package owns the SDK, which crypto stack it uses, and how callers reach Matrix functionality.

## Choice

`matrix-js-sdk` is a dependency of the `matrix-client` workspace package only. The `web` app never imports `matrix-js-sdk` directly — it imports from `matrix-client`, `matrix-client/react`, or `matrix-client/patients`. Crypto uses the Rust crypto backend via `initRustCrypto()` and `IndexedDBStore` + `IndexedDBCryptoStore` for persistence.

## Why

- A single ownership point makes SDK upgrades and breaking-API workarounds a one-package concern. If the web app imported `matrix-js-sdk` directly, every type rename would cascade.
- Rust crypto is the only supported path going forward (libolm is deprecated upstream). Forcing it everywhere prevents accidentally falling back to a deprecated stack.
- IndexedDB stores keyed on `(userId, deviceId)` allow multi-device + multi-account testing in the same browser.

## How

Web app imports go through the package:

```ts
// web/src/components/sign-in.tsx
import { useMatrix } from "matrix-client/react";

// web/src/components/patient-table.tsx
import { listPatients } from "matrix-client/patients";
```

SDK calls and crypto bootstrap live in one place:

```ts
// packages/matrix-client/src/client.ts — the only createClient call site
const sdk = await import("matrix-js-sdk");
const client = sdk.createClient({ store, cryptoStore, ... });
await client.initRustCrypto();
await client.startClient({ initialSyncLimit: 20 });
```
