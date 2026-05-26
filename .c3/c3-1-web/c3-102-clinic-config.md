---
id: c3-102
c3-seal: 51a070af96f6fd197bf04a340c62cdb38af60a0c3bb0db3ceeffe339c8ec4bd3
title: clinic-config
type: component
category: foundation
parent: c3-1
goal: Map known clinic Matrix user IDs to human-readable clinic names and provide a single source of truth for "is this user a clinic operator?" — the authority for the `/patients` route's access check and the patient-account clinic-relations list.
uses:
    - ref-key-gate
    - ref-room-per-patient
---

## Goal

Map known clinic Matrix user IDs to human-readable clinic names and provide a single source of truth for "is this user a clinic operator?" — the authority for the `/patients` route's access check and the patient-account clinic-relations list.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | clinic-guard (c3-105), patient-account (c3-115). |
| External deps | None |
| Persistence | Static array in source (CLINICS). |

## Purpose

Owns: `Clinic` type, the `CLINICS` array, `findClinicByUserId(userId)`, and `isClinicUser(userId)`. File: `web/src/lib/config.ts`.

Non-goals: dynamic clinic registration (clinics are a fixed dev fixture), authorization beyond user-ID matching, server-side enforcement (the homeserver still enforces room membership independently).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | A session.userId from the matrix-client provider (or null for signed-out users). | ref-client-only |
| Inputs | Matrix user ID string in @name:server form, or null/undefined. | N.A - typed input |
| State | None — pure lookup over a const array. | N.A - stateless helper module |
| Shared deps | None; does not import from matrix-client/* or the SDK. | N.A - no SDK touch |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Components branch between clinic and patient experience. | ref-key-gate |
| Primary path | isClinicUser(session.userId) -> render clinic UI (patient table) or patient-account view. | ref-key-gate |
| Alternates | findClinicByUserId returns the matching Clinic for the patient-account header / clinic-relations list. | ref-room-per-patient |
| Failure | Unknown user IDs return null / false; no throw, no crash. | N.A - safe default |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Clinic-only route gate | soft | clinic-guard composes this lookup with the recovery-key gate from the provider. |
| ref-room-per-patient | ref | Clinic-relation discovery | soft | patient-account walks every room and matches members against CLINICS. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| CLINICS array | OUT | Stable array; each entry has name and Matrix userId. | module | web/src/lib/config.ts |
| findClinicByUserId(id) | OUT | Returns the matching Clinic or null for unknown/empty IDs. | module | web/src/lib/config.ts |
| isClinicUser(id) | OUT | Returns true iff id matches a CLINICS[].userId. | module | web/src/lib/config.ts |
| Clinic type | OUT | { name: string; userId: string }. | module | web/src/lib/config.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Clinic added without updating consumers | New CLINICS entry; existing callers still assume the prior set. | Stale assertions in any consumer of isClinicUser. | Run git grep -n CLINICS web/src then re-read web/src/components/patient-account.tsx |
| Lookup widened beyond user IDs | Helper signature changed to accept room membership shape. | Type errors in clinic-guard.tsx and patient-account.tsx. | npm --workspace web run typecheck |
| Clinic removed while users hold rooms | Removing a userId users have been invited under. | Their rooms vanish from patient-account Clinics list. | Inspect listClinicRelations in web/src/components/patient-account.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Clinic type | Contract | None | web/src/lib/config.ts |
| ClinicRelation row shape in patient-account | Contract | May add fields, must keep clinicUserId matching CLINICS. | web/src/components/patient-account.tsx |
