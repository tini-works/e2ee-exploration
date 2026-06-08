import { useState } from "react";
import type { FormSnapshot } from "../types";
import { S } from "./styles";
import { IconChatDots } from "./icons";

/**
 * Live list of scopedValues (forms) with their current state, change count, and
 * observed action invocations; click a row to expand the full state object.
 */
export function FormsView({ forms }: { forms: FormSnapshot[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (label: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  if (forms.length === 0) {
    return (
      <div style={S.empty}>
        <div style={{ marginBottom: 10, color: "var(--muted-foreground, #a1a1a1)" }}>
          <IconChatDots size={36} />
        </div>
        No scopedValues registered.
        <div style={S.emptyHint}>
          Pass a <code>scopedValues</code> map to watch form state &amp; actions.
        </div>
      </div>
    );
  }

  // Most recently active first, but keep disposed forms at the bottom.
  const sorted = [...forms].sort(
    (a, b) => Number(a.disposed) - Number(b.disposed) || b.updatedAt - a.updatedAt,
  );

  return (
    <div style={S.scroll} className="pf-scroll">
      {sorted.map((f) => {
        const isOpen = expanded.has(f.label);
        return (
          <button
            type="button"
            key={f.label}
            onClick={() => toggle(f.label)}
            style={S.atomRow}
            className="pf-row"
          >
            <div style={S.atomTop}>
              <span style={S.atomName}>{f.label}</span>
              {f.disposed && <span style={S.disposedChip}>disposed</span>}
              {f.changes > 0 && <span style={S.changeChip}>×{f.changes}</span>}
              {f.actions > 0 && <span style={S.actionChip}>⚡{f.actions}</span>}
            </div>
            <code style={{ ...S.atomValue, ...(isOpen ? S.atomValueOpen : null) }}>
              {f.value}
            </code>
          </button>
        );
      })}
    </div>
  );
}
