---
id: ref-client-only
c3-seal: 190dc1b849bd07c6e6042b46ae7a718fcdc25c42157823b5389f914a0ce1f520
title: client-only
type: ref
goal: |-
    Keep every module that touches `window`, `IndexedDB`, `matrix-js-sdk`,
    or React state out of the Next.js server bundle so SSR doesn't crash
    and so the app behaves the same on first render as on hydration.
---

## Goal

Keep every module that touches `window`, `IndexedDB`, `matrix-js-sdk`,
or React state out of the Next.js server bundle so SSR doesn't crash
and so the app behaves the same on first render as on hydration.

## Choice

Every file in `src/lib/matrix/` and every component that calls
`useMatrix()` starts with the `"use client"` directive. Imports of
`matrix-js-sdk` happen dynamically (`await import("matrix-js-sdk")`)
inside async functions when they would otherwise pull crypto code into
the SSR pass.

## Why

`matrix-js-sdk` reaches for `window.indexedDB`, `crypto.subtle`, and
`navigator.userAgent` at import time. Loading it on the server throws.
Marking the whole Matrix layer client-only is simpler than dependency
injection and gives Next.js a clean cut so the server bundle stays
small. Dynamic imports inside `createMatrixClient` mean even
client-side code only pays the rust-crypto download when a session
actually exists.

## How

```ts
// src/lib/matrix/client.ts (top of file)
"use client";

// later, only inside an async path:
export async function createMatrixClient(session: StoredSession) {
  const sdk = await import("matrix-js-sdk");
  // ...
}
```

Server components (e.g. `src/app/patients/[roomId]/page.tsx`) MUST
delegate all Matrix interaction to a `"use client"` component;
they may only read `params`/`searchParams`.
