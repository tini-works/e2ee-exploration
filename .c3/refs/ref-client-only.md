---
id: ref-client-only
c3-seal: 734f15893bfc70d9652e6f95f3a40d88cefc07525a4eba54ccb39ad769cf3d74
title: client-only
type: ref
goal: Standardize that all Matrix and crypto state lives in the browser and never crosses the SSR boundary, so the homeserver is the only server-side component and Next.js can't accidentally render anything that touches IndexedDB or `window`.
uses:
    - ref-encrypted-attachments
---

## Goal

Standardize that all Matrix and crypto state lives in the browser and never crosses the SSR boundary, so the homeserver is the only server-side component and Next.js can't accidentally render anything that touches IndexedDB or `window`.

## Choice

Every component that imports from `matrix-client`, `matrix-client/react`, or `matrix-client/patients` is marked `"use client"`. The `MatrixProvider` is mounted at the App Router layout level so its context is always available client-side. `matrix-js-sdk` is dynamically imported (`await import("matrix-js-sdk")`) inside `createMatrixClient` so it never ends up in the server bundle.

The one permitted server-side exception is a **media broker**: a route (`web/src/app/api/attachments/sign`) that holds S3 credentials and mints presigned upload/download URLs. It is **content-blind** — it never sees plaintext, filenames, mimetypes, decryption keys, or any megolm-encrypted content; all attachment crypto happens in the browser. It is **not** metadata-blind: object keys are `rooms/<roomId>/<uuid>`, so the broker and the object store do learn which room (and thus patient) an object belongs to. That metadata exposure is an accepted trade-off for room-scoped storage; see [[ref-encrypted-attachments]].

## Why

- `matrix-js-sdk` and Rust crypto need `window`, `indexedDB`, and `crypto.subtle`. Statically importing them would crash Next.js during prerender.
- Treating the homeserver as the only content-bearing server keeps the trust model honest: no app-server is ever trusted with patient *content*. The attachment signer is a deliberate, narrow exception — it brokers storage URLs and stays blind to content. It does see one piece of metadata (the roomId, baked into the object key); that is a conscious trade-off for room-scoped storage, not a content leak.
- Session persistence lives in `localStorage` (`StoredSession`) and IndexedDB (Matrix store + crypto store). Re-keying these requires the user to be present in the browser.

## How

Every Matrix-touching component file starts with the directive and imports from the package:

```tsx
// web/src/components/sign-in.tsx
"use client";

import { useMatrix } from "matrix-client/react";
```

Inside the package, the SDK is dynamically imported:

```ts
// packages/matrix-client/src/client.ts
export async function createMatrixClient(session: StoredSession) {
  const sdk = await import("matrix-js-sdk");
  // ...
}
```
