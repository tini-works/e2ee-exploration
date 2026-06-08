---
version: alpha
name: Patient-Records-design-analysis
description: The design language of the Patient Records app — an E2E-encrypted clinical records client built on shadcn/ui (the "base-nova" style, neutral base color, Lucide-equivalent SVG icons). A calm, clinical neutral-gray system with a single confident blue primary, built dark-mode-first via OKLCH design tokens. Surfaces are flat and hairline-bordered, radii are medium-soft, typography is the system sans stack at a 14px root with weight-600 headings, and the whole palette is expressed as CSS custom properties so light and dark are one token set with two value maps.
colors:
  primary: "#2563eb"
  primary-foreground: "#f7fafd"
  background: "#ffffff"
  foreground: "#0a0a0a"
  card: "#ffffff"
  card-foreground: "#0a0a0a"
  popover: "#ffffff"
  secondary: "#f7f7f7"
  secondary-foreground: "#171717"
  muted: "#f7f7f7"
  muted-foreground: "#737373"
  accent: "#eff5fd"
  accent-foreground: "#1c47a6"
  destructive: "#e7000b"
  border: "#e5e5e5"
  input: "#e5e5e5"
  ring: "#2563eb"
  sidebar: "#fbfcfd"
  sidebar-accent: "#eff5fd"
colors-dark:
  primary: "#467ef7"
  primary-foreground: "#eff6ff"
  background: "#0a0a0a"
  foreground: "#fafafa"
  card: "#171717"
  popover: "#171717"
  secondary: "#262626"
  muted: "#262626"
  muted-foreground: "#a1a1a1"
  accent: "#202938"
  accent-foreground: "#dbe9fc"
  destructive: "#ff6467"
  border: "rgba(255,255,255,0.10)"
  input: "rgba(255,255,255,0.15)"
  ring: "#467ef7"
typography:
  h1:
    fontFamily: "{font.sans}"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.25
  h2:
    fontFamily: "{font.sans}"
    fontSize: 21px
    fontWeight: 600
    lineHeight: 1.25
  h3:
    fontFamily: "{font.sans}"
    fontSize: 17.5px
    fontWeight: 600
    lineHeight: 1.25
  h4:
    fontFamily: "{font.sans}"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.25
  h5:
    fontFamily: "{font.sans}"
    fontSize: 12.25px
    fontWeight: 600
    lineHeight: 1.25
  h6:
    fontFamily: "{font.sans}"
    fontSize: 11.9px
    fontWeight: 600
    lineHeight: 1.25
    color: "{colors.muted-foreground}"
  body:
    fontFamily: "{font.sans}"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  code:
    fontFamily: "{font.mono}"
    fontSize: 11.9px
    fontWeight: 400
    lineHeight: 1.5
font:
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'"
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
  rootFontSize: 14px
rounded:
  base: 0.625rem   # ~8.75px @ 14px root  (--radius)
  sm: calc(var(--radius) * 0.6)   # ~5.25px
  md: calc(var(--radius) * 0.8)   # ~7px
  lg: var(--radius)               # ~8.75px
  xl: calc(var(--radius) * 1.4)   # ~12.25px
  2xl: calc(var(--radius) * 1.8)  # ~15.75px
  3xl: calc(var(--radius) * 2.2)  # ~19.25px
  pill: 9999px
spacing:
  note: "Tailwind v4 default scale, 1 unit = 0.25rem = 3.5px at the 14px root."
  1: 3.5px
  2: 7px
  3: 10.5px
  4: 14px
  6: 21px
  8: 28px
  12: 42px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.h4}"
    rounded: "{rounded.md}"
    padding: 8px 16px
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: 8px 16px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 8px 16px
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.xl}"
    padding: 24px
  input:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    border: "1px solid {colors.input}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: 2px 8px
  popover:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.foreground}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: 4px
  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.foreground}"
    border: "1px solid {colors.border}"
    rounded: 0px
    padding: 8px
---

## Overview

Patient Records is a clinical, security-first product, and its design language is deliberately quiet so that data and trust signals lead. The system is **shadcn/ui** in the `base-nova` style with a **neutral base color**, rendered through **OKLCH CSS custom properties** — one token set (`--background`, `--foreground`, `--primary`, …) with a light value map on `:root` and a dark map under `.dark`, switched by `next-themes` (default: follow the OS). The app is comfortable in either mode and ships dark-capable from day one.

