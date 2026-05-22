---
id: c3-117
c3-seal: 0c8cb9453033ae079ba15671b795ee0024812ba7552edbcbf14b2953c70efa11
title: routes
type: component
category: feature
parent: c3-1
goal: |-
    Map URLs to feature components via Next.js App Router with a single
    root layout that mounts `MatrixProvider` + `Toaster` exactly once.
uses:
    - ref-client-only
    - ref-key-gate
    - ref-toast-feedback
---

## Goal

Map URLs to feature components via Next.js App Router with a single
root layout that mounts `MatrixProvider` + `Toaster` exactly once.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | Browser navigation. |
| Mounts at | src/app/ |

## Purpose

Owns: `layout.tsx` (root), `page.tsx` (`<AppShell><PatientAccount/>`),
`patients/page.tsx` (`<AppShell><ClinicGuard><PatientTable/>`),
`patients/[roomId]/page.tsx` (server component that awaits `params`
and renders `<AppShell><PatientDetail roomId=...>`).

Non-goals: business logic, feature rendering, provider lifecycle.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Next.js builds with Tailwind v4 globals. | c3-107 |
| Inputs | URL params; params: Promise<{ roomId }> in the dynamic route. | ref-client-only |
| State | None on the server (params only). | ref-client-only |
| Shared deps | MatrixProvider, Toaster, AppShell, feature components. | c3-102 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Each URL renders the expected feature; provider state persists across navigations. | ref-client-only |
| Primary path | route -> <AppShell> -> feature component. | ref-key-gate |
| Alternates | /patients is wrapped with <ClinicGuard> before rendering the table. | c3-113 |
| Failure | Next.js default error/notFound boundaries apply. | ref-client-only |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-client-only | ref | Server pages must delegate to client components | hard | The dynamic route is a server component that only awaits params and renders client children. |
| ref-toast-feedback | ref | Single <Toaster /> mount | hard | Mounted once in root layout. |
| ref-key-gate | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| Root layout | IN | Mounts <MatrixProvider> and <Toaster /> exactly once. | React | src/app/layout.tsx |
| / | IN | Renders patient-account inside the shell. | React | src/app/page.tsx |
| /patients | IN | Renders patient-list, gated by clinic-guard. | React | src/app/patients/page.tsx |
| /patients/[roomId] | IN | Server component awaiting params, renders patient-detail. | React | src/app/patients/[roomId]/page.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Provider mounted twice | Adding <MatrixProvider> to a nested layout. | Two clients on screen; doubled events. | src/app/layout.tsx |
| Server component touches matrix-js-sdk | Importing SDK in a server file. | Server bundle build fails. | src/app/patients/[roomId]/page.tsx |
| Route added without <AppShell> | New page bypasses status gating. | Renders white screen when not signed in. | src/components/app-shell.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Root metadata | Contract | Title/description may change; structure must stay. | src/app/layout.tsx |
