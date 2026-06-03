---
id: adr-20260603-attachment-delete-and-room-keys
c3-seal: 3db4bfb91936297bd4f3e14369503fcc25defbf707b3cf9f945372860936b232
title: attachment-delete-and-room-keys
type: adr
goal: 'Refine the encrypted-attachment feature in three ways: (1) move object storage to room-scoped keys `rooms/<roomId>/<uuid>`; (2) add message deletion via Matrix redaction that also deletes the backing S3 object for file messages; (3) let the timeline decrypt and preview attachments inline (images, PDFs) instead of only downloading. This authorizes the accepted reduction of the signer''s blindness (it now learns roomId) in exchange for room-scoped storage, and the redaction-plus-object-delete flow.'
status: accepted
date: "2026-06-03"
---

## Goal

Refine the encrypted-attachment feature in three ways: (1) move object storage to room-scoped keys `rooms/<roomId>/<uuid>`; (2) add message deletion via Matrix redaction that also deletes the backing S3 object for file messages; (3) let the timeline decrypt and preview attachments inline (images, PDFs) instead of only downloading. This authorizes the accepted reduction of the signer's blindness (it now learns roomId) in exchange for room-scoped storage, and the redaction-plus-object-delete flow.

## Context

The initial attachment feature (adr-20260603-encrypted-s3-attachments) stored ciphertext under a flat `attachments/<uuid>` key and described the signer as fully content- and metadata-blind. The operator wants files grouped per room for listing/cleanup, accepting that the signer and object store then learn roomId. Separately there was no way to delete a message: text or file events were permanent, and a redaction alone would orphan the S3 ciphertext. The timeline could only download attachments, not view them in place. Affected topology: c3-210 (message/attachment primitives), c3-113 (timeline UI), c3-1 (signer route), plus refs ref-encrypted-attachments and ref-client-only whose blindness wording is now inaccurate.

## Decision

