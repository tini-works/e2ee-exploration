---
id: adr-00000000-c3-adoption
c3-seal: 5a156d220ac5abbad39ddfe5f38be11a41170acd312e0244b1c2d910a8e9d7fc
title: C3 Architecture Documentation Adoption
type: adr
goal: |-
    Adopt C3 as the architecture documentation system for the matrix
    patient-records app, by carving the codebase under `src/` into one
    container with foundation (`c3-101..c3-107`) and feature (`c3-110..
    c3-119`) components, six shared refs, and three coding rules — all
    authored under `c3x` and code-mapped against the live source tree.
status: implemented
date: "2026-05-21"
affects:
    - c3-0
---

## Goal

Adopt C3 as the architecture documentation system for the matrix
patient-records app, by carving the codebase under `src/` into one
container with foundation (`c3-101..c3-107`) and feature (`c3-110..
c3-119`) components, six shared refs, and three coding rules — all
authored under `c3x` and code-mapped against the live source tree.

## Context

The repo is a Next.js 16 + matrix-js-sdk client app delivering E2EE
patient records, governed by terse rules in `AGENTS.md` (no `confirm`
dialogs, recovery-key gate, Next.js docs caution, no manual key UX).
Before this ADR, knowledge of the boundaries between the matrix layer
(`src/lib/matrix/**`), feature components (`src/components/**`), and
routes (`src/app/**`) lived in `README.md` and the user's memory only.
The recovery-key gate (`AGENTS.md`) is a hard rule that affects every
feature button but had no machine-checkable representation. Adopting
C3 turns those into citable refs/rules so future changes can be
checked with `c3x check` and `c3x lookup`.

## Decision

Bootstrap C3 with:

1. One container `c3-1 web` representing the Next.js browser app.
2. Seven foundation components (Matrix client, provider,
secret-storage, patients-domain, local-wipe, clinic-config,
ui-kit) and ten feature components (sign-in, status-bar,
app-shell, clinic-guard, patient-list, patient-detail,
patient-account, routes, pumped-fn-demo, patient-form).
3. Six refs: ref-matrix-js-sdk, ref-client-only,
ref-room-per-patient, ref-recovery-key, ref-toast-feedback,
ref-key-gate.
4. Three rules: rule-key-gate-disable, rule-no-confirm,
rule-toast-error-shape (all anchored to literal code in `src/`).
5. Wire every component to its governing refs/rules and set codemap
globs so every file in `src/` resolves to exactly one component.

