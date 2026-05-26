---
id: c3-202
c3-seal: 11a10c4c5e0bc6d0034d69e3af27828fa323e5c572ed79778684adbca7062c81
title: types
type: component
category: foundation
parent: c3-2
goal: Hold the package's persistence-shape declarations and default URLs in one isomorphic-safe module so every other component (client, provider, wipe) imports the same `StoredSession` and storage-key constants without pulling in browser-only code.
uses:
    - ref-matrix-js-sdk
    - rule-no-data-migration
---

## Goal

Hold the package's persistence-shape declarations and default URLs in one isomorphic-safe module so every other component (client, provider, wipe) imports the same `StoredSession` and storage-key constants without pulling in browser-only code.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | foundation |
| Consumers | c3-201-client (constructs StoredSession); c3-211-matrix-provider (loads/persists it under DEFAULT_SESSION_STORAGE_KEY); re-exported via matrix-client for web/ consumers. |
| External deps | matrix-js-sdk (shape matches the m.login.password response fields). |
| Persistence | localStorage (under DEFAULT_SESSION_STORAGE_KEY, default "matrix-client.session"). |

## Purpose

Owns: the `StoredSession` type (`baseUrl`, `identityServerUrl?`, `accessToken`, `userId`, `deviceId`), and the constants `DEFAULT_HOMESERVER_URL`, `DEFAULT_IDENTITY_SERVER_URL`, `DEFAULT_SESSION_STORAGE_KEY`.

Non-goals: serialising/deserialising sessions (the provider does that with `JSON.parse`/`JSON.stringify`), validating field values, any runtime behaviour at all — this file is type + constant declarations only.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | None — module is pure declarations, safe to import anywhere (SSR included). | ref-matrix-js-sdk |
| Inputs | N.A - declarations only, no runtime inputs. | ref-matrix-js-sdk |
| State | N.A - no module state; only exported constants. | ref-matrix-js-sdk |
| Shared deps | N.A - depends on nothing inside or outside the package. | ref-matrix-js-sdk |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | Other components agree on the on-disk session shape and where to find it. | ref-matrix-js-sdk |
| Primary path | Import { StoredSession, DEFAULT_SESSION_STORAGE_KEY }; use them as type and key. | ref-matrix-js-sdk |
| Alternates | MatrixProvider accepts a custom sessionStorageKey prop that overrides the default. | ref-matrix-js-sdk |
| Failure | N.A - no runtime path can fail. | ref-matrix-js-sdk |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-matrix-js-sdk | ref | Field names mirror the SDK's loginRequest response, so this file is the SDK-coupling surface for the persisted session. | hard | Renaming a field here ripples to c3-201 and c3-211 at compile time. |
| rule-no-data-migration | rule | While pre-1.0 we change StoredSession directly — no version field, no compat shims. | hard | A breaking shape change means users re-sign-in; that is the intended escape hatch. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| StoredSession | OUT | { baseUrl, identityServerUrl?, accessToken, userId, deviceId }. | TypeScript types | packages/matrix-client/src/types.ts |
| DEFAULT_HOMESERVER_URL | OUT | "https://matrix-client.matrix.org". | constant | packages/matrix-client/src/types.ts |
| DEFAULT_IDENTITY_SERVER_URL | OUT | "https://vector.im". | constant | packages/matrix-client/src/types.ts |
| DEFAULT_SESSION_STORAGE_KEY | OUT | "matrix-client.session"; overridable by MatrixProvider prop. | localStorage key | packages/matrix-client/src/types.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Field renamed without updating client.ts | Breaking change to StoredSession. | TypeScript build fails in c3-201 and c3-211. | Run npm --workspace matrix-client run typecheck against packages/matrix-client/src/types.ts |
| localStorage key drift | New value for DEFAULT_SESSION_STORAGE_KEY while existing users have data under the old key. | Existing sessions look "signed out" after upgrade. | Inspect packages/matrix-client/src/types.ts and packages/matrix-client/src/react/provider.tsx; constant must match the provider's default |
| Default URL points at unintended homeserver | Constant accidentally changed. | All cold sign-ins target the wrong server. | grep -n DEFAULT_HOMESERVER_URL packages/matrix-client/src/types.ts |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Persisted session JSON in localStorage | Contract | None — field names must match exactly. | packages/matrix-client/src/react/provider.tsx |
| Per-device IndexedDB DB names | Contract | None — (userId, deviceId) pair must come from StoredSession. | packages/matrix-client/src/client.ts |
