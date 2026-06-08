/** Free-form panel dimensions, set by dragging the corner and persisted. */
export interface PanelSize {
  width: number;
  height: number;
}

export const DEFAULT_SIZE: PanelSize = { width: 384, height: 560 };

export const MIN_SIZE: PanelSize = { width: 280, height: 320 };

export type DevtoolsSide = "left" | "right";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Clamp a candidate size to the min and the current viewport. */
export function clampSize({ width, height }: PanelSize): PanelSize {
  const maxW = typeof window === "undefined" ? Infinity : window.innerWidth - 40;
  const maxH = typeof window === "undefined" ? Infinity : window.innerHeight - 120;
  return {
    width: clamp(width, MIN_SIZE.width, Math.max(MIN_SIZE.width, maxW)),
    height: clamp(height, MIN_SIZE.height, Math.max(MIN_SIZE.height, maxH)),
  };
}
