# Design System: Token-Driven Styling

**Date:** 2026-04-17
**Scope:** Frontend only — no backend changes

---

## Context

The frontend currently uses raw Tailwind utility classes with hardcoded color references (`bg-gray-800`, `text-indigo-600`, `bg-green-50 dark:bg-green-950/30`, etc.) scattered across all 6 components and the Home page. A `tokens.css` file was created with raw design token values extracted from Vercel (Geist DS) and Linear, but it is not yet connected to the components.

The goal is to wire those tokens into a semantic layer that Tailwind understands, so every component expresses intent (`bg-surface`, `text-muted`, `bg-brand`) rather than implementation details. This eliminates duplicated dark-mode pairs, makes theme changes a single-file edit, and produces a look consistent with Vercel/Linear design quality.

---

## Visual Direction

- **Dark mode (system-triggered):** Vercel Dark — pure black surface (`#000`), white as primary action, neutral grays.
- **Light mode (system-triggered):** Linear Light — white surface, near-black primary action, Linear indigo (`#5e6ad2`) as highlight accent.
- **Typography:** Inter Variable (Google Fonts) with `font-feature-settings: 'cv01','ss03'` and Linear's letter-spacing scale.
- **Dark/light switching:** existing Tailwind `dark:` class strategy on `<html>` is preserved; `useDarkMode` hook unchanged.

---

## Architecture

Three layers with strict separation:

```
tokens.css          raw values (oklch, hsl, px) from Vercel & Linear — READ ONLY
    ↓
index.css           semantic roles (:root / .dark) + @theme Tailwind bridge
    ↓
components/*.tsx    semantic Tailwind classes only — no raw colors
```

---

## Semantic Token Set

Defined in `:root` (light) and `.dark` (dark) in `index.css`, then exposed to Tailwind via `@theme`.

### Surfaces & backgrounds

| CSS var | Tailwind | Light | Dark |
|---|---|---|---|
| `--color-surface` | `bg-surface` | `#ffffff` | `#000000` |
| `--color-subtle` | `bg-subtle` | `#f8f8f8` | `#0a0a0a` |
| `--color-raised` | `bg-raised` | `#f4f4f4` | `#111111` |

### Foreground / text

| CSS var | Tailwind | Light | Dark |
|---|---|---|---|
| `--color-fg` | `text-fg` | `#282a30` | `#ffffff` |
| `--color-secondary` | `text-secondary` | `#3c4149` | `#a1a1a1` |
| `--color-muted` | `text-muted` | `#6f6e77` | `#666666` |

### Borders

| CSS var | Tailwind | Light | Dark |
|---|---|---|---|
| `--color-line` | `border-line` | `#e9e8ea` | `#1a1a1a` |
| `--color-line-strong` | `border-strong` | `#dcdbdd` | `#333333` |

### Brand (primary action)

| CSS var | Tailwind | Light | Dark |
|---|---|---|---|
| `--color-brand` | `bg-brand` | `#282a30` | `#ffffff` |
| `--color-brand-fg` | `text-brand-fg` | `#ffffff` | `#000000` |
| `--color-accent` | `text-accent` | `#5e6ad2` | `#e0e0e0` |
| `--color-accent-subtle` | `bg-accent-subtle` | `rgba(94,106,210,.08)` | `rgba(255,255,255,.08)` |
| `--color-accent` (border) | `border-accent` | `#5e6ad2` | `#e0e0e0` |

### Semantic states

| Role | CSS var | Tailwind text | Tailwind bg | Light | Dark |
|---|---|---|---|---|---|
| Success | `--color-success` / `--color-success-subtle` | `text-success` | `bg-success-subtle` | `#27a644` / `#f0faf2` | `oklch(64.58% .199 147.27)` / `rgba(39,166,68,.10)` |
| Error | `--color-error` / `--color-error-subtle` | `text-error` | `bg-error-subtle` | `#eb5757` / `#fff5f5` | `oklch(62.56% .2277 23.03)` / `rgba(235,87,87,.10)` |
| Warning | `--color-warning` / `--color-warning-subtle` | `text-warning` | `bg-warning-subtle` | `#d97706` / `#fffbeb` | `#f5a623` / `rgba(245,166,35,.10)` |