Build the S3 key as `rooms/<roomId>/<uuid>` in the signer (the `rooms/` segment fixed in code, the uuid server-issued, the roomId validated to the Matrix room-id grammar to block path traversal). Persist the full object key in the event's `EncryptedFile.url`. Accept that the signer now sees roomId (metadata, not content) and update both refs to say so honestly. Implement deletion as `matrixMessage.delete` → `client.redactEvent`; the web layer captures the object key before redacting and then calls `store.remove` (a new signer `delete` op) so file ciphertext is purged too. Render redacted events as "Message deleted", and let `AttachmentMessage` fetch+decrypt on click and preview images/PDFs inline via a blob URL. Confirm deletes with a sonner toast action, never a native confirm.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-2 | container | attachment + message feature modules gain room-scoped upload, delete, and store.remove. | Confirm new surfaces stay behind the package boundary. |
| c3-210 | component | New deleteMessage (redaction) primitive; sendFileMessage now passes roomId to the store. | Verify redaction uses client.redactEvent and attachment send still runs ensureSessionInBackup. |
| c3-113 | component | Timeline gains inline decrypt/preview, redacted rendering, and per-message delete with toast-action confirm. | Verify no native confirm and errors use the toast shape. |
| c3-1 | container | Signer route gains a delete op and room-scoped key construction/validation. | Verify roomId/objectKey are regex-validated against path traversal. |
| ref-client-only | ref | Blindness wording must reflect that the broker now sees roomId. | Updated in this ADR. |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-encrypted-attachments | Owns the attachment scheme; key layout and the blindness trade-off change here. | update-ref — room-scoped keys + accepted metadata exposure documented. |
| ref-client-only | The broker is still content-blind but no longer metadata-blind. | update-ref — narrow the guarantee to content-blind only. |
| ref-room-per-patient | Deletion is room semantics (redaction in the patient room); keys are namespaced by that room. | comply — redaction and keying both anchor to the patient room. |
| ref-key-gate | Upload stays key-gated; delete acts on existing events and needs no new gate. | comply — no change to the gate. |
| ref-matrix-js-sdk | c3-210 redaction and c3-1 stay behind the package; only matrix-client touches the SDK. | comply — redactEvent is wrapped in the package; web imports the namespace. |
| ref-recovery-key | c3-113 (affected) remains reachable only past recovery-key unlock; delete/preview run there. | comply — no change to the unlock precondition. |
| ref-toast-feedback | c3-113 surfaces delete/preview/integrity outcomes and the delete confirm as transient feedback. | comply — sonner toasts, including the toast-action confirm. |
| ref-pumped-fn-state | Attachment preview/delete state is local component state; no new reactive client state added. | N.A - no shared client state introduced by this change. |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-no-confirm | Delete needs a confirmation step. | comply — sonner toast action, not native confirm. |
| rule-no-direct-sdk-import | New web delete UI and signer must not import matrix-js-sdk. | comply — go through matrix-client; redaction is wrapped in the package. |
| rule-toast-error-shape | Delete/preview/integrity failures surface as errors. | comply — standard error toast. |
| rule-no-data-migration | Redaction and the new key layout add no migration of old records. | comply — old flat-key objects simply age out; no shim. |
| rule-key-gate-disable | c3-113 upload trigger stays gated on ready; delete acts on existing events. | comply — upload remains disabled when not ready; delete adds no new mutation gate. |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| message primitive | Add deleteMessage(client, roomId, eventId) calling client.redactEvent; export as matrixMessage.delete. | packages/matrix-client/src/features/message.messages.ts |
| store interface | AttachmentStore.upload takes roomId context; add remove(objectKey); EncryptedFile.url holds full key. | packages/matrix-client/src/types/attachment.ts |
| signer route | Build rooms/roomId/uuid; validate roomId and objectKey; add delete op (DeleteObjectCommand). | web/src/app/api/attachments/sign/route.ts |
| web store | Pass roomId on put/multipart-init; implement remove via delete op. | web/src/features/patient/s3-attachment-store.ts |
| timeline UI | Inline decrypt+preview (img/iframe), redacted bubble, per-message trash with toast-action confirm. | web/src/features/patient/patient-detail.tsx |
| env | Remove S3_PREFIX; rooms/ prefix is fixed in code. | web/.env.local.example |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - application + refs only | N.A - no c3x CLI, validator, schema, hint, or template changed | N.A - c3x check runs unchanged |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| Signer key validation | roomId and objectKey are regex-checked and rejected on bad shape or "..". | web/src/app/api/attachments/sign/route.ts |
| Redaction | client.redactEvent strips content room-wide; UI shows "Message deleted". | packages/matrix-client/src/features/message.messages.ts |
| Object cleanup | store.remove deletes the S3 object after redaction of a file message. | web/src/features/patient/s3-attachment-store.ts |
| Integrity on preview | fetchDecrypted verifies sha256 before rendering. | packages/matrix-client/src/features/attachment.messages.ts |
| c3x check | Validates the updated refs stay consistent with code. | c3x check |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Keep flat keys, hash the roomId for grouping | Stays metadata-blind but the operator explicitly chose readable room folders; hashing is offered in the ref as the fallback if correlation must be hidden. |
| Delete by sending a custom "deleted" marker event | Redaction is the native Matrix mechanism, enforced server-side and understood by every client; a marker is non-standard and leaves content on the server. |
| Leave S3 object on redaction | Orphans ciphertext indefinitely and grows cost; capturing the key and deleting is cheap and correct. |
| Native confirm dialog for delete | Violates rule-no-confirm; toast action is the project pattern. |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Path traversal via client-supplied key | roomId and objectKey are strictly regex-validated; uuid is server-issued; ".." rejected. | Send a crafted objectKey; signer returns 400. |
| Redaction succeeds but S3 delete fails | store.remove runs after redaction; a failure toasts an error and the object can be swept later by inventory. | Force a delete-op failure; confirm the message still shows deleted and an error toast appears. |
| Deleting others' messages | redactEvent requires power level; non-permitted redactions reject and toast. | Attempt to delete a peer's message without permission. |
| roomId now visible to broker | Documented, accepted trade-off; content/keys still never exposed. | Inspect signer payloads: only roomId/objectKey/size, never content or keys. |

## Verification

| Check | Result |
| --- | --- |
| npm run build -w web | Builds with the signer delete op and updated UI, no type errors. |
| npm run lint -w web | Clean (inline img suppressed with justification). |
| npx tsc --noEmit (matrix-client) | Passes. |
| C3X_MODE=agent c3x check | No issues across updated refs. |
| Manual delete round-trip | Deleting a file message redacts the event (shows "Message deleted") and the rooms/<roomId>/<uuid> object disappears from the bucket. |
