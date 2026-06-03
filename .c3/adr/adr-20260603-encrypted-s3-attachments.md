---
id: adr-20260603-encrypted-s3-attachments
c3-seal: c565cb9ecd52829ae74d8e5f9ecfd9798d719a12398ca27e8781da44bb489876
title: encrypted-s3-attachments
type: adr
goal: 'Add the ability to attach a file to a patient room: the browser encrypts the file with Matrix''s `EncryptedFile` (v2, AES-CTR-256 + ciphertext SHA-256) scheme, streams/chunks the ciphertext to S3 via presigned URLs minted by a new blind signer endpoint, and records the file''s decryption key plus an opaque S3 object id inside a megolm-encrypted `m.room.message` (`m.file`) event. This authorizes (a) introducing one server-side trust boundary that only ever sees ciphertext and opaque object keys, and (b) the rule that S3 location is treated as encrypted content, never plaintext state.'
status: accepted
date: "2026-06-03"
---

## Goal

Add the ability to attach a file to a patient room: the browser encrypts the file with Matrix's `EncryptedFile` (v2, AES-CTR-256 + ciphertext SHA-256) scheme, streams/chunks the ciphertext to S3 via presigned URLs minted by a new blind signer endpoint, and records the file's decryption key plus an opaque S3 object id inside a megolm-encrypted `m.room.message` (`m.file`) event. This authorizes (a) introducing one server-side trust boundary that only ever sees ciphertext and opaque object keys, and (b) the rule that S3 location is treated as encrypted content, never plaintext state.

## Context

Today `c3-210 patients-domain` only sends text via `sendMessage` (`m.text`) into the per-patient encrypted room (`ref-room-per-patient`), and `c3-113 patient-detail` renders that encrypted timeline. There is no file path. The hard constraint set: the homeserver must stay blind to content (`ref-room-per-patient`), and `ref-client-only` currently states the homeserver is the *only* server. Presigning an S3 URL requires AWS credentials, which forces a server-side component — directly pressuring `ref-client-only`. The affected topology is the `matrix-client` container (new encrypt/chunk/upload feature), `c3-210` (attachment send/fetch primitives), `c3-113` (upload UI + decrypt + diagnostics), and the `web` container (which must now host one server-side API route for signing). matrix-js-sdk already defines the `EncryptedFile` shape (`node_modules/matrix-js-sdk/lib/@types/media.d.ts`), so the scheme is not invented here.

## Decision

