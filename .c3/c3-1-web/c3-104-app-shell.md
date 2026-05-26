---
id: c3-104
c3-seal: f2b314d845753a361f76297cba9d6fb80d01a829466179353ebb7145873120b7
title: app-shell
type: component
category: foundation
parent: c3-1
goal: Pick the right top-level layout for each matrix-client provider `status` so routes never have to switch on session state, and warn the user before they navigate away while a key backup upload is in flight.
uses:
    - ref-client-only
    - ref-key-gate
    - ref-toast-feedback
    - rule-key-gate-disable
    - rule-no-direct-sdk-import
---

## Goal

Pick the right top-level layout for each matrix-client provider `status` so routes never have to switch on session state, and warn the user before they navigate away while a key backup upload is in flight.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | All app routes (web/src/app/**/page.tsx). |
| External deps | matrix-client/react (useMatrix). |
| Persistence | None |

## Purpose

Owns: `status -> layout` mapping for `initializing` / `connecting` / `error` / no-session / `ready`. Mounts the header (`StatusBar`) only when `ready`. Installs a `beforeunload` warning while `pendingBackup > 0` so the user does not lose unsynced megolm keys. File: `web/src/components/app-shell.tsx`.

Non-goals: route logic (lives under `web/src/app/`), the recovery-key gate itself (delegated to status-bar inside the `ready` layout), clinic gating (delegated to clinic-guard on `/patients`).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | A MatrixProvider from matrix-client/react exists above the shell in the tree. | ref-matrix-js-sdk |
| Inputs | children from the active route. | ref-client-only |
| State | None local; reads status, session, error, pendingBackup from useMatrix(). | ref-client-only |
| Shared deps | FullPageLoader, SignIn, StatusBar. | ref-client-only |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | The user sees the right top-level frame for the current session state, and gets a navigation warning while keys are still uploading. | ref-key-gate |
| Primary path | status === "ready" and session present -> render header <StatusBar /> + main slot with children. | ref-key-gate |
| Alternates | initializing/connecting -> <FullPageLoader />; error -> error panel + <SignIn />; no session -> <SignIn />. | ref-client-only |
| Failure | No catch; provider drives status and error. | ref-matrix-js-sdk |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Status -> layout mapping | hard | children render only when status === "ready" and session is non-null. |
| ref-client-only | ref | "use client" | hard | The shell uses hooks and window, so it must be a client component. |
| ref-matrix-js-sdk | ref | Provider source | hard | Reads useMatrix() from matrix-client/react. |
| rule-no-direct-sdk-import | rule | Wrapper boundary | hard | The shell never imports from matrix-js-sdk. |
| ref-toast-feedback | ref | Mount surface | soft | The shell sits beneath the layout <Toaster /> so feature toasts surface here. |
| rule-key-gate-disable | rule | Pre-ready gating | hard | When status !== "ready" the shell short-circuits to sign-in/loader/error before any feature with the disable pattern can render. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <AppShell>{children}</AppShell> | IN | Wraps every route under web/src/app/. | React | web/src/components/app-shell.tsx |
| Header | OUT | Mounts <StatusBar /> only when status === "ready". | React | web/src/components/app-shell.tsx |
| beforeunload warning | OUT | Installed iff pendingBackup > 0; uninstalled when it drops. | window | web/src/components/app-shell.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Children rendered before ready | Loosening the status !== "ready" guard. | Features run with client === null and crash. | Inspect web/src/components/app-shell.tsx for the status === "ready" branch |
| StatusBar mounted twice | A feature page mounts <StatusBar /> itself. | Duplicate badges visible in header. | git grep -n "<StatusBar" web/src — only app-shell.tsx may match |
| Pending-backup warning lost | Removing the beforeunload effect. | User navigates away mid-upload and loses keys. | Inspect the useEffect on pendingBackup in web/src/components/app-shell.tsx |
| Sign-in skipped on error | Removing <SignIn /> from the error panel. | User stuck on error screen with no retry. | Inspect the status === "error" branch in web/src/components/app-shell.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Layout switch | Contract | New status values must be handled explicitly. | web/src/components/app-shell.tsx |
| Header chrome | Contract | Width and padding may change; <StatusBar /> must remain the sole header content. | web/src/components/app-shell.tsx |
