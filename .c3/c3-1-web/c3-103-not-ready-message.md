---
id: c3-103
c3-seal: 27bc4fea988cd8951580fa3ac3eb6e2313ab7cdceb0380db988cd0cd067ae284
title: not-ready-message
type: component
category: foundation
parent: c3-1
goal: Translate the matrix-client provider's `NotReadyReason` discriminated union into a single user-facing English string, so every feature can render the same copy for the same gate without re-implementing the switch.
uses:
    - ref-client-only
    - ref-key-gate
    - ref-matrix-js-sdk
    - rule-key-gate-disable
    - rule-no-direct-sdk-import
---

## Goal

Translate the matrix-client provider's `NotReadyReason` discriminated union into a single user-facing English string, so every feature can render the same copy for the same gate without re-implementing the switch.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-1 |
| Layer | foundation |
| Consumers | status-bar (c3-111), patient-table (c3-112), patient-detail (c3-113), patient-form (c3-114), patient-account (c3-115). |
| External deps | matrix-client/react (type-only import of NotReadyReason). |
| Persistence | None |

## Purpose

Owns: the `notReadyMessage(reason)` function. Maps `NotReadyReason.kind` to a localized string: `not_signed_in`, `reconnecting`, `catchup`, `sync_error`, `syncing`, `needs_recovery_key`. File: `web/src/lib/not-ready-message.ts`.

Non-goals: deciding when `ready` flips (provider's job), styling (feature decides where the string lands — title, placeholder, inline text), i18n framework integration.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Caller passes notReadyReason straight from useMatrix(). | ref-matrix-js-sdk |
| Inputs | A NotReadyReason value or null (signature (reason: NotReadyReason or null) => string). | rule-key-gate-disable |
| State | None — pure function. | ref-client-only |
| Shared deps | Type-only import from matrix-client/react. | rule-no-direct-sdk-import |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Users see one consistent reason string across the app whenever something is gated. | ref-key-gate |
| Primary path | useMatrix().notReadyReason -> notReadyMessage(reason) -> rendered as title/placeholder/inline copy. | ref-key-gate |
| Alternates | reason === null returns an empty string so callers can short-circuit the title prop using the or undefined pattern. | ref-key-gate |
| Failure | The switch is exhaustive on kind; TypeScript rejects new kinds at build. | rule-key-gate-disable |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-key-gate | ref | Gate-message wording | hard | Every disabled control's tooltip and every gated input's placeholder must come from this helper. |
| rule-key-gate-disable | rule | Required helper | hard | The golden disable-pattern always renders notReadyMessage(notReadyReason) as the tooltip / placeholder. |
| rule-no-direct-sdk-import | rule | Type source | hard | Imports NotReadyReason from matrix-client/react, never from matrix-js-sdk. |
| ref-matrix-js-sdk | ref | SDK boundary | hard | NotReadyReason is a synthesized type owned by matrix-client; the SDK has no equivalent. |
| ref-client-only | ref | Compliance target added by c3x wire; refine what must be reviewed or complied with before handoff. | wired compliance target beats uncited local prose | Added by c3x wire for explicit compliance review. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| notReadyMessage(reason) | OUT | Returns "" for null; otherwise a non-empty English sentence. | module | web/src/lib/not-ready-message.ts |
| Switch coverage | OUT | Covers every NotReadyReason.kind exported by matrix-client/react. | module | web/src/lib/not-ready-message.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| New NotReadyReason.kind not mapped | matrix-client adds a kind without updating this file. | TypeScript exhaustiveness error on the switch. | npm --workspace web run typecheck |
| Empty string for non-null reason | Refactor returns "" for a real reason. | Buttons show empty tooltip while remaining disabled. | Re-read the switch in web/src/lib/not-ready-message.ts; every case must return a non-empty string |
| Inline copy duplicated in features | A feature writes its own message instead of calling this helper. | Inconsistent strings between gates. | git grep -n notReadyReason web/src/components — every match must call notReadyMessage(...) |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Tooltips on gated buttons | Contract | Must come from the helper, not literal strings. | web/src/components/patient-form.tsx |
| Input placeholders on gated forms | Contract | None | web/src/components/patient-detail.tsx |
