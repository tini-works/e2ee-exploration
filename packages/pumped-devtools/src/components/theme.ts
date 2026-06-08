/**
 * Theme tokens. These reference the host app's shadcn CSS variables (the panel
 * portals into <body>, under the themed <html>, so `var(--popover)` etc. resolve
 * and auto-adapt to light/dark). Hex fallbacks keep it readable in any app.
 */
export const T = {
  surface: "var(--popover, #171717)",
  card: "var(--card, #171717)",
  fg: "var(--foreground, #fafafa)",
  /** Softened body text for code/value previews. */
  code: "color-mix(in srgb, var(--foreground, #fafafa) 78%, transparent)",
  muted: "var(--muted-foreground, #a1a1a1)",
  faint: "color-mix(in srgb, var(--muted-foreground, #a1a1a1) 62%, transparent)",
  border: "var(--border, rgba(255,255,255,0.10))",
  primary: "var(--primary, #467ef7)",
  primaryFg: "var(--primary-foreground, #eff6ff)",
  danger: "var(--destructive, #ff6467)",
} as const;

/** A translucent tint of a color — used for soft pill/bubble backgrounds. */
export const soft = (color: string, pct = 16): string =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/**
 * Semantic hues the app palette doesn't define: settled / in-flight (atoms),
 * plus cyan (scopedValue state patches) and violet (action invocations).
 */
export const SEM = {
  green: "#34d399",
  amber: "#fbbf24",
  cyan: "#22d3ee",
  violet: "#a78bfa",
} as const;
