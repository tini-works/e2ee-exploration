---
id: adr-20260527-pumped-fn-state
c3-seal: 1d791988e7812a312d3162b92b3adcb11943be96aa845fc92a62e1a304db9556
title: pumped-fn-state
type: adr
goal: 'Retroactively document the `feat/pumped-fn-state` refactor that moved all React state ownership out of `c3-211 matrix-provider` into a new `@pumped-fn/lite` state layer (`packages/matrix-client/src/state/{atoms,actions,scope,tracing}.ts`). The decision being authorized: model that state layer as a new component `c3-207 matrix-state`, re-scope `c3-211 matrix-provider` down to a thin React binding (`useMatrix()` over `useAtom`), and adopt pumped-fn as the package''s state mechanism (atoms as a reactive projection of the long-lived `MatrixClient`).'
status: implemented
date: "2026-05-27"
---

## Goal

Retroactively document the `feat/pumped-fn-state` refactor that moved all React state ownership out of `c3-211 matrix-provider` into a new `@pumped-fn/lite` state layer (`packages/matrix-client/src/state/{atoms,actions,scope,tracing}.ts`). The decision being authorized: model that state layer as a new component `c3-207 matrix-state`, re-scope `c3-211 matrix-provider` down to a thin React binding (`useMatrix()` over `useAtom`), and adopt pumped-fn as the package's state mechanism (atoms as a reactive projection of the long-lived `MatrixClient`).

## Context

On the `feat/pumped-fn-state` branch the provider was rewritten: `provider.tsx` shrank from a ~400-line stateful owner to a 128-line reader that calls `useAtom` and re-exports imperative actions. State now lives in a process-global pumped scope (`state/scope.ts`), the writable atoms in `state/atoms.ts`, and the imperative lifecycle (client bootstrap, SDK listener attach/detach, `signIn`/`signOut`/`resetBackup`/`markKeyUnlocked`, `teardownClient`) in `state/actions.ts`. A dev-only tracing extension lives in `state/tracing.ts`. The four `state/*.ts` files are uncharted (`c3x lookup` returns zero matches), and the `c3-211` doc still claims it "is the only component in the package that owns React state" and locates the listeners, `signOut` guard, and `ready` memo in `provider.tsx` — all now false. `@pumped-fn/lite` + `@pumped-fn/lite-react` are new dependencies of both `matrix-client` and `web` (the `web` sign-in form now uses `scopedValue`). Constraint: the recovery-key gate (`ready` requires `keyUnlocked`) is load-bearing per AGENTS.md and must survive the refactor unchanged — it now lives in `readinessAtom`. Affected topology: container c3-2 and components c3-211, c3-110, plus the new c3-207.

## Decision