The palette has exactly **one chromatic role**: a confident blue **primary** (`{colors.primary}` — `#2563eb` light, `#467ef7` dark) used for the main CTA, focus rings, active nav, and links. Everything else is a **pure neutral gray** (hue 0) — backgrounds, cards, borders, body text, and muted helper text. The only other hue is **destructive red** for irreversible/erroring actions. This restraint is the brand: a medical tool shouldn't be loud.

Surfaces are **flat and hairline-bordered** — there are effectively no drop shadows in the resting UI; separation comes from a 1px `{colors.border}` and a subtle card/background contrast. Radii are **medium-soft** (base `--radius` ≈ 8.75px at the 14px root), giving inputs, buttons, and cards a friendly-but-serious roundness without feeling playful.

Typography is the **system sans stack** (no web fonts shipped) at a compact **14px root** with **1.5 body line-height**, and headings at **weight 600**. Code, IDs, and crypto material (user IDs, device IDs, room IDs, recovery keys) render in the **monospace stack** — a recurring signal that you're looking at exact, copyable technical values.

**Key Characteristics:**
- Single-blue accent (`{colors.primary}`) over an otherwise pure-neutral gray system — one CTA color, used sparingly.
- OKLCH token architecture: light (`:root`) + dark (`.dark`) value maps over one semantic token set, toggled by `next-themes`.
- Flat, hairline-bordered surfaces — 1px `{colors.border}`, near-shadowless; elevation reserved for true overlays (popover, dialog, toast).
- 14px root font size with weight-600 headings on the system sans stack; no custom web fonts.
- Monospace for all technical/crypto values (user/device/room IDs, recovery keys) — the app's quiet "this is exact data" signal.
- Medium-soft radii from a single `--radius` scaled by fixed multipliers (sm 0.6 → 2xl 1.8).
- Destructive red is the only second hue, gated behind confirm modals/toasts (never native `confirm()`).
- SVG-only iconography (per project rule) — no emoji or system glyphs in the UI.

## Colors

> **Source:** `web/src/app/globals.css` (`@theme inline` + `:root` / `.dark` OKLCH tokens), `web/components.json` (`style: base-nova`, `baseColor: neutral`). Hex values below are sRGB conversions of the OKLCH source.

### Brand & Accent
- **Primary** (`{colors.primary}` — light `#2563eb` / dark `#467ef7`): The single CTA / focus / link color. Filled primary buttons, `--ring` focus outline, active sidebar item.
- **Primary Foreground** (`{colors.primary-foreground}` — light `#f7fafd` / dark `#eff6ff`): Text/icon on primary fills.
- **Accent** (`{colors.accent}` — light `#eff5fd` / dark `#202938`): Pale-blue hover/selected surface for menu items and subtle highlights.
- **Accent Foreground** (`{colors.accent-foreground}` — light `#1c47a6` / dark `#dbe9fc`): Text on accent surfaces.
- **Ring** (`{colors.ring}` — = primary): Focus ring, applied app-wide via `outline-ring/50` on `*`.

### Surface
- **Background** (`{colors.background}` — light `#ffffff` / dark `#0a0a0a`): App canvas.
- **Card / Popover** (`{colors.card}` — light `#ffffff` / dark `#171717`): Raised content containers; in dark mode card lifts one neutral step above the background.
- **Secondary / Muted** (`{colors.secondary}` — light `#f7f7f7` / dark `#262626`): Quiet fills for badges, secondary buttons, inert chips.
- **Border / Input** (`{colors.border}` — light `#e5e5e5` / dark `rgba(255,255,255,0.10)`): The 1px hairline that does almost all of the visual separation. Input gets a slightly stronger `rgba(255,255,255,0.15)` in dark.
- **Sidebar** (`{colors.sidebar}` — light `#fbfcfd` / dark near-card): A barely-distinct chrome surface for the app shell rail.

### Text
- **Foreground** (`{colors.foreground}` — light `#0a0a0a` / dark `#fafafa`): Default body and heading text. Near-black / near-white, never pure.
- **Muted Foreground** (`{colors.muted-foreground}` — light `#737373` / dark `#a1a1a1`): Helper text, captions, table labels, `h6`, timestamps.
- **Secondary Foreground** (`{colors.secondary-foreground}` — light `#171717` / dark `#fafafa`): Text on secondary fills.

