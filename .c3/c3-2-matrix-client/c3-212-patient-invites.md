---
id: c3-212
c3-seal: 302d6bceae67931c481dd68d1d85cd63541049da5c1353c960c37cb71fae0fb1
title: patient-invites
type: component
category: feature
parent: c3-2
goal: Surface pending Matrix room invites and accept/decline helpers as a single React hook so the status-bar and the patient-account page can share one subscription instead of each rolling their own `RoomEvent.MyMembership` listener.
uses:
    - ref-client-only
    - ref-room-per-patient
    - rule-no-direct-sdk-import
---

## Goal

Surface pending Matrix room invites and accept/decline helpers as a single React hook so the status-bar and the patient-account page can share one subscription instead of each rolling their own `RoomEvent.MyMembership` listener.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | feature |
| Consumers | Re-exported as usePatientInvites from matrix-client/react; consumed by c3-111 status-bar and c3-115 patient-account. |
| External deps | matrix-js-sdk (RoomEvent.MyMembership). |
| Persistence | None local. |

## Purpose

Owns: the `usePatientInvites()` hook, which (a) initialises invite state from `listPendingInvites(client)`; (b) attaches a `RoomEvent.MyMembership` listener that refreshes on every membership change; (c) returns `{ invites, accept(roomId), decline(roomId) }` where `accept` calls `acceptPatientInvite` (which joins + tags) and `decline` calls `declinePatientInvite` (`leave`). File: `packages/matrix-client/src/react/invites.ts`.

Non-goals: the actual `joinRoom`/`leave` calls (those live in c3-210 patients-domain), tag enforcement (c3-210 tags `PATIENT_TAG`), UI rendering, recovery-key gating.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Inside <MatrixProvider>; useMatrix().client may be null while signed out. | ref-client-only |
| Inputs | None — the hook reads client from context. | ref-room-per-patient |
| State | invites: PendingInvite[] via useState. | ref-client-only |
| Shared deps | listPendingInvites, acceptPatientInvite, declinePatientInvite from c3-210. | ref-room-per-patient |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Consumers render an accurate pending-invites list and can accept/decline without duplicating subscription logic. | ref-room-per-patient |
| Primary path | Mount -> seed via listPendingInvites -> dynamic-import RoomEvent -> attach MyMembership handler that calls refresh() -> on accept/decline call into c3-210 + re-refresh(). | ref-room-per-patient |
| Alternates | When client is null, the hook resets invites to [] and skips attaching the listener until a client arrives. | ref-key-gate |
| Failure | accept/decline reject if client is null; the caller surfaces the error toast. Internal listPendingInvites throws are swallowed via a try/catch. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-room-per-patient | ref | Invite handling | hard | Accept tags the room as a patient room; decline is leave. |
| ref-client-only | ref | "use client" | hard | The hook is a React-only module. |
| rule-no-direct-sdk-import | rule | Wrapper boundary | hard | RoomEvent is the only SDK symbol referenced; everything else routes via c3-210. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| usePatientInvites() | OUT | Returns { invites, accept, decline }. Stable identity per render scope. | matrix-client/react | packages/matrix-client/src/react/invites.ts |
| Refresh trigger | OUT | Subscribes to RoomEvent.MyMembership; detaches on unmount. | matrix-js-sdk | packages/matrix-client/src/react/invites.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Subscription leak | Removing the client.off call from the unsub. | Membership handlers stack across mounts; stale invites flicker. | Re-read the cleanup return in packages/matrix-client/src/react/invites.ts; must call client.off(RoomEvent.MyMembership, ...) |
| Stale invites after accept | Forgetting to re-refresh() after acceptPatientInvite. | Status-bar pill still shows the accepted invite until next render. | Re-read accept and decline in packages/matrix-client/src/react/invites.ts; both must call setInvites(listPendingInvites(client)) |
| Accept bypasses tag | Calling client.joinRoom directly instead of acceptPatientInvite. | Joined rooms never get the PATIENT_TAG; patient-table doesn't list them. | grep -n acceptPatientInvite packages/matrix-client/src/react/invites.ts |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Pending-invites count UI (status-bar) | Contract | Wording may evolve; count source must be usePatientInvites().invites.length. | web/src/components/status-bar.tsx |
