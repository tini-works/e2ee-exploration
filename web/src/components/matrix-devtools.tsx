"use client";

import { PumpedDevtools } from "pumped-devtools";
import { matrixAtoms } from "matrix-client/state";
import { formScopedValues } from "@/features/forms-registry";

/**
 * Dev-only pumped-fn inspector for the Matrix state graph. Mounted inside
 * MatrixProvider (so it sees the global scope) in the root layout. The chat
 * bubble docks bottom-left; open it to watch atoms change and the readiness
 * gate re-resolve as you sign in / unlock the recovery key. The Forms tab
 * tracks each scopedValue's state + action invocations.
 */
export function MatrixDevtools() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <PumpedDevtools
      atoms={matrixAtoms}
      scopedValues={formScopedValues}
      title="matrix"
    />
  );
}
