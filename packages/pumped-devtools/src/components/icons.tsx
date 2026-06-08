/** Inline SVG icons — no icon-library dependency. */

const ico = {
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconBubble = () => (
  <svg viewBox="0 0 24 24" {...ico} width={20} height={20}>
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
  </svg>
);

export const IconChevron = () => (
  <svg viewBox="0 0 24 24" {...ico}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconClose = () => (
  <svg viewBox="0 0 24 24" {...ico}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const IconTrash = () => (
  <svg viewBox="0 0 24 24" {...ico}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);

/**
 * Dock-to-side affordance: an arrow pointing at the edge the panel will move
 * to, plus the edge bar. Far clearer than a plain ⇄.
 */
export const IconDock = ({ to }: { to: "left" | "right" }) => {
  const arrow = to === "right" ? "M3 12h10M9 8l4 4-4 4" : "M21 12H11M15 8l-4 4 4 4";
  const bar = to === "right" ? "M21 5v14" : "M3 5v14";
  return (
    <svg viewBox="0 0 24 24" {...ico} width={15} height={15}>
      <path d={arrow} />
      <path d={bar} />
    </svg>
  );
};

/** Cycle UI size. */
export const IconResize = () => (
  <svg viewBox="0 0 24 24" {...ico}>
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

/**
 * Filled speech bubble with a typing-style "…", for the empty Flow state.
 * Dots are punched out in the panel background color so it reads on dark.
 */
export const IconChatDots = ({ size = 34, dot = "var(--popover, #171717)" }: { size?: number; dot?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M5 3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H10.5l-4.2 3.6A1 1 0 0 1 4.7 20v-3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
    <circle cx="8.5" cy="10" r="1.35" fill={dot} />
    <circle cx="12" cy="10" r="1.35" fill={dot} />
    <circle cx="15.5" cy="10" r="1.35" fill={dot} />
  </svg>
);
