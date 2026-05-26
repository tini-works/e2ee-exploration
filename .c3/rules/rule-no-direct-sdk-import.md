---
id: rule-no-direct-sdk-import
c3-seal: a7aa000c6b305f32a8667a2d7f8703f79997e8a1449d9cb7308fb8e0c9132a08
title: no-direct-sdk-import
type: rule
goal: Enforce that the `matrix-client` package is the only place in the repo that imports from `matrix-js-sdk`. The web app reaches Matrix functionality only through the package's three entrypoints.
---

## Goal

Enforce that the `matrix-client` package is the only place in the repo that imports from `matrix-js-sdk`. The web app reaches Matrix functionality only through the package's three entrypoints.

## Rule

Files under `web/` never import from `matrix-js-sdk` (no `from "matrix-js-sdk"`, no `import("matrix-js-sdk")`). Matrix-related imports go through `matrix-client`, `matrix-client/react`, or `matrix-client/patients`.

## Golden Example

```ts
// web/src/components/sign-in.tsx — correct: import from the wrapper
"use client";
import { useMatrix } from "matrix-client/react";                 // REQUIRED: package entrypoint

const { signIn } = useMatrix();
await signIn({ baseUrl, user: username, pass: password });
```

```ts
// web/src/components/patient-table.tsx — correct: domain helpers
"use client";
import { listPatients, deletePatient } from "matrix-client/patients";   // REQUIRED

const patients = listPatients(client);
```

```ts
// packages/matrix-client/src/client.ts — the ONLY place matrix-js-sdk is imported
const sdk = await import("matrix-js-sdk");                       // REQUIRED: dynamic import inside package
```

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| import { MatrixClient } from "matrix-js-sdk" in web/ | import { useMatrix } from "matrix-client/react" and use client from context | Web app pinned to SDK types; upgrade breakage cascades into UI files |
| import type { Room } from "matrix-js-sdk" in web/ | Re-export the type from matrix-client (e.g., add to packages/matrix-client/src/types.ts) | Type leak couples UI to SDK shape; refactor requires touching both packages |
| import("matrix-js-sdk") dynamic call in web/ | Move the call into a wrapper function in packages/matrix-client/src/ and import that | Defeats the wrapper's purpose; the package is no longer the single SDK owner |

## Scope

Every file under `web/`. The package itself (`packages/matrix-client/src/`) is where SDK imports must live. Tests under `web/` follow the same rule.

To audit:

```bash
rg "from ['\"]matrix-js-sdk['\"]" web/
# expected: no results
```

## Override

No override. If web needs an SDK feature that isn't exposed by the package, add it to the package first (new export, new helper) and re-import.
