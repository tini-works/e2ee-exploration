"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Lite } from "@pumped-fn/lite";
import { usePumpedFeed } from "./use-pumped-feed";
import { usePersistedState } from "./use-persisted-state";
import type { AtomRegistry } from "./types";
import { S } from "./components/styles";
import { StyleOnce } from "./components/style-once";
import { Fab } from "./components/fab";
import { Panel, type Tab } from "./components/panel";
import {
  nextSize,
  SIZE_ORDER,
  type DevtoolsSide,
  type DevtoolsSize,
} from "./components/sizes";

const decodeSide = (raw: string): DevtoolsSide | undefined =>
  raw === "left" || raw === "right" ? raw : undefined;
const decodeSize = (raw: string): DevtoolsSize | undefined =>
  (SIZE_ORDER as string[]).includes(raw) ? (raw as DevtoolsSize) : undefined;

export interface PumpedDevtoolsProps {
  /** label -> atom map to watch. Atoms are nameless, so labels come from here. */
  atoms: AtomRegistry;
  /** Heading shown in the panel. Default "pumped-fn". */
  title?: string;
  /** Bottom corner to dock to initially (toggle live from the header). Default "left". */
  side?: DevtoolsSide;
  /** Initial UI size (cycle live from the header). Default "md". */
  size?: DevtoolsSize;
  /** Flow ring-buffer size. Default 250. */
  maxEvents?: number;
  /** Start expanded. Default false. */
  defaultOpen?: boolean;
  /** Override the scope (otherwise read from ScopeProvider context). */
  scope?: Lite.Scope;
}

/**
 * A floating chat-bubble inspector for a pumped-fn scope. Drop it anywhere
 * inside a `ScopeProvider`. Collapsed it's a round button; expanded it's a big
 * speech bubble with a live State view and a Flow (chat) feed. Position and
 * size are adjustable from the header and seeded by the `side`/`size` props.
 */
export function PumpedDevtools({
  atoms,
  title = "pumped-fn",
  side: initialSide = "left",
  size: initialSize = "md",
  maxEvents,
  defaultOpen = false,
  scope,
}: PumpedDevtoolsProps) {
  const { state, clear } = usePumpedFeed(atoms, { maxEvents, scope });
  const [tab, setTab] = useState<Tab>("flow");
  // Open/closed, position + size all persist across reloads, scoped to title.
  const [openRaw, setOpenRaw] = usePersistedState<"1" | "0">(
    `pumped-devtools:${title}:open`,
    defaultOpen ? "1" : "0",
    (raw) => (raw === "1" || raw === "0" ? raw : undefined),
  );
  const open = openRaw === "1";
  const setOpen = (next: boolean) => setOpenRaw(next ? "1" : "0");
  const [side, setSide] = usePersistedState<DevtoolsSide>(
    `pumped-devtools:${title}:side`,
    initialSide,
    decodeSide,
  );
  const [size, setSize] = usePersistedState<DevtoolsSize>(
    `pumped-devtools:${title}:size`,
    initialSize,
    decodeSize,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // No scope in context yet (provider still priming) → render nothing.
  if (!mounted || !state) return null;

  const dock: CSSProperties =
    side === "left"
      ? { left: 20, alignItems: "flex-start" }
      : { right: 20, alignItems: "flex-end" };

  return createPortal(
    <>
      <StyleOnce />
      <div style={{ ...S.root, ...dock }}>
        {open && (
          <Panel
            title={title}
            side={side}
            size={size}
            tab={tab}
            atoms={state.atoms}
            events={state.events}
            onTab={setTab}
            onClear={clear}
            onClose={() => setOpen(false)}
            onSwapSide={() => setSide(side === "left" ? "right" : "left")}
            onCycleSize={() => setSize(nextSize(size))}
          />
        )}
        <Fab open={open} changes={state.totalChanges} onClick={() => setOpen(!open)} />
      </div>
    </>,
    document.body,
  );
}
