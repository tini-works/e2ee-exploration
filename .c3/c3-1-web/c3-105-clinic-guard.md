---
id: c3-105
c3-seal: f5fcdd2a92cb4b9ad6cc45cdd75c4392b528b18e233438fe318c369427c12fa0
title: clinic-guard
type: component
category: foundation
parent: c3-1
goal: Restrict the clinic-only `/patients` route to user IDs registered in `CLINICS`, and explain access denial clearly to non-clinic users with a path back to their account page.
uses:
    - ref-client-only
    - ref-key-gate
    - ref-matrix-js-sdk
    - rule-no-direct-sdk-import
---

## Goal

Restrict the clinic-only `/patients` route to user IDs registered in `CLINICS`, and explain access denial clearly to non-clinic users with a path back to their account page.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | web/src/app/patients/page.tsx. |
| External deps | matrix-client/react (useMatrix), next/link. |
| Persistence | None |

## Purpose

Owns: a client-side allowlist check via `isClinicUser(session?.userId)` and the "Clinic access only" denial panel (which prints the user ID verbatim for support traceability and offers a "Back to your account" link to `/`). File: `web/src/components/clinic-guard.tsx`.

Non-goals: server-side authorization (clinics are enforced only on the homeserver via room membership), recovery-key gating (already done by the shell + features), patient-side data rendering (delegated to patient-account).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Provider status === "ready" (the wrapping <AppShell> ensures this). | ref-client-only |
| Inputs | children for the protected sub-tree; reads session?.userId from useMatrix(). | ref-matrix-js-sdk |
| State | None. | N.A - stateless |
| Shared deps | useMatrix() from matrix-client/react, isClinicUser from web/src/lib/config.ts, Button from the UI kit. | ref-client-only |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Non-clinic users see a denial panel with a "Back to your account" CTA; clinic users see children (the patient table). | ref-key-gate |
| Primary path | isClinicUser(session?.userId) -> render children; otherwise render the denial panel. | ref-key-gate |
| Alternates | Unknown / missing session falls through to the denial panel with (unknown) placeholder for the user ID. | ref-key-gate |
| Failure | None — pure render based on the lookup. | N.A - pure render |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Combined gating | hard | Composes with the recovery-key gate enforced inside features; clinic check happens first. |
| ref-client-only | ref | "use client" | hard | Uses useMatrix(). |
| ref-matrix-js-sdk | ref | Provider source | hard | Reads session.userId from the matrix-client provider. |
| rule-no-direct-sdk-import | rule | No SDK imports | hard | Only imports from matrix-client/react. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <ClinicGuard>{children}</ClinicGuard> | IN | Renders children only when isClinicUser(session?.userId) is true. | React | web/src/components/clinic-guard.tsx |
| Denial panel | OUT | Shows the user ID verbatim (or (unknown)) and a <Link href="/"> "Back to your account". | React | web/src/components/clinic-guard.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Patient route exposed to non-clinic | Removing <ClinicGuard> from web/src/app/patients/page.tsx. | Non-clinic accounts see the patient table. | Inspect web/src/app/patients/page.tsx; the table must be wrapped in <ClinicGuard> |
| Lookup widened by accident | Replacing isClinicUser with !!session. | Any signed-in user sees patient list. | Run git grep -n ClinicGuard web/src and git grep -n isClinicUser web/src |
| User-ID hidden from denial | Refactoring the denial copy and dropping the <span class="font-mono">. | Support can no longer ask the user to read their ID. | Re-read the denial copy in web/src/components/clinic-guard.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Denial copy | Contract | None; must include the user ID verbatim. | web/src/components/clinic-guard.tsx |
| Allowlist source | Foundational Flow | None — must use isClinicUser from c3-102, never inline user IDs. | web/src/lib/config.ts |
