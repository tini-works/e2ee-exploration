---
id: c3-106
c3-seal: e90e5ec0b1741dea8ce49ac60b60abe24e18982d0dd49f69943944141f7dc571
title: clinic-config
type: component
category: foundation
parent: c3-1
goal: |-
    Map known clinic Matrix user IDs to human-readable clinic names and
    provide one place to decide "is this user a clinic operator?" — the
    authority for the `/patients` route's access check.
uses:
    - ref-key-gate
    - ref-room-per-patient
---

## Goal

Map known clinic Matrix user IDs to human-readable clinic names and
provide one place to decide "is this user a clinic operator?" — the
authority for the `/patients` route's access check.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | clinic-guard, patient-account |
| Storage | Static array in source. |

## Purpose

Owns: `CLINICS` (static list), `findClinicByUserId(userId)`,
`isClinicUser(userId)`.

Non-goals: dynamic clinic registration (out of scope — clinics are a
fixed dev fixture for now), authorization beyond user-ID matching.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | A session.userId from the provider. | c3-102 |
| Inputs | Matrix user ID (@name:server) or null. | c3-102 |
| State | None (pure lookup over a const array). | N.A - stateless helper module |
| Shared deps | None. | N.A - no SDK or storage access |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Components branch between clinic and patient experience. | ref-key-gate |
| Primary path | isClinicUser(session.userId) -> render clinic UI or patient-account view. | ref-key-gate |
| Alternates | Patient view shows clinic relations sourced from room membership. | ref-room-per-patient |
| Failure | Unknown user IDs route to patient-account; no crash. | ref-key-gate |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Clinic-only route gate | soft | clinic-guard composes this lookup with the recovery-key gate. |
| ref-room-per-patient | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| CLINICS array | OUT | Stable array; each entry has name and Matrix userId. | module | src/lib/config.ts |
| findClinicByUserId(id) | OUT | Returns the matching Clinic or null. | module | src/lib/config.ts |
| isClinicUser(id) | OUT | Returns boolean true if id is in CLINICS. | module | src/lib/config.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Clinic added without telling tests | New entry; e2e fixtures don't cover. | E2E may assume two known clinics. | tests/smoke.spec.ts |
| Lookup widened beyond user IDs | Helper renamed to accept room membership shape. | Type errors in consumers. | src/components/clinic-guard.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Clinic type | Contract | None | src/lib/config.ts |
