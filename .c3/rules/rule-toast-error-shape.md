---
id: rule-toast-error-shape
c3-seal: 7668f43134b5346296ba0ac280bac33bfa54b1cd3e52abaf7e3a0f04ca1504d5
title: toast-error-shape
type: rule
goal: |-
    Make every async UI handler turn unknown thrown values into a single,
    predictable toast string so the user always sees a message — even
    when the SDK throws a non-`Error`.
---

## Goal

Make every async UI handler turn unknown thrown values into a single,
predictable toast string so the user always sees a message — even
when the SDK throws a non-`Error`.

## Rule

Every `catch` block in a client component that surfaces failure to the
user must call
`toast.error(err instanceof Error ? err.message : String(err))`.

## Golden Example

```tsx
// src/components/sign-in.tsx
const onSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true);
  try {
    await signIn({ baseUrl, identityServerUrl, username, password });
    toast.success("Signed in. Enter your recovery key…");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err));  // REQUIRED
  } finally {
    setSubmitting(false);
  }
};
```

REQUIRED: the literal `err instanceof Error ? err.message : String(err)`
expression. OPTIONAL: extra context in the message (prefix with what
was being attempted). The same expression is also used for
`navigator.clipboard.writeText` failures and invite accept/decline
handlers.

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| toast.error(String(err)) | err instanceof Error ? err.message : String(err) | String(new Error("x")) yields "Error: x", losing the bare message. |
| toast.error((err as Error).message) | Same as golden. | Throws TypeError when err is a plain object or undefined. |
| Swallowing the error silently | Re-throw or surface via toast. | Silent failure breaks the recovery-key UX (user can't tell why nothing happened). |

## Scope

All async event handlers in `src/components/**` and the provider's
`signIn`/`signOut`/`resetBackup` callers. Background listeners that
already swallow errors with `/* ignore */` are exempt.

## Override

A handler may upgrade to a richer message (e.g. prefixing with the
operation name) but must keep the `err instanceof Error ? ...` shape.
