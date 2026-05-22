---
id: c3-107
c3-seal: f951004810a0d4a8584572026d4ab25ba4664b9bd989ff50b2c5632050eb592c
title: ui-kit
type: component
category: foundation
parent: c3-1
goal: |-
    Provide one styled set of UI primitives (button, input, dialog,
    dropdown, table, badge, sonner, label, password-input) so every
    feature ships visually consistent surfaces.
uses:
    - ref-toast-feedback
---

## Goal

Provide one styled set of UI primitives (button, input, dialog,
dropdown, table, badge, sonner, label, password-input) so every
feature ships visually consistent surfaces.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | Every feature component. |
| Source | shadcn-style components composed on top of @base-ui/react + Tailwind v4. |

## Purpose

Owns: `Button`, `Input`, `PasswordInput`, `Label`, `Badge`, `Dialog` family,
`DropdownMenu` family, `Table` family, `Toaster` (sonner). Re-exports
from `src/components/ui/`.

Non-goals: business logic, Matrix integration, route concerns.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Tailwind compiled; cn() utility available. | ref-toast-feedback |
| Inputs | React props per primitive. | ref-toast-feedback |
| State | None at the primitive level (each is a presentational wrapper). | N.A - stateless |
| Shared deps | class-variance-authority, clsx, tailwind-merge, lucide-react, sonner. | ref-toast-feedback |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Consistent visual + interaction language across the app. | ref-toast-feedback |
| Primary path | Feature component imports a primitive and composes with domain props. | ref-toast-feedback |
| Alternates | render prop lets callers swap underlying tag (e.g. <Button render={<Link ...>}>). | N.A - prop forwarding |
| Failure | A mis-typed prop fails the TS build. | N.A - type-checked at build |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-toast-feedback | ref | Toaster + Dialog choice | hard | All toasts route through sonner; modal confirms route through Dialog. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <Toaster /> | IN | Mounted exactly once, in src/app/layout.tsx. | React tree | src/app/layout.tsx |
| <Dialog> and <DropdownMenu> | OUT | Controlled via open and onOpenChange. | React | src/components/ui/dialog.tsx |
| Button variants | OUT | default, outline, ghost, destructive, secondary. | React | src/components/ui/button.tsx |
| cn(...) helper | OUT | Combines clsx and tailwind-merge. | utility | src/lib/utils.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Variant rename breaks features | Renaming variant="destructive". | Build/lint errors in features. | src/components/ui/button.tsx |
| Toaster mounted twice | New layout mounts another <Toaster />. | Toasts duplicate. | src/app/layout.tsx |
| Dialog regression on close | onOpenChange rewired. | Modal cannot be dismissed. | src/components/ui/dialog.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| cn() helper | Contract | None | src/lib/utils.ts |