Add component `c3-207 matrix-state` owning `packages/matrix-client/src/state/**`, with the same governing refs/rules that previously governed the provider's state ownership (`ref-client-only`, `ref-key-gate`, `ref-recovery-key`, `ref-matrix-js-sdk`, `rule-key-gate-disable`). Re-scope `c3-211 matrix-provider` to the React binding only: it keeps `provider.tsx`, exposes `MatrixProvider` + `useMatrix()`, and re-exports the action functions, but no longer owns state. Create `ref-pumped-fn-state` to standardize how pumped-fn is used here (process-global scope singleton, atoms as a projection of SDK events, `scopedValue` for component-local form state) because the pattern now spans two containers. This wins over widening the provider's code-map because the code physically split state engine from React binding; one doc owning both would misrepresent the boundary that the refactor created.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-2 | container | Gains a new component (matrix-state, created as c3-207) owning state/atoms,actions,scope,tracing.ts; Components table + Responsibilities must reflect the state/provider split. | Parent Delta: add the new component row + update Responsibilities. |
| c3-211 | component | Lost state ownership; body, contract, and change-safety evidence now point at the wrong file. | Rewrite goal/purpose/contract; repoint evidence to state/*. |
| c3-110 | component | Now uses pumped scopedValue for form state and imports standalone signIn from matrix-client/react. | Review body; cite ref-pumped-fn-state. |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-client-only | All state atoms/scope are "use client"; loadSession early-returns when window is undefined. | comply |
| ref-key-gate | The single ready gate moved from a useMemo into readinessAtom; it remains the authoritative gate. | comply |
| ref-recovery-key | markKeyUnlocked / resetBackup still flip keyUnlockedAtom; unlock plumbing is unchanged. | comply |
| ref-matrix-js-sdk | The dynamic import("matrix-js-sdk") and SDK listener wiring now live in state/actions.ts, still inside the package. | comply |
| ref-pumped-fn-state | No ref documents the pumped-fn state pattern now used across c3-207, c3-211, and c3-110. | create-ref |
| ref-toast-feedback | Cited by c3-110, which this ADR edits; its sign-in success/error toasts were reviewed. | N.A - toast feedback unchanged by the state move |
| ref-room-per-patient | Cited by sibling components under c3-2 (c3-206/210/212); the container is in scope so it is acknowledged. | N.A - patient/room domain untouched by this refactor |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-key-gate-disable | Consumers gate mutations on useMatrix().ready; that boolean now derives from readinessAtom, which must keep requiring keyUnlocked. | comply |
| rule-no-direct-sdk-import | sign-in.tsx (web) imports signIn from matrix-client/react, not the SDK; the SDK import stays inside the package (state/actions.ts). | comply |
| rule-no-confirm | Cited by c3-110, which this ADR edits; the sign-in UX was reviewed for new dialogs. | N.A - no dialogs introduced; inline form + toast retained |
| rule-toast-error-shape | Cited by c3-110; the sign-in error-toast shape was reviewed. | N.A - error toast shape unchanged by this refactor |
| rule-no-data-migration | Cited by sibling components under c3-2 (c3-202/204/210); the container is in scope so it is acknowledged. | N.A - no persistence or schema change; only state location moved |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| New component | c3x add component matrix-state --container c3-2 with code-map packages/matrix-client/src/state/**; wire ref-client-only, ref-key-gate, ref-recovery-key, ref-matrix-js-sdk, rule-key-gate-disable, ref-pumped-fn-state. | packages/matrix-client/src/state/*.ts |
| Re-scope provider | c3x write c3-211 Goal/Purpose/Contract/Change-Safety: thin React binding over the scope; remove "only component that owns React state"; repoint evidence to state/*. | packages/matrix-client/src/react/provider.tsx |
| Container delta | c3x write c3-2 --section Components (add c3-207, fix c3-211 row) and --section Responsibilities. | c3-2 README |
| New ref | c3x add ref pumped-fn-state; wire to c3-207, c3-211, c3-110. | state/scope.ts, state/atoms.ts, web/src/components/sign-in.tsx |
| Sign-in note | c3x write c3-110 body: pumped scopedValue form state + standalone signIn import. | web/src/components/sign-in.tsx |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - this ADR changes application code (already on branch) and .c3/ docs only | No c3x CLI command, validator, schema, hint, or template is modified. | N.A - no underlay surface touched |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| c3x check | Fails on broken links/orphans and surfaces coverage; state/** now owned by c3-207. | c3x check after mutations |
| c3x lookup packages/matrix-client/src/state/actions.ts | Resolves to c3-207 with its refs/rules instead of zero matches. | post-change lookup |
| readinessAtom (state/atoms.ts) | Returns ready:false with needs_recovery_key until keyUnlocked — the runtime gate. | packages/matrix-client/src/state/atoms.ts:84 |
| tsc / package build | Type errors if MatrixContextValue and atoms diverge. | matrix-client build |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Widen c3-211 code-map to include state/** | Keeps one component owning two concerns the code deliberately separated (React binding vs. state engine); misrepresents the new boundary and bloats the provider doc. |
| Leave state/** uncharted, only fix c3-211 prose | Uncharted files fail the audit (zero c3x lookup matches) and leave the imperative lifecycle ungoverned by any component. |
| Skip ref-pumped-fn-state | Pattern now spans two containers (matrix-client + web); without a ref it re-triggers a Phase 9 "missing ref" finding immediately. |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| readinessAtom drops the keyUnlocked clause, enabling mutations before unlock. | rule-key-gate-disable cited on c3-207; Change-Safety row requires re-reading the atom. | Read state/atoms.ts readinessAtom; condition keeps !keyUnlocked -> needs_recovery_key. |
| Docs keep saying the provider owns state, re-introducing drift. | This ADR + c3-211 rewrite remove the claim; c3-207 takes ownership. | c3x read c3-211 no longer contains "owns React state". |
| Process-global scope leaks across StrictMode/route changes. | Singleton via globalThis (state/scope.ts), same pattern as peer-key-share; documented in c3-207. | Read state/scope.ts getMatrixScope; single keyed instance. |

## Verification

| Check | Result |
| --- | --- |
| c3x check | No errors after all mutations. |
| c3x lookup packages/matrix-client/src/state/atoms.ts (and actions/scope/tracing) | Resolves to c3-207. |
| c3x read c3-211 --full | Goal no longer claims sole React-state ownership; evidence cites state/*. |
| c3x read c3-2 --section Components | Lists c3-207 matrix-state and a corrected c3-211 row. |