---

## Typography

- Load **Inter Variable** via Google Fonts in `index.html`
- `--font-sans` in `@theme` → `'Inter Variable', 'Inter', system-ui, sans-serif`
- `body` gets `font-feature-settings: 'cv01','ss03'`
- `letter-spacing` applied at component level via existing Tailwind tracking utilities (no global override)

---

## Files Changed

| File | Change |
|---|---|
| `frontend/index.html` | Add `<link>` for Inter Variable (preconnect + stylesheet) |
| `frontend/src/index.css` | Full rewrite: semantic vars, `@theme` bridge, Inter font |
| `frontend/src/App.css` | **Delete** — unused Vite template remnant |
| `frontend/src/tokens.css` | No change — raw token reference |
| `frontend/src/pages/Home.tsx` | Swap raw color classes → semantic |
| `frontend/src/components/ExerciseSelector.tsx` | Swap raw color classes → semantic |
| `frontend/src/components/VideoInput.tsx` | Swap raw color classes → semantic |
| `frontend/src/components/AnalysisStatus.tsx` | Swap raw color classes → semantic |
| `frontend/src/components/JointFeedback.tsx` | Swap raw color classes → semantic |
| `frontend/src/components/AngleChart.tsx` | Update hardcoded chart stroke colors to token values |
| `frontend/src/components/AnalysisResult.tsx` | Swap raw color classes → semantic |

**No logic changes** — hooks, API calls, and component props are untouched.

---

## Class Replacement Reference

```
bg-white dark:bg-gray-800            → bg-surface
bg-gray-50 dark:bg-gray-900          → bg-subtle
bg-gray-100 dark:bg-gray-800/50      → bg-raised
text-gray-900 dark:text-white        → text-fg
text-gray-500 dark:text-gray-400     → text-muted
text-gray-600 dark:text-gray-300     → text-secondary
border-gray-200 dark:border-gray-700 → border-line
border-gray-300 dark:border-gray-600 → border-strong
bg-indigo-600 hover:bg-indigo-700    → bg-brand hover:bg-brand/90
text-white (on brand btn)            → text-brand-fg
text-indigo-600 dark:text-indigo-400 → text-accent
border-indigo-500                    → border-accent (add to @theme)
bg-indigo-50 dark:bg-indigo-950/40   → bg-accent-subtle
bg-green-50 dark:bg-green-950/30     → bg-success-subtle
text-green-800 dark:text-green-300   → text-success
bg-red-50 dark:bg-red-950/30         → bg-error-subtle
text-red-800 dark:text-red-300       → text-error
bg-amber-50 dark:bg-amber-950/30     → bg-warning-subtle
text-amber-800 dark:text-amber-300   → text-warning
```

### AngleChart stroke colors (hardcoded array → token-aligned constants)
Recharts `<Line stroke>` requires resolved color strings — CSS vars are not supported directly. Replace the hardcoded array with a `CHART_COLORS` constant whose values are drawn from the token palette (accent, success, warning, error, blue, purple). The constant lives at the top of `AngleChart.tsx`. No `getComputedStyle` call needed; chart colors are categorical and do not need to respond to light/dark switching.

---

## Verification

1. `cd frontend && yarn dev` — app loads without console errors
2. Toggle OS between light/dark — both modes render correctly with no raw Tailwind color classes remaining
3. Run `grep -r "bg-gray\|text-gray\|bg-indigo\|text-indigo\|bg-green\|bg-red\|bg-amber" src/components src/pages` — should return zero matches
4. `yarn build` — no TypeScript or Vite errors
