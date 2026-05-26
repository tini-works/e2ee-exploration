---
name: sync-diagrams
description: Review the matrix-client package and how the web app consumes it, then update the mermaid diagrams in README.md and packages/matrix-client/README.md to match the current code. Skips diagrams that are still accurate. Use when the user invokes /sync-diagrams or asks to refresh the architecture diagrams.
---

# sync-diagrams

Keep the mermaid diagrams in the two README files in sync with the code. Reviews recent changes to `packages/matrix-client/` and how `web/` consumes it, then updates only the diagrams that actually drifted.

## Inputs

- `packages/matrix-client/src/**/*` — the package source of truth
- `web/src/**/*` — every call site that uses `matrix-client`, `matrix-client/react`, `matrix-client/patients`
- `README.md` — root architecture diagrams (system flowchart + sign-in / unlock / create-patient sequences)
- `packages/matrix-client/README.md` — package-internal diagrams (layer graph, bootstrap sequence, unlock sequence, room-as-records, MatrixProvider state machine)

## Diagram inventory

These are the diagrams that exist today. When reviewing, decide for each whether it still matches the code; only edit the ones that drifted.

### Root `README.md`

1. **System architecture flowchart** — Clinic/Patient POVs, `MatrixProvider` gate (sign-in → recovery key → ready), `matrix-js-sdk` crypto, Clinic features (Patient CRUD, message, invite), Patient features (view clinics, read msg, accept/decline), Synapse zone.
2. **Sign-in sequence** — `web/sign-in.tsx` → `MatrixProvider` → `client.ts` → `matrix-js-sdk` → Synapse, ending in `notReadyReason=needs_recovery_key`.
3. **Unlock recovery key sequence** — `web/status-bar.tsx` → `secret-storage.ts` → SDK crypto-api → Synapse, plus `markKeyUnlocked()` callback.
4. **Create patient sequence** — `web/patient-form.tsx` → `useMatrix` → `patients.ts` → SDK → Synapse, including megolm priming and key-backup drain.
5. **TI-Messenger reference (German + English translation)** — external reference. **Never** edit unless gematik publishes a new revision.

### `packages/matrix-client/README.md`

1. **Layer graph** — maps wrapper exports to SDK primitives.
2. **Bootstrap sequence** — internals of `createMatrixClient`.
3. **Recovery-key unlock sequence** — internals of `unlockWithSecurityKey`.
4. **Patient room data model** — room contents (tag, encryption, profile-thread state, root + thread replies, chat messages).
5. **`MatrixProvider` state machine** — `initializing → connecting → ready { needs_recovery_key → unlocked }`, plus signOut path.

## Style invariants (must preserve)

All package-README diagrams use this theme — keep it when editing:

- Background `#ffffff`, text `#000000`, edges `#ec4899` (pink)
- Node border colors by semantic role:
  - Orange `#f59e0b` — `matrix-client` wrapper entry points / UI-facing
  - Cyan `#06b6d4` — React layer / domain helpers / generic events
  - Purple `#a855f7` — `matrix-js-sdk` primitives / external / crypto
  - Green `#10b981` — domain record events (patient.record)
- Stadium-shape nodes `(["…"])` for rounded corners
- Avoid `()`, `{}`, `←`, `→` glyphs inside `[…]` labels — GitHub's mermaid renderer chokes on them. Pipe-label edges `A -.->|label| B` are safe for dotted labels.

The root `README.md` uses a different palette (the C3-style classDef system); keep its existing `classDef` block intact when editing.

## Procedure

1. **Survey the package surface** — list every export from `packages/matrix-client/src/index.ts`, `src/react/index.ts`, `src/patients.ts`. Note new/removed/renamed exports vs. what each diagram shows.
2. **Survey the web call sites** — grep `web/src` for imports from `matrix-client*`. For each call site, note which package function it calls and in which UI surface (sign-in, status bar, patient form, invites list, etc.).
3. **For each diagram, decide drift**:
   - New export not shown anywhere → add to layer graph (pkg #1) and, if it's user-facing, to the relevant root sequence.
   - Renamed export → rename in every diagram that mentions it (search both README files).
   - Removed export → delete from diagrams.
   - Changed internal call order in `createMatrixClient` / `unlockWithSecurityKey` / `createPatient` → update the sequence steps.
   - New event type or state-event key in `patients.ts` → update the patient-room data model graph.
   - New status / state added to `MatrixProvider` → update the state machine.
   - No change → **skip**. Do not touch diagrams that still match the code.
4. **Verify mermaid syntax** — every edited diagram must keep the style invariants above and avoid the forbidden glyphs. Read the file back is not required (Edit will error on bad strings), but mentally trace each edited edge.
5. **Report what changed** — at the end, list each diagram you touched and why, plus the ones you left alone. Use this format:

   ```
   Updated:
   - <file>:<section> — <one-line reason>
   Skipped (still accurate):
   - <file>:<section>
   ```

## When to skip the whole skill

If `git log -- packages/matrix-client/src web/src` shows no commits since the last diagram edit, or if a diff against the package source surfaces only cosmetic changes (formatting, comments, internal helpers that don't change the public API or call order), say so and exit without editing.

## Do not

- Do not commit or push. The user will review the diff first.
- Do not edit the TI-Messenger reference diagrams.
- Do not rewrite diagrams that still match the code just to "improve" them — drift fixes only.
- Do not invent exports or call sites; if something is ambiguous, ask the user.
