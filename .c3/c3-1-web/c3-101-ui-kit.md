---
id: c3-101
c3-seal: 26754a7d4817da84bfc67986c73d356d83a9eb4fb2d63f822da31582f098f1e1
title: ui-kit
type: component
category: foundation
parent: c3-1
goal: Provide one styled set of UI primitives (button, input, password-input, label, badge, dialog, dropdown-menu, popover, table, sonner toaster) so every feature ships visually consistent surfaces composed on top of @base-ui-components/react + Tailwind v4.
uses:
    - ref-client-only
    - ref-toast-feedback
---

## Goal

Provide one styled set of UI primitives (button, input, password-input, label, badge, dialog, dropdown-menu, popover, table, sonner toaster) so every feature ships visually consistent surfaces composed on top of @base-ui-components/react + Tailwind v4.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | Every feature component (sign-in, status-bar, patient-table, patient-detail, patient-form, patient-account, clinic-guard, app-shell, routes). |
| External deps | @base-ui-components/react, class-variance-authority, clsx, tailwind-merge, lucide-react, sonner. |
| Persistence | None |

## Purpose

Owns: `Button` + `buttonVariants`, `Input`, `PasswordInput`, `Label`, `Badge` + `badgeVariants`, `Dialog` family, `DropdownMenu` family, `Popover` family, `Table` family, `Toaster` (sonner), plus the `cn(...)` class helper in `src/lib/utils.ts`. Files at `web/src/components/ui/*.tsx`.

Non-goals: business logic, Matrix integration, route concerns, recovery-key UX. The primitives never import from `matrix-client/*`.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Tailwind v4 globals compiled (src/app/globals.css); cn() available. | ref-client-only |
| Inputs | React props per primitive (variant, size, render, asChild-style render prop). | N.A - prop forwarding |
| State | None at the primitive level — each is a presentational wrapper. | N.A - stateless |
| Shared deps | class-variance-authority, clsx, tailwind-merge, lucide-react icons, sonner. | ref-toast-feedback |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Consistent visual + interaction language across the app. | ref-toast-feedback |
| Primary path | Feature component imports a primitive and composes with domain props. | ref-toast-feedback |
| Alternates | render prop lets callers swap the underlying tag (e.g. <Button render={<Link href="/">…</Link>} />). | N.A - prop forwarding |
| Failure | A mistyped prop fails the TypeScript build. | N.A - type-checked at build |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-toast-feedback | ref | Toaster + Dialog choice | hard | All toasts route through sonner; modal confirms route through Dialog. |
| ref-client-only | ref | Browser-only primitives | hard | Toaster, Dialog, Popover, DropdownMenu rely on browser DOM and may only mount in client components. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| <Toaster /> | IN | Mounted exactly once, in src/app/layout.tsx. | React tree | web/src/app/layout.tsx |
| <Dialog>, <Popover>, <DropdownMenu> | OUT | Controlled via open + onOpenChange; render-prop based triggers. | React | web/src/components/ui/dialog.tsx |
| Button variants | OUT | default, outline, ghost, destructive, secondary; sizes default, sm, icon. | React | web/src/components/ui/button.tsx |
| PasswordInput | OUT | Same surface as Input but enforces type="password". | React | web/src/components/ui/password-input.tsx |
| cn(...) helper | OUT | Combines clsx + tailwind-merge. | utility | web/src/lib/utils.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Variant rename breaks features | Renaming variant="destructive" or removing a size. | TypeScript / lint errors across features. | npm --workspace web run typecheck against web/src/components/ui/button.tsx |
| Toaster mounted twice | A nested layout mounts another <Toaster />. | Toasts duplicate at runtime. | Inspect web/src/app/layout.tsx; no other layout mounts <Toaster /> |
| Dialog cannot be dismissed | onOpenChange rewired or omitted on a consumer Dialog. | Modal stays open after close click. | Search Dialog usages in web/src/components/*.tsx for missing onOpenChange |
| PasswordInput downgraded to text | type="text" regressions leak credentials. | Visual review + DOM inspection. | grep -n "type=\"password\"" web/src/components/ui/password-input.tsx |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| cn() helper | Contract | None | web/src/lib/utils.ts |
| buttonVariants / badgeVariants | Contract | New variants must be added explicitly; renames are breaking. | web/src/components/ui/button.tsx, web/src/components/ui/badge.tsx |
