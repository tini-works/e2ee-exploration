---
id: c3-110
c3-seal: 192a662aea5f8c10c9cbe724cca2fecfb4923f3f1abdd57d3938f8758e482c1c
title: sign-in
type: component
category: feature
parent: c3-1
goal: |-
    Collect homeserver URL + Matrix credentials in a single form and hand
    them to the provider's `signIn` callback.
uses:
    - ref-key-gate
    - ref-recovery-key
    - ref-toast-feedback
    - rule-toast-error-shape
---

## Goal

Collect homeserver URL + Matrix credentials in a single form and hand
them to the provider's `signIn` callback.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | app-shell (rendered when no session) |
| Mounts at | src/components/sign-in.tsx |

## Purpose

Owns: homeserver + identity-server defaults, username/password inputs,
submit handler that calls `useMatrix().signIn(...)`, success/error
toasts.

Non-goals: recovery-key entry (status-bar handles it; per
`AGENTS.md`/`ref-recovery-key` it's a separate step), registration,
SSO.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | No active client (provider status is idle or error). | c3-102 |
| Inputs | baseUrl, identityServerUrl, username, password. | c3-107 |
| State | Local useState per field; submitting flag. | c3-107 |
| Shared deps | useMatrix() provider, DEFAULT_HOMESERVER_URL/DEFAULT_IDENTITY_SERVER_URL from types. | c3-104 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | A successful signIn flips the provider to status="ready" (but ready=false until recovery key). | ref-key-gate |
| Primary path | submit -> signIn({baseUrl, identityServerUrl, username, password}) -> success toast hinting at the recovery key. | ref-recovery-key |
| Alternates | Provider also renders this component on status === "error" with the previous error. | c3-102 |
| Failure | Errors caught and surfaced via toast.error. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-toast-feedback | ref | Submit feedback | hard | Success and failure use sonner. |
| rule-toast-error-shape | rule | Catch handler shape | hard | Uses err instanceof Error ? err.message : String(err). |
| ref-recovery-key | ref | Two-step UX | hard | The success toast must tell the user to enter the recovery key next. |
| ref-key-gate | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <SignIn /> | IN | Renders without props; reads provider state. | React | src/components/sign-in.tsx |
| Submit | OUT | Awaits signIn; flips submitting regardless of outcome. | provider | src/components/sign-in.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Auto-skipping the recovery-key step | Adding code that flips keyUnlockedThisSession after sign-in. | Provider ready true without status-bar entry. | src/lib/matrix/provider.tsx |
| Password leaked to logs | Switching <PasswordInput> to <Input type="text">. | Network/log inspection. | src/components/ui/password-input.tsx |
| Stale defaults | Renaming DEFAULT_HOMESERVER_URL. | TS build fails. | src/lib/matrix/types.ts |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Form values | Contract | None | src/components/sign-in.tsx |
