---
id: c3-112
c3-seal: 54748b5e37f0ae394feece5d0ce18c3cd823b8adf76d9093a8aec5455259349d
title: app-shell
type: component
category: feature
parent: c3-1
goal: |-
    Pick the right top-level layout for each provider `status` so routes
    never have to switch on session state.
uses:
    - ref-key-gate
---

## Goal

Pick the right top-level layout for each provider `status` so routes
never have to switch on session state.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | All app routes (src/app/**/page.tsx). |
| Mounts at | src/components/app-shell.tsx |

## Purpose

Owns: status -> layout mapping. `initializing` and `connecting` -> full
page loader; `error` -> error panel + `<SignIn>`; idle/no session ->
`<SignIn>`; `ready` -> header (`<StatusBar>`) + main content slot.

Non-goals: route logic, the recovery-key gate itself (delegates to
each feature via `ready`).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | A MatrixProvider exists in the React tree. | c3-102 |
| Inputs | children from the active route. | c3-107 |
| State | None; reads provider. | c3-102 |
| Shared deps | FullPageLoader, SignIn, StatusBar. | c3-110 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | The user sees the right top-level frame for the session state. | ref-key-gate |
| Primary path | status -> conditional render -> children only when status === "ready". | ref-key-gate |
| Alternates | Error state still renders <SignIn> underneath so the user can retry. | c3-110 |
| Failure | No catch; provider drives status. | c3-102 |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Status->layout mapping | hard | Children render only when status === "ready". |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <AppShell>{children}</AppShell> | IN | Wraps every route in src/app/. | React | src/components/app-shell.tsx |
| Header | OUT | Mounts <StatusBar /> only when ready. | React | src/components/app-shell.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Children rendered before ready | Loosening the status !== "ready" guard. | Features run with client === null. | src/components/app-shell.tsx |
| StatusBar mounted twice | Mounting it inside a feature page too. | Duplicate badges. | src/components/app-shell.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Layout switch | Contract | New status values must be handled explicitly. | src/components/app-shell.tsx |