Reuse the Matrix `EncryptedFile` v2 scheme unchanged (random 256-bit AES key + IV, AES-CTR-256 via `crypto.subtle`, SHA-256 over ciphertext), and change only *where the ciphertext bytes live*: S3 instead of the Matrix media repo. The decryption key, IV, hashes, and a **stable opaque S3 object id** (never a presigned URL) are stored in the `file` field of a megolm-encrypted `m.file` event, so the homeserver sees only ciphertext and the key is shared exactly with invited devices via existing megolm machinery. Presigning is delegated to a **blind signer endpoint** in `web` (Next.js route handler) that holds scoped S3 credentials but only ever receives/returns opaque object keys + content-length — never event content, room id, or the decryption key. AES-CTR's stream nature drives chunked encryption; large ciphertext uses S3 multipart (one presigned PUT per part). This wins over the alternatives because it preserves the homeserver-blind guarantee, keeps the key inside the same E2EE envelope as every other patient datum, and confines the unavoidable AWS-credential surface to a provably content-blind broker.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-2 | container | Gains a new attachment feature module (encrypt, chunk, sha256, upload orchestration, fetch+verify+decrypt). | Confirm new module sits behind the package boundary and is re-exported as a namespaced subpath. |
| c3-210 | component | Gains sendFileMessage / attachment-fetch primitives alongside sendMessage; attachments are events in the patient room. | Verify attachment events are m.room.message in the same room and ensureSessionInBackup runs after send. |
| c3-113 | component | Adds file picker, upload progress, m.file rendering, download+decrypt, and integrity/UTD diagnostics. | Verify upload trigger respects the key-gate and diagnostics follow the existing UTD pattern. |
| c3-1 | container | Must host one server-side API route (the blind signer) holding S3 creds — a new server boundary. | Verify the route receives only opaque object keys + length, never plaintext/key/room id. |
| ref-client-only | ref | Its "homeserver is the only server" invariant is amended to permit a content-blind media broker. | Update the ref to scope the new boundary precisely. |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-client-only | The blind signer is a server-side component; the ref currently forbids any app-server. | update-ref — narrow the invariant to "homeserver + content-blind media broker; no server ever sees plaintext or keys". |
| ref-room-per-patient | Attachments must be events inside the patient's encrypted room, not a side channel. | comply — m.file event in the same room, key carried in megolm envelope. |
| ref-matrix-js-sdk | All SDK/crypto use stays inside matrix-client; web reaches it through the package. | comply — encrypt/chunk/upload live in matrix-client; web imports the namespace. |
| ref-key-gate | File upload is a feature mutation and must be unreachable until the recovery key is proven. | comply — upload trigger reads ready. |
| ref-recovery-key | c3-113 (affected) is key-gated on a proven recovery key; uploads encrypt against the session the user must be able to decrypt later. | comply — no behavior change; upload is reachable only past the recovery-key unlock. |
| ref-toast-feedback | c3-1 / c3-113 (affected) surface upload, decrypt, and integrity outcomes as transient feedback. | comply — success/error reported via the standard toast surface, not native dialogs. |
| ref-pumped-fn-state | Upload progress and attachment-fetch status are new reactive client state read by c3-113. | comply — keep any reactive state in the established pumped-fn scope, not ad-hoc React state. |
| ref-encrypted-attachments | The encryption + S3-id storage scheme is a new cross-cutting pattern other code must follow. | create-ref — author at ADR acceptance. |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-no-direct-sdk-import | The new web upload UI and signer must not import matrix-js-sdk directly. | comply — go through matrix-client. |
| rule-key-gate-disable | The upload control is a feature-level mutation trigger. | comply — disabled while !ready. |
| rule-no-confirm | Upload/overwrite/error flows must use toast or custom modal, never native confirm. | comply. |
| rule-toast-error-shape | Upload/decrypt/integrity failures surface as errors. | comply — use the standard error-toast shape. |
| rule-no-data-migration | The m.file event shape is new; no back-compat shims for prior records. | comply — additive event type, no migration. |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| matrix-client feature | New packages/matrix-client/src/features/attachment.ts: encryptFile (streamed AES-CTR-256 + running SHA-256 → {ciphertext stream, EncryptedFile}), chunked upload orchestration (single PUT or multipart), sendFileMessage(client, roomId, file), fetchAndDecryptFile(client, encryptedFile) (presigned GET → verify sha256 → decrypt). | packages/matrix-client/src/features/message.messages.ts (pattern to mirror) |
| matrix-client export | Add matrixAttachment namespace + subpath export, mirroring matrixMessage. | packages/matrix-client/src/features/message.ts, src/index.ts |
| web signer route | New Next.js route handler web/src/app/api/attachments/sign/route.ts: input is an op (put / get / multipart) plus objectKey, optional contentLength and part count → presigned URL(s); holds S3 creds via env; rejects any payload field other than the opaque key + length. | web/src/app/ (App Router) |
| web upload UI | Extend web/src/features/patient/patient-detail.tsx: file input (key-gated), progress, m.file rendering, download→decrypt, integrity/UTD diagnostics. | web/src/features/patient/patient-detail.tsx |
| config | S3 bucket name, region, prefix, presign TTL, and signer creds via env; document in clinic config / env. | web/src/lib/config.ts |
| docs | Create ref-encrypted-attachments; update ref-client-only; cascade-update affected component docs. | c3x add ref / c3x set / c3x write |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - this ADR changes application code and project refs/rules only | N.A - no c3x CLI command, validator, schema, hint, or template is modified | N.A - c3x check runs unchanged against the new entities |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| Ciphertext SHA-256 verify on download | fetchAndDecryptFile recomputes hash and refuses to decrypt on mismatch, surfacing a diagnostic. | packages/matrix-client/src/features/attachment.ts |
| rule-key-gate-disable | Upload control disabled when ready is false. | web/src/features/patient/patient-detail.tsx |
| Signer payload allowlist | Route rejects any body field beyond {op, objectKey, contentLength, parts}; returns 400 otherwise. | web/src/app/api/attachments/sign/route.ts |
| Type contract | EncryptedFile type from matrix-js-sdk enforces the stored shape at compile time. | node_modules/matrix-js-sdk/lib/@types/media.d.ts |
| c3x check | Validates the new/updated entities and refs stay consistent with code. | c3x check |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Matrix media repo (mxc://) via client.uploadContent | Preserves ref-client-only with zero new servers, but the requested feature is explicitly S3-backed offload; rejected by the trust-boundary decision. |
| Direct client STS/Cognito credentials (no app server) | Leaks bucket/prefix structure to the browser and is harder to lock down (token scoping, refresh) than a single blind signer; more attack surface in untrusted client code. |
| Custom per-chunk AES-GCM scheme | Reinvents the already-reviewed Matrix EncryptedFile v2; AES-CTR already streams cleanly for chunking, so GCM adds complexity with no integrity benefit (we hash ciphertext anyway). |
| Store the S3 object id in plaintext app state / a DB | Breaks the homeserver-blind model and leaks object locations; the id must ride inside the megolm-encrypted event. |
| Store a presigned URL in the event | Presigned URLs expire; the event is permanent. Store a stable opaque id and mint presigned GET on demand. |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Signer becomes a plaintext/key oracle | Signer receives only opaque object key + content-length; key + filename live solely in the megolm event. | Code-review the route payload; assert no event content/key/room id is ever sent to it. |
| Ciphertext tamper / partial upload corruption | Verify ciphertext SHA-256 before decrypt; surface a precise diagnostic instead of silent failure (AGENTS.md). | Flip a byte in the S3 object; confirm UI shows an integrity error, not a blank/garbled file. |
| Large-file OOM in browser | Streamed chunked AES-CTR + S3 multipart; never buffer the whole file. | Upload a >100 MB file; observe bounded memory and a successful round-trip. |
| Attachment UTD (megolm key not shared) | Same path as text: ensureSessionInBackup after send + peer-key-share recovery; diagnostic shows missing-key vs integrity. | Two devices, force a UTD on the attachment event; confirm diagnostic + recovery. |
| Orphaned S3 objects when event send fails after upload | Upload then send; on send failure best-effort delete the object; S3 lifecycle rule GCs unreferenced keys. | Simulate send failure after upload; confirm no permanently dangling object. |
| Signer credential leak / over-broad IAM | IAM scoped to one bucket + prefix, short presign TTL, creds server-only env. | Review the IAM policy and env handling; presigned URL expiry observed. |

## Verification

| Check | Result |
| --- | --- |
| npm run build | Typechecks the attachment module, signer route, and EncryptedFile usage with no errors. |
| npm run lint | Passes with no new violations in the changed files. |
| C3X_MODE=agent c3x check | No issues across the new/updated entities and refs. |
| Manual two-device round-trip (docker homeserver) | Upload a file in patient-detail on device A; device B downloads, verifies sha256, and decrypts to the original bytes. |
| Manual tamper test | Editing one byte of the S3 object yields an integrity diagnostic, never a silent corrupt download. |
