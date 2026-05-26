---
id: rule-no-data-migration
c3-seal: 9a2b3c2b607b17a9675e009a9fd6e958c8578eade79c35718b72fe7441e8574d
title: no-data-migration
type: rule
goal: 'Reflect the AGENTS.md constraint: while the product is in pre-1.0 feature development, schema changes do not need backwards-compatible migrations. Records can be deleted and re-created from scratch when shapes change.'
---

## Goal

Reflect the AGENTS.md constraint: while the product is in pre-1.0 feature development, schema changes do not need backwards-compatible migrations. Records can be deleted and re-created from scratch when shapes change.

## Rule

Schema changes to patient records, status-bar state, or other persisted shapes do not ship migration code. When a shape changes, delete existing records (or have the user wipe local data) and start fresh.

## Golden Example

```ts
// packages/matrix-client/src/patients.ts — current record shape
export const PATIENT_RECORD = "com.matrix-app.patient.record";

export type PatientRecord = {
  firstName: string;          // REQUIRED
  lastName: string;           // REQUIRED
  dob: string;                // REQUIRED, ISO yyyy-mm-dd
  updatedTimes: number;       // REQUIRED, monotonic from createPatient
};
// No version field, no migration helpers — shape evolves directly.
// When fields change: delete the room, recreate the patient.
```

```ts
// packages/matrix-client/src/wipe.ts — the escape hatch when shapes drift
export async function wipeLocalMatrixData() {
  // Used at sign-out and after schema changes to clear IndexedDB + localStorage
}
```

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| Adding version: 1 then migrateRecord(v0, v1) | Change the shape; delete affected rooms | We're pre-1.0; the cost of migration code outweighs the cost of starting fresh |
| if (!record.dob) record.dob = "" (compat shim) | Treat the malformed record as deletable test data | Shims accumulate and silently mask shape drift |
| Storing two competing record shapes "for now" | Pick one and rewrite | Dual-write code lives forever; pick the new shape and move on |

## Scope

Applies to all persisted shapes while the project is pre-1.0:

- Patient records (`com.matrix-app.patient.record`)
- Profile thread state events
- `StoredSession` in `localStorage`
- Status-bar local UI state

When the product reaches 1.0, this rule is revoked and a new ADR introduces a versioning policy.

## Override

If a specific user-visible field absolutely cannot be wiped (e.g., a per-user setting they configured), wrap the read in `try/catch` returning the new default; do not add a migration helper.
