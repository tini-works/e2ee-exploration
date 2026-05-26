---
id: c3-206
c3-seal: 54c248e10c97b31b8e5725bb287208923b06ac751f51e546811ed86d22227228
title: peer-key-share
type: component
category: foundation
parent: c3-2
goal: Implement a cross-device session-forwarding protocol so that when one device gets an "unable to decrypt" event, it can ask the original sender's *other* devices for the missing megolm session via encrypted to-device messages. Closes the gap between Matrix's per-device session distribution and a multi-device user who needs to read history a sibling device already holds.
uses:
    - ref-client-only
    - ref-matrix-js-sdk
    - ref-room-per-patient
    - rule-no-direct-sdk-import
---

## Goal

Implement a cross-device session-forwarding protocol so that when one device gets an "unable to decrypt" event, it can ask the original sender's *other* devices for the missing megolm session via encrypted to-device messages. Closes the gap between Matrix's per-device session distribution and a multi-device user who needs to read history a sibling device already holds.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | c3-2 |
| Layer | foundation |
| Consumers | c3-201 client (startPeerKeyShare(client) on bootstrap); c3-113 patient-detail (requestKeyFromPeers and usePeerKeyShareState). |
| External deps | matrix-js-sdk (MatrixClient, MatrixEvent, toDeviceEvent, encryptAndSendToDevice, crypto-api exportRoomKeysAsJson / importRoomKeysAsJson). |
| Persistence | None — process-global in-memory state (globalThis.__matrix_client_peer_key_share__). |

## Purpose

Owns: the `PeerKeyShareState` union (`idle`, `requesting`, `received`, `imported`, `no-responders`, `timeout`, `error`); a process-global store keyed by `sessionId` for state, listeners, pending request timers, and per-session dedupe timestamps; `requestKeyFromPeers(client, args)` which sends an `m.app.key_request` to-device to every other device of `fromUserId` (deduped 60s, timed-out 30s); `startPeerKeyShare(client)` which listens for both `m.app.key_request` (answer if requester shares a room) and `m.app.key_forward` (import the forwarded key, decrypt the room timeline). File: `packages/matrix-client/src/peer-key-share.ts`.

Non-goals: server-side trust decisions (Olm encryption on the to-device transport is the only check), recovery-key backup (different code path in c3-203), UI rendering of decryption failures (delegated to c3-113 patient-detail).

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Precondition | Caller holds a MatrixClient that has finished initRustCrypto and is past first sync. | ref-matrix-js-sdk |
| Inputs | RequestKeyArgs (fromUserId, roomId, sessionId, senderKey). | ref-room-per-patient |
| State | Process-global store under globalThis.__matrix_client_peer_key_share__. | ref-client-only |
| Shared deps | client.sendToDevice / client.encryptAndSendToDevice / crypto.getUserDeviceInfo. | ref-matrix-js-sdk |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Outcome | A previously undecryptable event becomes readable because a peer device forwarded the megolm session for that sessionId. | ref-room-per-patient |
| Primary path | Receiver fires requestKeyFromPeers -> dedupe-check -> enumerate sibling devices -> sendToDevice(REQUEST_EVENT_TYPE, perDeviceMap) -> 30s timer. Sender's other device receives the request -> handleRequest validates room membership -> exports just the matching session -> encryptAndSendToDevice(RESPONSE_EVENT_TYPE, ...). Original requester receives the response -> matches request_id to the pending entry -> importRoomKeysAsJson(keys) -> decryptAllEvents for the source room. | ref-room-per-patient |
| Alternates | no-responders when the target user has no other devices; timeout when no answer in 30s; received -> imported once the import succeeds; error carries { message } for either side's failure. | ref-key-gate |
| Failure | All catch blocks log via LOG_ERR and transition the per-session state to error. The to-device listener swallows malformed payloads (missing room_id, session_id, etc.) silently. | rule-toast-error-shape |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-matrix-js-sdk | ref | SDK access | hard | All Olm + to-device + crypto-api calls happen here, not in web/. |
| ref-room-per-patient | ref | Sharing policy | hard | Requests are honored only when the requester shares the source room (join or invite). |
| ref-client-only | ref | Browser scope | hard | Listener attaches to a MatrixClient and uses globalThis for its store. |
| rule-no-direct-sdk-import | rule | Wrapper boundary | hard | Web only consumes requestKeyFromPeers + usePeerKeyShareState — never raw SDK to-device APIs. |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| requestKeyFromPeers(client, args) | OUT | Sends one batch per 60s per sessionId; transitions state through requesting -> imported / timeout / error. | matrix-client | packages/matrix-client/src/peer-key-share.ts |
| startPeerKeyShare(client) | OUT | Attaches a toDeviceEvent listener; returns a detach function that also clears all pending timers and per-session state. | matrix-client | packages/matrix-client/src/peer-key-share.ts |
| subscribePeerKeyShareState(sessionId, listener) | OUT | Returns an unsubscribe; UI uses this via useSyncExternalStore in the React hook. | matrix-client | packages/matrix-client/src/peer-key-share.ts |
| Event types | OUT | Custom m.app.key_request (plaintext to-device) and m.app.key_forward (Olm-encrypted to-device). | Matrix federation | packages/matrix-client/src/peer-key-share.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Untrusted requester gets keys | Removing the room-membership check inside handleRequest. | Any user can request and receive your room's megolm sessions. | Re-read handleRequest in packages/matrix-client/src/peer-key-share.ts; the member.membership allowlist must remain |
| Endless re-request storm | Removing the 60s REQUEST_DEDUPE_MS guard. | Same sessionId floods sibling devices with requests. | Re-read requestKeyFromPeers in packages/matrix-client/src/peer-key-share.ts; the lastRequestedAt check must remain |
| Stuck in requesting forever | Removing the 30s REQUEST_TIMEOUT_MS timer. | UI never falls back to timeout. | Re-read the setTimeout in requestKeyFromPeers in packages/matrix-client/src/peer-key-share.ts |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| usePeerKeyShareState hook | Contract | Wraps subscribePeerKeyShareState via useSyncExternalStore. | packages/matrix-client/src/react/peer-key-share.ts |
| State labels in patient-detail | Foundational Flow | Each PeerKeyShareState.kind must map to a user-readable line. | web/src/components/patient-detail.tsx |
