---
id: ref-matrix-js-sdk
c3-seal: ed5de1da9967f5c6f2e3baa8a4958a4a8fa57fc6ad74a0d5aeef086d2f6dfeed
title: matrix-js-sdk
type: ref
goal: |-
    Standardize a single way to talk to Matrix from the browser so every
    component sees the same client lifecycle, crypto guarantees, and event
    shape.
---

## Goal

Standardize a single way to talk to Matrix from the browser so every
component sees the same client lifecycle, crypto guarantees, and event
shape.

## Choice

`matrix-js-sdk` v41 with `initRustCrypto()`, `IndexedDBStore`, and
`IndexedDBCryptoStore`, accessed only through
`src/lib/matrix/client.ts`'s `createMatrixClient` builder.

## Why

`matrix-js-sdk` is the only client library Element/Matrix.org keeps in
lockstep with the protocol; the rust crypto stack is the only path
that gets Megolm + secret-storage updates. Centralizing creation in
one builder means SSSS callbacks, store names, and the
`PREPARED`-sync wait stay consistent across sign-in and resume.

## How

`createMatrixClient` is the only place that calls `sdk.createClient`.
Stores are namespaced per `(userId, deviceId)`:

```ts
// src/lib/matrix/client.ts
const storeKey = `${session.userId}:${session.deviceId}`;
const store = new IndexedDBStore({
  indexedDB: window.indexedDB,
  dbName: `matrix-app:${storeKey}`,
  localStorage: window.localStorage,
});
await store.startup();

const cryptoStore = new IndexedDBCryptoStore(
  window.indexedDB,
  `matrix-app-crypto:${storeKey}`,
);

const client = createClient({
  baseUrl: session.baseUrl,
  accessToken: session.accessToken,
  userId: session.userId,
  deviceId: session.deviceId,
  store,
  cryptoStore,
  cryptoCallbacks: makeCryptoCallbacks(),
  timelineSupport: true,
});

await client.initRustCrypto();
await client.startClient({ initialSyncLimit: 20 });
await waitForPrepared(client);
```

Required: rust crypto, indexedDB stores, `waitForPrepared` before any
SSSS or backup call. Optional: tuning `initialSyncLimit`.
