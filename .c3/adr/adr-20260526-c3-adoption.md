---
id: adr-00000000-c3-adoption
c3-seal: a6ba21d6036fb0545f8ac6149d4c84316f22e3c5778edaf9aaf83b5329dcff84
title: C3 Architecture Documentation Adoption
type: adr
goal: Adopt C3 architecture documentation as the project's contract for understanding, changing, and onboarding into this codebase. Establish the system, two containers (`web`, `matrix-client`), 22 components, 6 refs, and 5 rules as the authoritative description of the application, and wire them so that `c3x lookup`, `c3x graph`, and `c3x check` answer architecture questions without re-reading source.
status: implemented
date: "2026-05-26"
affects:
    - c3-0
---

## Goal

Adopt C3 architecture documentation as the project's contract for understanding, changing, and onboarding into this codebase. Establish the system, two containers (`web`, `matrix-client`), 22 components, 6 refs, and 5 rules as the authoritative description of the application, and wire them so that `c3x lookup`, `c3x graph`, and `c3x check` answer architecture questions without re-reading source.

## Context

This repo is a pre-1.0 E2EE patient-records app built on Matrix. Two notable shape changes already happened (extraction of `matrix-js-sdk` into a `matrix-client` workspace package; renaming `Customized` docs). Without C3 docs, new contributors had to read `README.md`, `AGENTS.md`, and crawl every file to learn the constraints (recovery-key gate, no `confirm`, no direct SDK imports, no migrations). The C3 topology stub had containers and a list of intended component IDs, but no component bodies, no wiring, and an empty ADR-000 — so `c3x check` flagged 22 unknown-entity warnings and `c3x lookup` returned nothing for source files. This ADR closes Stage 1 (Details) and Stage 2 (Finalize) of the onboarding workflow.

## Decision

