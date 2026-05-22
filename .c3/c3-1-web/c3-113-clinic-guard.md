---
id: c3-113
c3-seal: e67d094c5569f41300867710dc093a7a1d62bb6296a941b08c6bc286e5b48847
title: clinic-guard
type: component
category: feature
parent: c3-1
goal: |-
    Restrict the clinic-only `/patients` route to user IDs registered in
    `CLINICS`, and explain access denial to non-clinic users.
uses:
    - ref-key-gate
---

## Goal

Restrict the clinic-only `/patients` route to user IDs registered in
`CLINICS`, and explain access denial to non-clinic users.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | src/app/patients/page.tsx |
| Mounts at | src/components/clinic-guard.tsx |

## Purpose

Owns: client-side allowlist check via `isClinicUser(session.userId)`
and the "Clinic access only" panel for non-clinic users.

Non-goals: server-side authorization (everything is client-side; the
homeserver enforces room membership), recovery-key gating (already
done by the app-shell + features).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | provider status === "ready" (parent app-shell ensures it). | c3-112 |
| Inputs | children for the clinic path; reads session.userId. | c3-106 |
| State | None. | c3-102 |
| Shared deps | useMatrix() provider, isClinicUser from clinic-config. | c3-106 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Non-clinic users see a "Back to your account" CTA; clinic users see the patient list. | c3-106 |
| Primary path | isClinicUser(session.userId) -> render children or panel. | c3-106 |
| Alternates | Unknown session shows the same denial panel with id placeholder. | c3-106 |
| Failure | None (pure render based on lookup). | c3-106 |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Combined gating | soft | Composes with the recovery-key gate set by the provider. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <ClinicGuard>{children}</ClinicGuard> | IN | Renders children only when isClinicUser(session.userId). | React | src/components/clinic-guard.tsx |
| Denial panel | OUT | Shows the user-id verbatim plus a link back to /. | React | src/components/clinic-guard.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Patient route exposed to non-clinic | Removing the guard from /patients. | Non-clinic accounts see the table. | src/app/patients/page.tsx |
| Lookup widened by accident | Replacing isClinicUser with !!session. | Any signed-in user sees patient list. | src/components/clinic-guard.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Denial copy | Contract | None; must include the user ID verbatim for support. | src/components/clinic-guard.tsx |