### Semantic
- **Destructive** (`{colors.destructive}` — light `#e7000b` / dark `#ff6467`): Irreversible/erroring actions (sign out, delete, decryption failures). Always paired with a confirm modal or toast — never a native dialog.
- **Status hues (component-level):** the System Status surface reads health as green (ready / E2E ready / backup on), amber (syncing / catching up), and destructive red (read-only / sync error). These live in the status feature, not the global token set.

## Typography

### Font Family

The app ships **no web fonts** — it uses the platform **system sans stack** (`--font-sans`: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif` + emoji fallbacks) for all UI text, and a **monospace stack** (`--font-mono`: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`) for code and technical values. `--font-heading` aliases the sans stack — headings differ by weight/size, not family.

The root font size is **14px** (`html { font-size: 14px }`) with **1.5** body line-height and antialiased smoothing.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.h1}` | 28px (2em) | 600 | 1.25 | Page title |
| `{typography.h2}` | 21px (1.5em) | 600 | 1.25 | Section heading |
| `{typography.h3}` | 17.5px (1.25em) | 600 | 1.25 | Sub-section / card title |
| `{typography.h4}` | 14px (1em) | 600 | 1.25 | Inline heading / button label |
| `{typography.h5}` | 12.25px (0.875em) | 600 | 1.25 | Minor label |
| `{typography.h6}` | 11.9px (0.85em) | 600 | 1.25 | All-caps-ish eyebrow (rendered in `{colors.muted-foreground}`) |
| `{typography.body}` | 14px | 400 | 1.5 | Default body text |
| `{typography.code}` | 11.9px (0.85em) | 400 | 1.5 | Code, IDs, crypto material (mono) |

### Principles
- **Weight, not size, makes a heading.** Headings step up to 600 while staying close to body size — the hierarchy is dense and editorial, suited to data-heavy screens.
- **Compact 14px root.** The whole UI is scaled from a 14px root; spacing and radii (both rem-derived) inherit this density. Don't override the root size per-component.
- **Monospace = exact data.** Anything copyable and precise — Matrix user/device/room IDs, recovery keys, event JSON — renders in `{font.mono}`. It's the app's trust signal for "this is the real, exact value."
- **Muted for support text.** Captions, table labels, and `h6` use `{colors.muted-foreground}`; never dim body text by lowering opacity.

### Note on Fonts
No web fonts are loaded, so there are no substitutes to manage — the design intentionally renders in each OS's native sans (SF on Apple, Segoe on Windows, Roboto/Noto on Android/Linux). If a branded face is ever introduced, set it on `--font-sans` only and keep the 14px root + 600 heading weights.

## Component Stylings

> **Source:** shadcn/ui components under `web/src/components/ui/*`, base-nova style.

- **Button — primary** (`{components.button-primary}`): Filled `{colors.primary}`, `{colors.primary-foreground}` label, `{rounded.md}`, `8px 16px` padding, weight-500/600 label. The one loud control per view.
- **Button — outline** (`{components.button-outline}`): Transparent fill, 1px `{colors.border}`, foreground label; hover lifts to `{colors.accent}`. The default for secondary actions.
- **Button — ghost** (`{components.button-ghost}`): No border/fill; hover background `{colors.accent}`. Used for icon buttons and menu triggers.
- **Button — destructive** (`{components.button-destructive}`): Filled `{colors.destructive}`; reserved for sign-out / delete, always behind a confirm modal.
- **Card** (`{components.card}`): `{colors.card}` surface, 1px `{colors.border}`, `{rounded.xl}`, generous padding; near-shadowless.
- **Input** (`{components.input}`): Transparent fill, 1px `{colors.input}`, `{rounded.md}`; focus draws the `{colors.ring}` outline.
- **Badge** (`{components.badge}`): Small `{rounded.md}` chip on `{colors.secondary}`; `destructive` and `outline` variants exist for status.
- **Popover / Dropdown / Dialog** (`{components.popover}`): `{colors.popover}` surface, 1px border, `{rounded.lg}`, with real elevation (these are the only places shadow is used). The account menu (recovery key, reset backup, sign out) and the System Status sheet are the canonical examples.
- **Toaster (sonner):** Bottom-anchored toasts replace native `confirm()`/`alert()` everywhere — a hard project rule.
- **Icons:** SVG only (Lucide-equivalent), stroke-based, inheriting `currentColor`. No emoji or system glyphs.

## Layout Principles

- **Spacing scale:** Tailwind v4 default (`1` = 0.25rem = **3.5px** at the 14px root). Common rhythm: `2`/`3` inside controls, `4`/`6` between elements, `8`/`12` between sections.
- **App shell:** a persistent sidebar rail (`{colors.sidebar}`) + main content column; content is width-constrained and left-aligned, not centered hero layouts.
- **Density:** data-first. Tables, timelines (message history), and forms favor compact rows over airy cards; whitespace is used to group, not to decorate.
- **Alignment:** 1px hairline borders define regions instead of heavy padding or background blocks. Keep regions flush and let `{colors.border}` do the dividing.

## Depth & Elevation

- **Resting UI is flat.** Cards, inputs, and the sidebar separate via 1px `{colors.border}` and a one-step surface contrast (`background` → `card`), **not** shadow.
- **Elevation is reserved for true overlays.** Popovers, dropdown menus, dialogs, and toasts are the only elements that cast a shadow — signaling "this floats above and is dismissible."
- **Dark-mode lift via lightness, not shadow.** In dark mode, raised surfaces (`card`/`popover` `#171717`) sit one neutral step above the `#0a0a0a` background; deeper overlays get a soft `rgba(0,0,0,.45)`-class shadow only.
- **Focus is elevation too.** The `{colors.ring}` outline (primary at 50% via `outline-ring/50`) is the consistent "active/focused" cue across inputs, buttons, and links.

## Do's and Don'ts

**Do**
- Use the semantic CSS tokens (`var(--primary)`, `var(--muted-foreground)`, `var(--border)`) — never hardcode hex. This is what keeps light/dark in sync.
- Keep one primary CTA per view; everything else outline/ghost.
- Render IDs, keys, and other exact technical values in the monospace stack.
- Gate irreversible actions behind a custom modal or toast.
- Draw separation with 1px `{colors.border}`; reserve shadow for overlays.

**Don't**
- Don't introduce a second accent hue — the system is mono-accent blue + neutral + destructive red.
- Don't use native `confirm()` / `alert()` dialogs (project rule) — use `toast` or a custom modal.
- Don't use emoji or icon-font/system glyphs — create SVG icons.
- Don't add drop shadows to resting cards/inputs to "lift" them; use the border + surface contrast.
- Don't override the 14px root or dim body text with opacity — use `{colors.muted-foreground}` for support text.

## Responsive Behavior

- **Root scale:** the 14px root keeps the dense, desktop-clinical feel; layout reflows rather than rescaling type.
- **Sidebar:** collapses to an off-canvas / icon rail on narrow viewports; the main content column goes full-width.
- **Touch targets:** controls keep ≥ `8px` vertical padding (≈ 36–40px hit height) so buttons and menu items remain tappable.
- **Tables & timelines:** allow horizontal scroll or stack into label/value rows on small screens rather than truncating clinical data.
- **Theme:** respects `prefers-color-scheme` by default (`next-themes` `defaultTheme="system"`), with an explicit toggle; both maps are first-class.

## Agent Prompt Guide

**Palette quick reference (dark / light):**
- Primary: `#467ef7` / `#2563eb` · Primary text: `#eff6ff` / `#f7fafd`
- Background: `#0a0a0a` / `#ffffff` · Card: `#171717` / `#ffffff`
- Foreground: `#fafafa` / `#0a0a0a` · Muted text: `#a1a1a1` / `#737373`
- Border: `rgba(255,255,255,.10)` / `#e5e5e5` · Destructive: `#ff6467` / `#e7000b`
- Radius base: `~8.75px` (`--radius` 0.625rem @ 14px root) · Root font: 14px · Headings: weight 600

**Ready-to-use prompt:**
> Design a [SCREEN] for a clinical, E2E-encrypted records app using shadcn/ui (`base-nova`, neutral base). Dark-mode-first via OKLCH CSS tokens. Use a single blue primary (`#467ef7` dark / `#2563eb` light) as the only accent over a pure-neutral gray system; destructive red only for irreversible actions. Flat, hairline-bordered surfaces (1px border, no resting shadows); reserve elevation for popovers/dialogs/toasts. System sans stack at a 14px root with weight-600 headings; monospace for all IDs/keys/crypto values. Medium-soft radii (~8.75px base). SVG icons only, no emoji. No native confirm/alert — use toasts or custom modals.
