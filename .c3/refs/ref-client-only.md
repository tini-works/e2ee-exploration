---
id: ref-client-only
c3-seal: 644ff279d2812df33cc7514a1e5cf5d57b7cbd78a86be69dc9959ae12172c5fe
title: client-only
type: ref
goal: Standardize that all Matrix and crypto state lives in the browser and never crosses the SSR boundary, so the homeserver is the only server-side component and Next.js can't accidentally render anything that touches IndexedDB or `window`.
---

## Goal

Standardize that all Matrix and crypto state lives in the browser and never crosses the SSR boundary, so the homeserver is the only server-side component and Next.js can't accidentally render anything that touches IndexedDB or `window`.

## Choice

Every component that imports from `matrix-client`, `matrix-client/react`, or `matrix-client/patients` is marked `"use client"`. The `MatrixProvider` is mounted at the App Router layout level so its context is always available client-side. `matrix-js-sdk` is dynamically imported (`await import("matrix-js-sdk")`) inside `createMatrixClient` so it never ends up in the server bundle.

## Why

- `matrix-js-sdk` and Rust crypto need `window`, `indexedDB`, and `crypto.subtle`. Statically importing them would crash Next.js during prerender.
- Treating the homeserver as the only server keeps the trust model honest: there is no app-server to trust with patient data.
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
