---
id: c3-110
c3-seal: f62da38ce83f5b835bd9c88eab4e5092f8039d745cb7f8130272db2ced3e2b60
title: sign-in
type: component
category: feature
parent: c3-1
goal: Drive the only path into a fresh Matrix session. Renders the single sign-in form (homeserver, identity server, username, password), calls `useMatrix().signIn`, and surfaces a recovery-key hint toast on success so the user knows the status-bar unlock step is next.
uses:
    - ref-pumped-fn-state
    - ref-recovery-key
    - ref-toast-feedback
    - rule-no-confirm
    - rule-no-direct-sdk-import
    - rule-toast-error-shape
---

## Goal

Drive the only path into a fresh Matrix session. Renders the single sign-in form (homeserver, identity server, username, password), calls `useMatrix().signIn`, and surfaces a recovery-key hint toast on success so the user knows the status-bar unlock step is next.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | app-shell (c3-104). Rendered when provider status is idle or error. |
| External deps | matrix-client/react (useMatrix, standalone signIn), matrix-client (DEFAULT_HOMESERVER_URL, DEFAULT_IDENTITY_SERVER_URL), @pumped-fn/lite-react (scopedValue, useScopedValue), sonner. |
| Persistence | None directly. signIn writes StoredSession to localStorage via c3-207. |

## Purpose

Owns: the sign-in form whose state lives in a pumped `scopedValue` (`sign-in-form`) holding `baseUrl`, `identityServerUrl`, `username`, `password`, `submitting` — not React `useState`; the form's `submit` action, which calls the standalone `signIn({ baseUrl, identityServerUrl, username, password })` imported from `matrix-client/react` (not `useMatrix().signIn`), flips `submitting`, and raises the success/error toast; field setters via `form.actions.set*`; the success toast that nudges the user to enter the recovery key in the status-bar. `useMatrix()` is still read for `status`/`error`. File: `web/src/components/sign-in.tsx`.

Non-goals: secret-storage / recovery-key unlock (lives in c3-111 status-bar), session bootstrap (c3-207 matrix-state / c3-211 matrix-provider), homeserver discovery beyond the package's `DEFAULT_*` constants.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Provider mounted; status not yet ready. | ref-key-gate |
| Inputs | User-typed baseUrl, identityServerUrl, username, password. | ref-matrix-js-sdk |
| State | A pumped scopedValue (sign-in-form) holds the four fields plus a submitting boolean; useScopedValue subscribes the component to its snapshot. | ref-pumped-fn-state |
| Shared deps | standalone signIn from matrix-client/react; useMatrix() for status, error; scopedValue/useScopedValue from @pumped-fn/lite-react; Button, Input, Label, PasswordInput from c3-101; toast from sonner. | ref-pumped-fn-state |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | A valid StoredSession exists in localStorage and the provider transitions to ready. | ref-recovery-key |
| Primary path | User fills the form -> submit -> signIn resolves -> success toast asks the user to unlock with their recovery key. | ref-recovery-key |
| Alternates | Empty identityServerUrl becomes undefined so the SDK skips identity-server lookups. | ref-matrix-js-sdk |
| Failure | signIn rejects -> error toast carries the message (err.message or stringified). Submit button also surfaces provider error next to the form. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-recovery-key | ref | Post-sign-in nudge | hard | Success toast tells the user the recovery-key step happens in the status-bar. |
| ref-toast-feedback | ref | Success + error toasts | hard | All transient feedback goes through sonner. |
| ref-pumped-fn-state | ref | Form state | hard | Form state uses a scopedValue for component-local pumped state instead of useState, the component-local variant of the ref's pattern. |
| rule-no-confirm | rule | Form-only UX | hard | No native dialogs; only the inline form and toasts. |
| rule-no-direct-sdk-import | rule | Import boundary | hard | Imports come from matrix-client, matrix-client/react, and @pumped-fn/lite-react — never matrix-js-sdk directly. |
| rule-toast-error-shape | rule | Error toast shape | hard | Currently uses single-arg form; the rule's headline + description shape is the target. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <SignIn /> | IN | Render with no props inside <MatrixProvider>. | React | web/src/components/sign-in.tsx |
| signIn call | OUT | { baseUrl, identityServerUrl?, username, password }; trimmed strings; identity server empty -> undefined. | matrix-client provider | web/src/components/sign-in.tsx |
| Success toast | OUT | "Signed in. Enter your recovery key from the status bar to unlock encrypted history." | sonner | web/src/components/sign-in.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Password leaks via wrong input type | Replacing PasswordInput with Input. | DOM shows readable password field. | grep -n PasswordInput web/src/components/sign-in.tsx |
| Submit fires twice on slow login | Removing the submitting guard. | Two signIn calls visible in network panel. | Re-read the submit button in web/src/components/sign-in.tsx; disable expression must guard on both submitting and status === "connecting" |
| Recovery-key hint dropped | Removing the success toast copy. | User signs in but never enters the recovery key; features stay disabled. | Re-read the success toast text in web/src/components/sign-in.tsx; must reference the status bar |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Default homeserver + identity server | Foundational Flow | Must read from matrix-client constants, not hardcoded. | web/src/components/sign-in.tsx |
| Success-toast wording | Contract | Wording may evolve but must direct the user to the status-bar recovery-key step. | web/src/components/sign-in.tsx |
