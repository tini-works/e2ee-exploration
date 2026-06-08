/** UI size presets for the panel. Cycled from the header, seeded by a prop. */
export type DevtoolsSize = "sm" | "md" | "lg";

export const SIZES: Record<DevtoolsSize, { width: number; height: number; label: string }> = {
  sm: { width: 320, height: 440, label: "S" },
  md: { width: 384, height: 560, label: "M" },
  lg: { width: 460, height: 680, label: "L" },
};

export const SIZE_ORDER: DevtoolsSize[] = ["sm", "md", "lg"];

export type DevtoolsSide = "left" | "right";

/** Next value when cycling the size button. */
export function nextSize(size: DevtoolsSize): DevtoolsSize {
  const i = SIZE_ORDER.indexOf(size);
  return SIZE_ORDER[(i + 1) % SIZE_ORDER.length];
}
