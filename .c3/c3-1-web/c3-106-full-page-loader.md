---
id: c3-106
c3-seal: fcc7bd27e78b7586ad3b35b5f2d28177169e0f610d94d41d2bbca3de306a2d4e
title: full-page-loader
type: component
category: foundation
parent: c3-1
goal: Render a single full-viewport spinner screen used by the app-shell while the matrix-client provider is in `initializing` or `connecting` state. The caller passes the caption text; this component owns the layout and animation so every bootstrap path looks the same.
uses:
    - ref-client-only
    - ref-key-gate
---

## Goal

Render a single full-viewport spinner screen used by the app-shell while the matrix-client provider is in `initializing` or `connecting` state. The caller passes the caption text; this component owns the layout and animation so every bootstrap path looks the same.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | app-shell (c3-104). |
| External deps | lucide-react (Loader2Icon). |
| Persistence | None |

## Purpose

Owns the `FullPageLoader` component — a flexbox container that fills `min-h-[100dvh]`, centers a spinning `Loader2Icon`, and renders a small muted caption underneath when a `label` prop is provided. File: `web/src/components/full-page-loader.tsx`.

Non-goals: business logic, status interpretation, copy decisions. The caller passes the exact `label` text; this component never branches on Matrix state.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Rendered inside the <MatrixProvider> tree by app-shell. | ref-client-only |
| Inputs | label?: string prop. | ref-client-only |
| State | None — props in, JSX out. | N.A - stateless |
| Shared deps | Loader2Icon from lucide-react; Tailwind utility classes. | ref-client-only |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | The user sees one consistent loading screen while sync prepares. | ref-key-gate |
| Primary path | app-shell renders <FullPageLoader /> while provider status === "initializing". | ref-key-gate |
| Alternates | app-shell renders <FullPageLoader label="Connecting to Matrix…" /> while status === "connecting". | ref-key-gate |
| Failure | Pure render — no async work, no error path. | ref-key-gate |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-client-only | ref | Mount context | soft | Always rendered inside a client tree by app-shell, but the component itself has no client-only APIs. |
| ref-key-gate | ref | Loader-vs-feature gate | soft | The loader is one of the screens used by app-shell to hide features until ready. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <FullPageLoader /> | IN | Renders with no props; fills the viewport vertically. | React | web/src/components/full-page-loader.tsx |
| <FullPageLoader label={text} /> | IN | Renders text as small muted text beneath the spinner. | React | web/src/components/full-page-loader.tsx |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Spinner stops animating | Removing animate-spin class. | Visual review: the loader is static. | grep -n animate-spin web/src/components/full-page-loader.tsx |
| Loader collapses height | Dropping min-h-[100dvh] / flex-1. | Page shows a tiny spinner in the corner during connecting. | grep -n 'min-h-\[100dvh\]' web/src/components/full-page-loader.tsx |
| Label leaks markup | Caller passes JSX instead of a string. | Type error at build. | npm --workspace web run typecheck |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Spinner icon | Contract | Icon may change but it must spin (animate-spin). | web/src/components/full-page-loader.tsx |
| Layout box | Contract | Must remain centered and full-height; class names may shift. | web/src/components/full-page-loader.tsx |