Author full component bodies for all 22 components (6 web foundation, 7 web feature, 6 matrix-client foundation, 3 matrix-client feature) using the strict schema (`Goal`, `Parent Fit`, `Purpose`, `Foundational Flow`, `Business Flow`, `Governance`, `Contract`, `Change Safety`, `Derived Materials`). Wire each component to the refs/rules it actually obeys. Set code-map globs so every source file under `web/src/**` and `packages/matrix-client/src/**` maps to exactly one component. Validate with `c3x check`. Then mark this ADR `implemented`.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-0 | system | Defines the patient-records system; this ADR populates its container/component tree. | Re-read after ADR completes: list should show 22 components with code-map coverage. |
| c3-1 | container | Owns the web app; gains 13 component documents. | c3x read c3-1 --section Components matches the 13 created components. |
| c3-2 | container | Owns the matrix-client package; gains 9 component documents. | c3x read c3-2 --section Components matches the 9 created components. |
| c3-101 | component | Web foundation: ui-kit. | Created with full schema; wired to ref-toast-feedback, ref-client-only. |
| c3-102 | component | Web foundation: clinic-config. | Created with full schema; wired to ref-key-gate, ref-room-per-patient. |
| c3-103 | component | Web foundation: not-ready-message. | Created with full schema; wired to ref-key-gate, ref-matrix-js-sdk, rule-key-gate-disable, rule-no-direct-sdk-import, ref-client-only. |
| c3-104 | component | Web foundation: app-shell. | Created with full schema; wired to ref-client-only, ref-key-gate, ref-toast-feedback, rule-key-gate-disable, rule-no-direct-sdk-import. |
| c3-105 | component | Web foundation: clinic-guard. | Created with full schema; wired to ref-key-gate, ref-client-only, ref-matrix-js-sdk, rule-no-direct-sdk-import. |
| c3-106 | component | Web foundation: full-page-loader. | Created with full schema; wired to ref-client-only, ref-key-gate. |
| c3-110 | component | Web feature: sign-in. | Created with full schema; wired to ref-recovery-key, ref-toast-feedback, rule-no-confirm, rule-no-direct-sdk-import, rule-toast-error-shape. |
| c3-111 | component | Web feature: status-bar. | Created with full schema; wired to ref-recovery-key, ref-key-gate, ref-toast-feedback, rule-no-confirm, rule-key-gate-disable, rule-no-direct-sdk-import. |
| c3-112 | component | Web feature: patient-table. | Created with full schema; wired to ref-room-per-patient, ref-key-gate, rule-key-gate-disable, rule-no-confirm, rule-toast-error-shape, rule-no-direct-sdk-import. |
| c3-113 | component | Web feature: patient-detail. | Created with full schema; wired to ref-room-per-patient, ref-recovery-key, ref-key-gate, rule-key-gate-disable, rule-no-direct-sdk-import, rule-toast-error-shape. |
| c3-114 | component | Web feature: patient-form. | Created with full schema; wired to ref-room-per-patient, rule-key-gate-disable, rule-no-confirm, rule-no-direct-sdk-import, rule-toast-error-shape. |
| c3-115 | component | Web feature: patient-account. | Created with full schema; wired to ref-room-per-patient, ref-key-gate, rule-key-gate-disable, rule-toast-error-shape, rule-no-direct-sdk-import. |
| c3-116 | component | Web feature: routes. | Created with full schema; wired to ref-client-only, ref-key-gate, rule-no-direct-sdk-import. |
| c3-201 | component | matrix-client foundation: client. | Created with full schema; wired to ref-matrix-js-sdk, ref-client-only, ref-recovery-key. |
| c3-202 | component | matrix-client foundation: types. | Created with full schema; wired to ref-matrix-js-sdk, rule-no-data-migration. |
| c3-203 | component | matrix-client foundation: secret-storage. | Created with full schema; wired to ref-recovery-key, ref-matrix-js-sdk, ref-client-only. |
| c3-204 | component | matrix-client foundation: wipe. | Created with full schema; wired to ref-recovery-key, ref-client-only, rule-no-data-migration, rule-no-direct-sdk-import. |
| c3-205 | component | matrix-client foundation: verification. | Created with full schema; wired to ref-matrix-js-sdk, ref-client-only, ref-recovery-key. |
| c3-206 | component | matrix-client foundation: peer-key-share. | Created with full schema; wired to ref-matrix-js-sdk, ref-room-per-patient, ref-client-only, rule-no-direct-sdk-import. |
| c3-210 | component | matrix-client feature: patients-domain. | Created with full schema; wired to ref-room-per-patient, ref-matrix-js-sdk, rule-no-data-migration, rule-no-direct-sdk-import. |
| c3-211 | component | matrix-client feature: matrix-provider. | Created with full schema; wired to ref-key-gate, ref-recovery-key, ref-client-only, ref-matrix-js-sdk, rule-key-gate-disable. |
| c3-212 | component | matrix-client feature: patient-invites. | Created with full schema; wired to ref-room-per-patient, ref-client-only, rule-no-direct-sdk-import. |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-client-only | Every Matrix-touching component is browser-only; the new docs must cite this so SSR drift is flagged. | comply — wire to c3-101, c3-103..c3-106, c3-110..c3-116 (web side) and c3-201, c3-203, c3-204, c3-205, c3-206, c3-211, c3-212 |
| ref-key-gate | The recovery-key gate sits at the centre of every mutation surface; component docs must surface where the gate is read or enforced. | comply — wire to c3-102, c3-103, c3-104, c3-105, c3-106, c3-110, c3-111, c3-112, c3-113, c3-114, c3-115, c3-116, c3-211 |
| ref-matrix-js-sdk | The SDK boundary defines what the wrapper is allowed to do; matrix-client components and web SDK-edge files must cite it. | comply — wire to c3-103, c3-105, c3-110, c3-201, c3-202, c3-203, c3-205, c3-206, c3-210, c3-211 |
| ref-recovery-key | Recovery-key UX recipe; sign-in, status-bar, patient-detail (UTD hints) and the matrix-client secret-storage/client/wipe/verification/provider components must cite this. | comply — wire to c3-110, c3-111, c3-113, c3-201, c3-203, c3-204, c3-205, c3-211 |
| ref-room-per-patient | Domain model. Every patient feature in web and every domain helper in matrix-client must cite this. | comply — wire to c3-102, c3-112, c3-113, c3-114, c3-115, c3-206, c3-210, c3-212 |
| ref-toast-feedback | Toast usage; every mutation surface plus the ui-kit <Toaster /> mount must cite this. | comply — wire to c3-101, c3-104, c3-110, c3-111 |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-key-gate-disable | Enforces disabled={!ready} on mutation triggers. Every web feature with a mutation must cite this. | comply — wire to c3-104, c3-111, c3-112, c3-113, c3-114, c3-115, c3-211 |
| rule-no-confirm | Forbids native dialogs. Every feature that performs destructive actions must cite this. | comply — wire to c3-110, c3-111, c3-112, c3-114 |
| rule-no-data-migration | Records wipe + recreate as the only schema-change strategy pre-1.0. Cited by components that touch persisted shapes. | comply — wire to c3-202, c3-204, c3-210 |
| rule-no-direct-sdk-import | Forbids matrix-js-sdk imports outside packages/matrix-client/src/. Cited by every web component plus matrix-client internals that share the boundary. | comply — wire to c3-103..c3-106, c3-110..c3-116, c3-204, c3-206, c3-210, c3-212 |
| rule-toast-error-shape | Defines toast.error(headline, { description }) shape. Current code uses single-arg; rule cited as the target shape. | comply — wire to c3-110..c3-115 |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| Component bodies (web) | Author 13 component bodies via c3x add component <slug> --container c3-1 [--feature] --file <body>.md. | c3-101..c3-106, c3-110..c3-116 in c3x list |
| Component bodies (matrix-client) | Author 9 component bodies via c3x add component <slug> --container c3-2 [--feature] --file <body>.md. | c3-201..c3-206, c3-210..c3-212 in c3x list |
| Ref/rule wiring | c3x wire <component> <ref-or-rule> per the Compliance tables above. | c3x graph c3-101 --format mermaid etc. show citation edges |
| Code-map globs | c3x set <component> codemap '<glob>' for every component so c3x lookup covers web/src/** and packages/matrix-client/src/**. | c3x lookup 'web/src/' and c3x lookup 'packages/matrix-client/src/' return non-empty matches |
| Container tables | Restore c3-1 Components table after delete-driven row drops; verified by c3x read c3-1 --section Components. | c3x read c3-1 --section Components lists c3-101..c3-116 in declared order |
| ADR transitions | c3x set adr-00000000-c3-adoption status accepted then c3x set adr-00000000-c3-adoption status implemented. | Frontmatter status: implemented |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| Entity creation | 22 component entities created via c3x add component. | c3x list shows totalCount 37 |
| Relationships | 70+ cite edges added via c3x wire (component to ref/rule). | c3x graph c3-112 --format mermaid shows ref/rule edges |
| Code-map index | codemap field set on each component; covers web/src/** and packages/matrix-client/src/**. | c3x lookup 'web/src/components/patient-table.tsx' returns c3-112 |
| Container Components tables | c3-1 and c3-2 Components sections updated/restored to list every component in declared order. | c3x read c3-1 --section Components, c3x read c3-2 --section Components |
| Schema enforcement | c3x check passes with zero issues across all entities. | c3x check output total: 37 / issues: empty |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| c3x check | Validates section presence, table shape, grounded evidence, refs/rules linkage. Catches drift on every change. | c3x check after this ADR returns no issues. |
| c3x lookup <path> | Resolves any file under web/src/** or packages/matrix-client/src/** to its owning component. | c3x lookup web/src/components/patient-table.tsx returns c3-112 plus refs/rules |
| c3x graph <id> | Renders mermaid view of citation edges; reviewers see exactly which refs/rules a component must honour. | c3x graph c3-1 --format mermaid |
| c3x read <id> | Returns the full body or a section on demand, with help[] hints pointing reviewers to next steps. | c3x read c3-203 --full |
| CLAUDE.md / AGENTS.md | Project instructions tell agents to consult C3 docs before changes (see ## Rules). | Repo root AGENTS.md referenced from CLAUDE.md |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Skip C3 onboarding; rely on README.md + AGENTS.md only. | Existing docs are prose-only and not machine-introspectable. New contributors had no way to map a file to a constraint without reading every file. |
| Document only the package, not the web app. | The recovery-key gate, no-confirm rule, and toast shape live in the web app; documenting only the SDK wrapper would leave the most fragile rules unverifiable. |
| Document at the directory level (one entity per directory). | Too coarse — web/src/components/ would be one entity that owns 6+ unrelated concerns. Per-file components let c3x lookup answer "what governs this file?" precisely. |
| Use freeform README docs per component instead of the strict schema. | The strict schema is what makes c3x check mechanically enforce drift. Freeform prose would let sections rot silently. |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Component docs drift from code as the codebase evolves. | Every change requires an ADR with a Parent Delta line referencing affected components; c3x check flags missing/stale citations. | c3x check rerun on every PR that touches web/src or packages/matrix-client/src |
| Wire edges accumulate as code shifts but never get removed. | When deleting a component, c3x delete removes incoming wires; reviewers must inspect c3x graph for orphan edges. | c3x graph <component> --direction reverse after a delete shows no dangling consumers |
| Component IDs misalign with the container's Components table (happened twice during this ADR's execution). | When component creation fails, restore the container's Components table BEFORE retrying so auto-numbering keeps the declared order. | c3x read c3-1 --section Components matches c3x list foundation/feature numbering |
| Validator quirks (placeholder language, table column count from unescaped pipes) block writes. | Avoid raw | and ` |

## Verification

| Check | Result |
| --- | --- |
| c3x check | total: 37 / issues: empty |
| c3x list | 37 entities: 1 system, 2 containers, 22 components, 6 refs, 5 rules, plus this ADR. |
| c3x lookup web/src/components/patient-table.tsx | Resolves to c3-112 with the cited refs and rules. |
| c3x lookup packages/matrix-client/src/secret-storage.ts | Resolves to c3-203 with the cited refs. |
| c3x graph c3-1 --format mermaid | Shows c3-1 connected to all 13 web components and their cited refs/rules. |
| ADR transition | status: implemented after the above checks pass. |
