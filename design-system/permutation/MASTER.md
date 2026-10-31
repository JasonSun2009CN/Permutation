# Permutation · Design System (MASTER)

This file is the source of truth for visual decisions. Page-specific overrides, if ever needed, live in `design-system/permutation/pages/`.

> The initial `ui-ux-pro-max --design-system` output suggested a generic landing-page pattern and Caveat/Quicksand typography. That was intentionally replaced: Permutation is a bilingual desktop productivity tool, not a marketing page. Retained from the search: calm teal + warm accent, minimal single-column focus, micro-interactions.

## Product intent

- Quiet, trustworthy, gently proactive.
- One primary action per screen.
- Time is the main visual object.
- Chinese and English are equal citizens.
- System UI fonts, no decorative fonts.

## Color tokens

Defined in `apps/desktop/src/renderer/src/styles.css`; consumed through Tailwind `@theme inline`.

### Light

| Token           | Hex       |
| --------------- | --------- |
| bg              | `#F5F6F2` |
| surface         | `#FFFFFF` |
| surface-2       | `#EEF0E9` |
| sidebar         | `#EEEFE9` |
| ink             | `#17201B` |
| muted           | `#5E6B63` |
| faint           | `#6B7870` |
| line            | `#E1E4DC` |
| line-strong     | `#D0D6CC` |
| accent          | `#0F766E` |
| accent-hover    | `#115E59` |
| accent-soft     | `#DCEFE9` |
| accent-contrast | `#FFFFFF` |
| warm            | `#C2410C` |
| warm-soft       | `#FBE9DC` |
| danger          | `#B42318` |
| danger-soft     | `#FBE9E7` |

### Dark

| Token           | Hex                     |
| --------------- | ----------------------- |
| bg              | `#0D1210`               |
| surface         | `#151C18`               |
| surface-2       | `#1B241F`               |
| sidebar         | `#111714`               |
| ink             | `#E7EDE8`               |
| muted           | `#A0AEA5`               |
| faint           | `#74837A`               |
| line            | `#263029`               |
| line-strong     | `#344039`               |
| accent          | `#2DD4BF`               |
| accent-hover    | `#5EEAD4`               |
| accent-soft     | `rgba(45,212,191,.14)`  |
| accent-contrast | `#062A26`               |
| warm            | `#FB923C`               |
| warm-soft       | `rgba(251,146,60,.14)`  |
| danger          | `#F97066`               |
| danger-soft     | `rgba(249,112,102,.14)` |

Rules:

- Primary action = accent background + contrast text.
- Overdue = warm, never danger.
- Danger only for destructive confirmation.
- No pure black backgrounds; no pure white text.

## Typography

```css
--font-sans:
  -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
  'Microsoft YaHei', 'Noto Sans SC', sans-serif;
--font-mono: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, 'Cascadia Code', monospace;
```

| Role          | Size / weight / tracking                |
| ------------- | --------------------------------------- |
| Page title    | 24 / 600 / -0.02em                      |
| Section title | 13 / 600 / -0.01em                      |
| Eyebrow       | 11.5 / 500 / 0.14em / uppercase / faint |
| Body          | 14 / 400 / 1.55                         |
| Secondary     | 13 / 400 / muted                        |
| Caption       | 11.5–12 / 400 / muted or faint          |
| Next-up clock | 34 / 600 / mono / -0.04em               |
| Inline time   | 13 / 500 / mono                         |

Line length: ≤ 768px for forms and chat; 65–75 characters for prose.

## Spacing & shape

- 4px base; use 8 / 12 / 16 / 20 / 24 / 32.
- Page horizontal padding 32px.
- Radius: 12px controls, 16px cards/modals, 999px pills.
- Border first, shadow second.
- Shadow light: `0 1px 2px rgba(23,32,27,.04), 0 10px 30px rgba(23,32,27,.06)`.
- Shadow dark: `0 1px 2px rgba(0,0,0,.35), 0 16px 40px rgba(0,0,0,.3)`.

## Layout

- Window: 1180×780, min 940×640.
- Sidebar: 252px fixed; 42px macOS drag area at top.
- Main: 32px drag strip, then page content.
- Chat: centered `max-w-3xl`, independent scroll, composer pinned.
- Reminder popup: 360px, fixed bottom-right.
- Toast: top-right, auto-dismiss 4.2s.

## Components

- Buttons: 32px (sm) / 40px (md) / 36px icon.
- All icon-only buttons need `aria-label` and tooltip.
- Switches 40×24.
- Modals: ESC closes, overlay click closes, `role="dialog"`.
- Confirmation card: warm border, summary, details disclosure, deny + approve.
- Tool trace: collapsible, argument JSON in mono, status icons (running / done / failed / denied).

## Motion

- Entrance 220ms, translate 8px + fade.
- Hover/color 150ms.
- No layout-shifting hover.
- Respect `prefers-reduced-motion`.

## Accessibility

- Body contrast ≥ 4.5:1.
- Focus visible on all interactive elements.
- Keyboard navigation; no drag-only interactions.
- Status expressed with text, not color alone.
- Absolute + relative time together.

## Anti-patterns

- No emoji as UI icons.
- No glassmorphism/neon gradients.
- No fake charts, fake metrics, or decorative statistics.
- No second accent color for variety.
- No generic marketing hero inside the app.
- No hardcoded user-visible English in components; use i18n keys.
