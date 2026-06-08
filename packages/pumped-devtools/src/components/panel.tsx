import type { AtomSnapshot, FeedEvent, FormSnapshot } from "../types";
import { S } from "./styles";
import { SIZES, type DevtoolsSide, type DevtoolsSize } from "./sizes";
import { IconButton } from "./icon-button";
import { TabButton } from "./tab-button";
import { StateView } from "./state-view";
import { FormsView } from "./forms-view";
import { FlowView } from "./flow-view";
import { IconClose, IconDock, IconResize, IconTrash } from "./icons";

export type Tab = "state" | "forms" | "flow";

/** The expanded speech-bubble: header controls, tabs, and the active view. */
export function Panel({
  side,
  size,
  tab,
  atoms,
  forms,
  events,
  onTab,
  onClear,
  onClose,
  onSwapSide,
  onCycleSize,
}: {
  side: DevtoolsSide;
  size: DevtoolsSize;
  tab: Tab;
  atoms: AtomSnapshot[];
  forms: FormSnapshot[];
  events: FeedEvent[];
  onTab: (t: Tab) => void;
  onClear: () => void;
  onClose: () => void;
  onSwapSide: () => void;
  onCycleSize: () => void;
}) {
  const dims = SIZES[size];
  const changed = atoms.filter((a) => a.changes > 0).length;
  const hasForms = forms.length > 0;
  const target: DevtoolsSide = side === "left" ? "right" : "left";
  return (
    <div style={{ ...S.panel, width: dims.width, height: dims.height }} className="pf-pop">
      <header style={S.header}>
        <div style={{ minWidth: 0 }}>
          <div style={S.title}>Inspector</div>
          <div style={S.subtitle}>
            {atoms.length} atoms · {changed} changed
            {hasForms && ` · ${forms.length} forms`} · {events.length} events
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <IconButton title={`Size: ${dims.label} (click to cycle)`} onClick={onCycleSize}>
          <IconResize />
        </IconButton>
        <IconButton title={`Dock ${target}`} onClick={onSwapSide}>
          <span style={{ display: "flex", alignItems: "center", gap: 1, fontSize: 10, fontWeight: 800 }}>
            <IconDock to={target} />
            {target === "right" ? "R" : "L"}
          </span>
        </IconButton>
        <IconButton title="Clear flow" onClick={onClear}>
          <IconTrash />
        </IconButton>
        <IconButton title="Minimize" onClick={onClose}>
          <IconClose />
        </IconButton>
      </header>

      <nav style={S.tabs}>
        <TabButton active={tab === "state"} onClick={() => onTab("state")}>
          State
        </TabButton>
        <TabButton active={tab === "forms"} onClick={() => onTab("forms")}>
          Forms
        </TabButton>
        <TabButton active={tab === "flow"} onClick={() => onTab("flow")}>
          Flow
        </TabButton>
      </nav>

      <div style={S.body}>
        {tab === "state" ? (
          <StateView atoms={atoms} />
        ) : tab === "forms" ? (
          <FormsView forms={forms} />
        ) : (
          <FlowView events={events} />
        )}
      </div>

      <div style={{ ...S.tail, ...(side === "left" ? { left: 24 } : { right: 24 }) }} />
    </div>
  );
}
