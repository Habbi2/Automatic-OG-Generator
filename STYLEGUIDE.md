# Automatic OG Generator – Style Guide

This guide documents the shared design tokens, component primitives, and usage conventions for a flat, elegant interface.

## Philosophy

Flat, minimal, content-forward. Avoid heavy gradients, deep shadows, and ornamental borders. Use subtle elevation (1px hairlines + soft focus rings) to communicate interactivity. Spacing is generous but efficient; typography aims for high contrast and strong hierarchy without loud display gimmicks.

## Design Tokens

Defined in `styles/tokens.css` and imported in `app/globals.css`.

Categories:
- Color: `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-dim`, `--color-accent`, semantic (`--color-danger`, etc.)
- Typography: font stacks, type scale (`--text-xs` .. `--text-3xl`), line heights, weights
- Spacing: `--space-*` 4-based modular scale
- Radii: `--radius-sm` .. `--radius-2xl` for consistent rounding
- Shadows: minimalist layers `--shadow-sm|md|lg` (avoid stacking multiple)
- Motion: easing + durations for cohesive transitions
- Layout width: `--layout-max`, `--layout-readable`

Light theme overrides apply via `body[data-theme='light']`.

## Base Elements

Body: background = `--color-bg`, text = `--color-text`. Headings use tight leading and slight negative letter-spacing. Selection highlight uses accent tint with transparency.

Links: Accent colored, underline on hover only.

Forms: Neutral surface background, 1px border, focus ring = accent border + outline simulation (box-shadow 0 0 0 1px accent).

## Component Primitives

### Button (`.btn`)
Variants:
- Base: subtle surface button.
- `.primary`: gradient accent background (linear blend accent → accent-alt).
- `.outline`: transparent background, relies on border.

States: hover = surface-alt or slight brighten for gradient, disabled = reduced opacity + pointer lock.

### Panel (`.panel`)
Surface container with 1px border and subtle shadow. Use padding tokens (`--space-6` default). Add `.flat` to remove shadow if nested.

### Badge (`.badge`)
Pill shape, small text. Accent variant uses RGBA tinted background.

## Layout Helpers

- `.container` centers and constrains content.
- `.stack-md` / `.stack-lg` vertical rhythm utilities.
- Generic spacing utilities `.mt-*`, `.p-*`, `.gap-*` for quick composition.

Prefer semantic layout components (form sections, field groups) over deeply nested utility chains where possible.

## Overlay Styling

The Open Graph overlay uses a gradient background tuned per theme, with a vertical accent bar and a content split. Frame (`.shot-mask`) uses token radii and adaptive shadow; `plain=1` query parameter removes visual decoration. Scaling script preserves clarity of embedded site while keeping a consistent outer frame.

## Accessibility & Contrast

All text colors meet or exceed WCAG AA on their respective backgrounds. Interactive focus is indicated via color + 1px outline (no reliance on color alone). Motion is minimal and reduced-motion safe.

## Extension Guidelines

When adding new UI:
1. Use existing tokens—never hardcode raw hex or pixel values unless adding a new token.
2. Keep at most one shadow layer; prefer `--shadow-sm`.
3. Favor spacing tokens over custom margins/padding.
4. Use `.panel` for grouped content blocks; avoid nesting more than two levels.
5. Reserve gradients for the accent bar and primary button only.

## Theming

Light mode toggles by setting `data-theme="light"` on `<body>`. If adding color-dependent components, inherit from existing tokens so both themes update automatically.

## Future Enhancements
- Add density scale (comfortable / compact) via a root modifier class.
- Introduce semantic intent classes (e.g., `.btn.danger`) mapping to danger/warn tokens.
- Provide a skeleton loader primitive using pulsating neutral gradient.

---
This document should evolve with design shifts. Keep it concise and aligned with implemented tokens.
