import { useState } from "react";
import type { AtomSnapshot } from "../types";
import { S } from "./styles";
import { StatePill } from "./state-pill";

/** Live list of atoms with lifecycle + value preview; click a row to expand. */
export function StateView({ atoms }: { atoms: AtomSnapshot[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (label: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <div style={S.scroll} className="pf-scroll">
      {atoms.map((a) => {
        const isOpen = expanded.has(a.label);
        return (
          <button
            type="button"
            key={a.label}
            onClick={() => toggle(a.label)}
            style={S.atomRow}
            className="pf-row"
          >
            <div style={S.atomTop}>
              <span style={S.atomName}>{a.label}</span>
              <StatePill state={a.state} />
              {a.changes > 0 && <span style={S.changeChip}>×{a.changes}</span>}
            </div>
            <code style={{ ...S.atomValue, ...(isOpen ? S.atomValueOpen : null) }}>
              {a.value}
            </code>
          </button>
        );
      })}
    </div>
  );
}
