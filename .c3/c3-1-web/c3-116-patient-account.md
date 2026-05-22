---
id: c3-116
c3-seal: 2dfd6057e327b93dcec1a0864a3165c7ed7f6a723008d9fefbfeb375e1cd4929
title: patient-account
type: component
category: feature
parent: c3-1
goal: |-
    Show a non-clinic user which clinics hold records about them, plus
    their own profile, so the homepage works for both clinic and patient
    roles without a separate URL.
uses:
    - ref-key-gate
    - ref-room-per-patient
    - rule-key-gate-disable
    - rule-toast-error-shape
---

## Goal

Show a non-clinic user which clinics hold records about them, plus
their own profile, so the homepage works for both clinic and patient
roles without a separate URL.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | src/app/page.tsx |
| Mounts at | src/components/patient-account.tsx |

## Purpose

Owns: profile section (user ID, device, homeserver, role badge),
clinic relations list (joined or invited rooms whose membership
includes a known clinic user ID), Accept/Decline buttons for clinic
invites.

Non-goals: clinic patient table (patient-list), single-patient detail
(patient-detail), recovery-key UX.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Provider status === "ready". | c3-102 |
| Inputs | useMatrix() plus CLINICS registry. | c3-106 |
| State | relations (derived), busyRoom. | c3-107 |
| Shared deps | subscribeRooms, acceptInvite/declineInvite. | c3-104 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Patient sees pending and joined clinic rooms; clinic users see a "Open patient list" link too. | c3-106 |
| Primary path | mount -> subscribeRooms -> listClinicRelations -> render. | c3-104 |
| Alternates | Accept/Decline routes through provider's invite callbacks. | c3-102 |
| Failure | toast.error(err instanceof Error ? err.message : String(err)). | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Accept disabled on !ready | hard | Accept button reads ready/notReadyReason. |
| rule-key-gate-disable | rule | Disable + tooltip | hard | Accept button follows the golden pattern. |
| rule-toast-error-shape | rule | Catch shape | hard | Accept/decline catches match. |
| ref-room-per-patient | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <PatientAccount /> | IN | Renders profile + clinic relations. | React | src/components/patient-account.tsx |
| Accept | OUT | Disabled when !ready; routes through provider. | provider | src/components/patient-account.tsx |
| Decline | OUT | Always allowed (read-only leave). | provider | src/components/patient-account.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Patient sees clinic-only UI | Linking to /patients for non-clinic users. | Non-clinic accounts see the link. | src/components/patient-account.tsx |
| Clinic relation lookup misses a clinic | CLINICS updated without rebuilding membership scan. | New clinic invite goes invisible. | src/lib/config.ts |
| Accept without recovery-key unlock | Removing disabled={!ready} from Accept. | Allows acceptance without backup loaded. | src/lib/matrix/provider.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| ClinicRelation row shape | Contract | Adding fields requires updating listClinicRelations. | src/components/patient-account.tsx |
