---
id: c3-116
c3-seal: d4ecfc97b0ba73ca8767c3549816f95a5d7935a0a31154e59970b02657ed857f
title: routes
type: component
category: feature
parent: c3-1
goal: Map the URL space to feature components via the Next.js App Router. Three pages — `/`, `/patients`, `/patients/[roomId]` — each composing `AppShell` with one feature. The root layout mounts `<MatrixProvider>` and `<Toaster />` so all routes inherit them.
uses:
    - ref-client-only
    - ref-key-gate
    - rule-no-direct-sdk-import
---

## Goal

Map the URL space to feature components via the Next.js App Router. Three pages — `/`, `/patients`, `/patients/[roomId]` — each composing `AppShell` with one feature. The root layout mounts `<MatrixProvider>` and `<Toaster />` so all routes inherit them.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | The Next.js App Router (server) imports these files. Browsers reach them via URLs. |
| External deps | Next.js App Router, matrix-client/react (MatrixProvider). |
| Persistence | None — pages are presentational composition only. |

## Purpose

Owns: `web/src/app/layout.tsx` (root layout that mounts `<MatrixProvider>` and `<Toaster />`); `web/src/app/page.tsx` (the `/` route = `<AppShell><PatientAccount /></AppShell>`); `web/src/app/patients/page.tsx` (`/patients` = `<AppShell><ClinicGuard><PatientTable /></ClinicGuard></AppShell>`); `web/src/app/patients/[roomId]/page.tsx` (`/patients/<id>` = `<AppShell><PatientDetail roomId={decoded} /></AppShell>`). Files: `web/src/app/**/*.tsx`.

Non-goals: business logic, data loading, error UX beyond what `AppShell` provides, server-side rendering of Matrix data (all routes stay client-only).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | App Router has the Matrix provider in scope via the root layout. | ref-client-only |
| Inputs | params.roomId (dynamic segment) decoded via decodeURIComponent. | ref-client-only |
| State | None — pages compose components. | ref-key-gate |
| Shared deps | AppShell from c3-104; ClinicGuard from c3-105; PatientTable, PatientDetail, PatientAccount from the feature layer. | ref-key-gate |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | URL navigation reaches exactly one feature surface wrapped by the standard layout chain. | ref-room-per-patient |
| Primary path | Browser hits / -> RootLayout -> page.tsx -> <AppShell><PatientAccount /></AppShell>. | ref-room-per-patient |
| Alternates | /patients adds <ClinicGuard> before the table; /patients/[roomId] decodes the room id and forwards it as a prop to PatientDetail. | ref-room-per-patient |
| Failure | Bad room id falls through to PatientDetail which shows "Loading room…"; non-existent routes use Next's default 404. | ref-key-gate |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-client-only | ref | Provider scope | hard | MatrixProvider is mounted at the layout level so every route has the client context. |
| ref-key-gate | ref | Gating composition | hard | Every authenticated route flows through AppShell, which renders the gate states (initializing/connecting/error/signed-out) before features. |
| rule-no-direct-sdk-import | rule | Imports | hard | Pages import features and MatrixProvider; never matrix-js-sdk. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| RootLayout | IN | Mounts <MatrixProvider> and <Toaster /> once at the layout root. | Next.js | web/src/app/layout.tsx |
| / route | OUT | Renders <AppShell><PatientAccount /></AppShell>. | Next.js | web/src/app/page.tsx |
| /patients route | OUT | Renders <AppShell><ClinicGuard><PatientTable /></ClinicGuard></AppShell>. | Next.js | web/src/app/patients/page.tsx |
| /patients/[roomId] route | OUT | params is a Promise; the page awaits it and decodes roomId before passing to PatientDetail. | Next.js | web/src/app/patients/[roomId]/page.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Provider mounted twice | A nested layout mounts another <MatrixProvider>. | Two independent sessions in one tab; sync state diverges. | git grep -n MatrixProvider web/src/app — exactly one match |
| Route bypasses AppShell | A new route forgets to wrap with <AppShell>. | Sign-in / loader states never render; user sees raw feature. | Re-read every web/src/app/**/page.tsx; each must start with <AppShell> |
| Room id decoded twice | Calling decodeURIComponent again inside PatientDetail. | Hash characters break room lookups. | Re-read web/src/app/patients/[roomId]/page.tsx; decode happens exactly once before the prop |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Route metadata | Foundational Flow | Title / description copy in layout.tsx may evolve. | web/src/app/layout.tsx |
| Param decoding | Contract | Must remain decodeURIComponent(await params) so paths with : survive. | web/src/app/patients/[roomId]/page.tsx |
