---
id: c3-118
c3-seal: 9f123569b8781440191b98f3f39cc674697e35bfce1f23e0dcec1aebcfe8d91d
title: pumped-fn-demo
type: component
category: feature
parent: c3-1
goal: |-
    Provide a standalone reference page for `@pumped-fn/lite-react` —
    atoms, scope, Suspense — so that the dependency stays exercised even
    though Matrix features don't use it.
uses:
    - ref-client-only
---

## Goal

Provide a standalone reference page for `@pumped-fn/lite-react` —
atoms, scope, Suspense — so that the dependency stays exercised even
though Matrix features don't use it.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | feature |
| Consumers | /pumped-fn URL only. |
| Mounts at | src/app/pumped-fn/page.tsx |

## Purpose

Owns: `/pumped-fn/page.tsx` (Counter + task-list demo) and
`/pumped-fn/store.ts` (atoms + scope + `ready` Promise).

Non-goals: integration with the Matrix layer, persistence, real task
storage.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | None; demo is independent of session state. | ref-client-only |
| Inputs | User keyboard and pointer events on counter buttons and the task-input field. | c3-107 |
| State | Module-scoped createScope + atoms; useState for text input. | ref-client-only |
| Shared deps | @pumped-fn/lite, @pumped-fn/lite-react. | ref-client-only |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | A counter and a task list both wired through useAtom/useController. | ref-client-only |
| Primary path | Boot resolves ready via Suspense -> renders ScopeProvider -> Counter + Tasks. | ref-client-only |
| Alternates | Reset button calls ctrl.set(0). | ref-client-only |
| Failure | None expected. | ref-client-only |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-client-only | ref | Demo is client-only | hard | Uses "use client"; nothing in the Matrix layer touches it. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| /pumped-fn | IN | Renders the demo independently of Matrix state. | React | src/app/pumped-fn/page.tsx |
| scope, counterAtom, todosAtom, ready | OUT | Module-singleton scope reused across mounts. | module | src/app/pumped-fn/store.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Demo leaks into the rest of the app | Importing demo store from feature components. | Bundle includes demo even when unused. | src/app/pumped-fn/store.ts |
| Suspense boundary removed | Replacing <Suspense> with direct render. | Page throws on first paint. | src/app/pumped-fn/page.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Atom shapes | Contract | Demo-only; not consumed elsewhere. | src/app/pumped-fn/store.ts |
