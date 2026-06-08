import type { PointerEvent as ReactPointerEvent } from "react";
import type { AtomSnapshot, FeedEvent, FormSnapshot } from "../types";
import { S } from "./styles";
import { type DevtoolsSide, type PanelSize } from "./sizes";
import { IconButton } from "./icon-button";
import { TabButton } from "./tab-button";
import { StateView } from "./state-view";
import { FormsView } from "./forms-view";
import { FlowView } from "./flow-view";
import { IconClose, IconDock, IconTrash } from "./icons";

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
  onResize,
}: {
  side: DevtoolsSide;
  size: PanelSize;
  tab: Tab;
  atoms: AtomSnapshot[];
  forms: FormSnapshot[];
  events: FeedEvent[];
  onTab: (t: Tab) => void;
  onClear: () => void;
  onClose: () => void;
  onSwapSide: () => void;
  onResize: (next: PanelSize) => void;
}) {
  const changed = atoms.filter((a) => a.changes > 0).length;
  const hasForms = forms.length > 0;
  const target: DevtoolsSide = side === "left" ? "right" : "left";
  return (
    <div style={{ ...S.panel, width: size.width, height: size.height }} className="pf-pop">
      <ResizeHandle side={side} size={size} onResize={onResize} />
      <header style={S.header}>
        <div style={{ minWidth: 0 }}>
          <div style={S.title}>Inspector</div>
          <div style={S.subtitle}>
            {atoms.length} atoms | {changed} changed
            {hasForms && ` | ${forms.length} forms`} | {events.length} events
          </div>
        </div>
        <div style={{ flex: 1 }} />
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

/**
 * Corner grip that resizes the panel by dragging. The panel is anchored at its
 * bottom (near the FAB) and its dock side, so the free corner is the top-outer
 * one: top-right when docked left, top-left when docked right. Dragging it
 * outward/upward grows the panel; the new size is clamped + persisted upstream.
 */
function ResizeHandle({
  side,
  size,
  onResize,
}: {
  side: DevtoolsSide;
  size: PanelSize;
  onResize: (next: PanelSize) => void;
}) {
  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      onResize({
        width: side === "left" ? startW + dx : startW - dx,
        height: startH - dy,
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <button
      type="button"
      title="Drag to resize"
      onPointerDown={onPointerDown}
      style={{
        ...S.resizeHandle,
        ...(side === "left"
          ? { right: 0, cursor: "nesw-resize" }
          : { left: 0, cursor: "nwse-resize" }),
      }}
    />
  );
}