The Synapse homeserver and PostgreSQL containers in
`docker/compose.yml` are external dependencies and are NOT modelled
as C3 containers.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-0 | system | Created by this ADR: goal, abstract constraints, overview diagram. | Read after adoption to confirm constraints match AGENTS.md. |
| c3-1 | container | The one runtime container; receives all 17 components and the responsibilities list. | Diff Components table against src/ on each new file. |
| c3-101 | component | matrix-client created; encodes the single SDK builder + crypto bootstrap. | Confirm cited refs (ref-matrix-js-sdk, ref-client-only, ref-recovery-key). |
| c3-102 | component | matrix-provider created; encodes the recovery-key gate (ready/notReadyReason). | Confirm Governance lists ref-key-gate, ref-matrix-js-sdk, ref-recovery-key. |
| c3-103 | component | secret-storage created; one-key UX implementation. | Confirm Governance lists ref-recovery-key, ref-matrix-js-sdk. |
| c3-104 | component | patients-domain created; encrypted room CRUD + messaging. | Confirm Governance lists ref-room-per-patient, ref-matrix-js-sdk. |
| c3-105 | component | local-wipe created; sign-out wipe of browser storage. | Confirm Governance lists ref-client-only and ref-recovery-key. |
| c3-106 | component | clinic-config created; clinic registry. | Confirm Governance lists ref-key-gate composition. |
| c3-107 | component | ui-kit created; shadcn primitives + sonner Toaster. | Confirm Governance lists ref-toast-feedback. |
| c3-110 | component | sign-in feature created. | Confirm Governance lists ref-toast-feedback, ref-recovery-key, ref-key-gate, rule-toast-error-shape. |
| c3-111 | component | status-bar feature created. | Confirm Governance lists ref-recovery-key, ref-toast-feedback, rule-no-confirm, rule-toast-error-shape, ref-key-gate. |
| c3-112 | component | app-shell feature created. | Confirm Governance lists ref-key-gate. |
| c3-113 | component | clinic-guard feature created. | Confirm Governance lists ref-key-gate. |
| c3-114 | component | patient-list feature created. | Confirm Governance lists ref-key-gate, ref-room-per-patient, rule-key-gate-disable, rule-no-confirm, rule-toast-error-shape. |
| c3-115 | component | patient-detail feature created. | Confirm Governance lists ref-key-gate, ref-room-per-patient, rule-key-gate-disable, rule-toast-error-shape. |
| c3-116 | component | patient-account feature created. | Confirm Governance lists ref-key-gate, ref-room-per-patient, rule-key-gate-disable, rule-toast-error-shape. |
| c3-117 | component | routes feature created. | Confirm Governance lists ref-client-only, ref-toast-feedback, ref-key-gate. |
| c3-118 | component | pumped-fn-demo feature created. | Confirm Governance lists ref-client-only. |
| c3-119 | component | patient-form feature created. | Confirm Governance lists ref-key-gate, ref-toast-feedback, ref-room-per-patient, rule-key-gate-disable, rule-toast-error-shape. |
| N.A - six refs created in this ADR | N.A - ref-matrix-js-sdk, ref-client-only, ref-room-per-patient, ref-recovery-key, ref-toast-feedback, ref-key-gate | Refs are the cross-cutting choices cited by components above. | Each ref has its own row in the Compliance Refs table below. |
| N.A - three rules created in this ADR | N.A - rule-key-gate-disable, rule-no-confirm, rule-toast-error-shape | Rules encode the enforceable AGENTS.md constraints. | Each rule has its own row in the Compliance Rules table below. |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-matrix-js-sdk | The whole client lives under this choice (single SDK + rust crypto, single builder). | create-ref |
| ref-client-only | Every src/lib/matrix/** file and feature component is "use client". | create-ref |
| ref-room-per-patient | Defines patient-record storage shape used by patients-domain and downstream features. | create-ref |
| ref-recovery-key | Encodes the one-key UX that AGENTS.md mandates and that secret-storage implements. | create-ref |
| ref-toast-feedback | Centralizes sonner + shadcn Dialog usage. | create-ref |
| ref-key-gate | Encodes the ready/notReadyReason derivation that every feature reads. | create-ref |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-key-gate-disable | Enforces the AGENTS.md recovery-key gate at every privileged button via disabled={!ready} + title={notReadyReason}. | create-rule |
| rule-no-confirm | Bans window.confirm/alert/prompt; existing destructive flows already use <Dialog>. | create-rule |
| rule-toast-error-shape | Standardizes catch handlers to toast.error(err instanceof Error ? err.message : String(err)). | create-rule |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| Scaffold | c3x init created .c3/c3.db and ADR-000 stub. | .c3/c3.db |
| System | c3x set c3-0 goal ... + c3x write c3-0 --file set goal, constraints, and the architecture overview mermaid diagram. | c3x read c3-0 --full |
| Container | c3x add container web then c3x write c3-1 --file populated the Components table with all 17 component IDs. | c3x read c3-1 --full |
| Components | Authored body files in /tmp/matrix-c3-bodies/component-*.md and ran c3x add component <slug> --container c3-1 [--feature] --file .... | c3x list shows c3-101..c3-119. |
| Refs | Authored /tmp/matrix-c3-bodies/ref-*.md and ran c3x add ref ... --file .... | c3x list shows the six refs. |
| Rules | Authored /tmp/matrix-c3-bodies/rule-*.md and ran c3x add rule ... --file .... | c3x list shows the three rules. |
| Wires | c3x wire c3-NNN <ref-or-rule>... for each component's governance citations. | c3x graph c3-101 shows linked refs. |
| Codemaps | c3x set c3-NNN codemap '<glob>' for each component. | c3x lookup 'src/**' resolves every file. |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - onboarding ADR | N.A - onboarding does not modify the c3x CLI, validators, hints, schemas, or templates. | N.A - this adoption only authors content under .c3/ via existing CLI commands. |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| c3x check | Fails on broken refs, orphan components, layer disconnects, or duplicate boilerplate in Governance rows. | c3x check returns 0 issues. |
| c3x lookup <file> | Maps any file under src/ to exactly one component + its refs/rules. | c3x lookup 'src/**' shows c3-IDs for every .ts/.tsx/.css. |
| Rules (rule-key-gate-disable, rule-no-confirm, rule-toast-error-shape) | Code review references the Golden Example sections to flag deviations on feature PRs. | c3x read rule-key-gate-disable. |
| CLAUDE.md C3 pointer | Future Claude Code sessions invoke /c3 for architecture questions. | CLAUDE.md updated post-implementation. |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Keep only README.md + AGENTS.md as the architecture docs. | AGENTS.md rules (recovery-key gate, no-confirm) have no machine-checkable mirror in the code; new features can quietly skip them. |
| Two containers (web + dev-synapse). | The Synapse container is external infrastructure; it has no source we own and no components to attach. Modelling it would clutter c3x list with an empty container. |
| Per-file components (one per .tsx). | 30+ components would make c3x graph c3-1 unreadable; small UI primitives like full-page-loader.tsx carry no architectural decision worth documenting on their own. |
| Skip rules; encode everything as refs. | The AGENTS.md "no confirm", recovery-key gate, and toast-error shape are enforceable one-liners with golden code — exactly the shape that references/rule.md requires. |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Component docs drift from code after a refactor. | Every change runs through the /c3 change op with an ADR + c3x check. | c3x check --include-adr on each PR. |
| Codemap stops covering a new file. | Codemap globs use ** where appropriate; lookup is run post-change. | c3x lookup 'src/**' after each PR. |
| Golden Examples in rules go stale. | Rules cite literal code with file paths; reviewers run c3x check after edits. | c3x read rule-<slug> --section "Golden Example". |
| Recovery-key gate regression. | rule-key-gate-disable is wired to every feature that mutates Matrix state. | c3x graph rule-key-gate-disable lists every gated component. |

## Verification

| Check | Result |
| --- | --- |
| bash <skill-dir>/bin/c3x.sh list | Shows 1 system, 1 container, 17 components, 6 refs, 3 rules. |
| bash <skill-dir>/bin/c3x.sh check | 0 issues (29 entities including the ADR). |
| bash <skill-dir>/bin/c3x.sh lookup 'src/**' | Every .ts/.tsx/.css under src/ resolves to a component. |
| bash <skill-dir>/bin/c3x.sh graph c3-1 --format mermaid | Shows all 17 components under c3-1 with their cited refs/rules. |
| CLAUDE.md references .c3/ and /c3. | Injected by the onboard post-step. |
