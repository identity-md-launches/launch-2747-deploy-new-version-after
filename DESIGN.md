# Wheelkeepers design

## Overview

Wheelkeepers is a browser arcade for the Squeekchain community. Its visual idea is a gold LED hamster inside a blue LED wheel, carried through the game canvas, icon and share image. The existing dark arcade identity and simulation remain the foundation. The game and Play action precede the leaderboard and hardware information.

The React surface is `app/page.tsx`. Shared styles and tokens live in `app/globals.css`. `web/main.tsx` renders the same surface for static hosting; `web/index.html` supplies its metadata. `lib/draw.ts` and `lib/hamster.ts` contain the preserved canvas artwork. They are geometry/rendering modules, not the DOM type or spacing system.

## Colors

All DOM colors use the established hex notation. The canonical definitions are in `app/globals.css:3`.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#1a1a20` | Page background |
| `--panel` | `#0b0b0d` | Arcade, leaderboard, hardware card, dialogs |
| `--field` | `#070709` | Game field; ink on the primary gold action |
| `--raised` | `#141419` | Table heading, wallet rows, hover surfaces |
| `--line` | `#32323d` | Structural borders and dividers |
| `--text` | `#f2f2f4` | Primary text |
| `--muted` | `#a3a3b2` | Supporting copy and labels |
| `--gold` | `#ffc048` | Play emphasis, scores, seeds and Boost |
| `--blue` | `#5b7cfa` | Decorative waveform and existing wheel art |
| `--blue-lit` | `#a8baff` | Links, instructions, pace and numeric highlights |
| `--green` | `#65d99b` | Verified/session status |
| `--danger` | `#ff9da8` | Wallet errors |
| `--focus` | `#a8dfff` | Keyboard focus outline |

The theme is deliberately dark only. Status also has text, icons or an underline. The solid gold Play button is the primary action; other actions use a border or text treatment. Source-derived sRGB contrast calculations give muted/panel **7.90:1**, muted/page **6.96:1**, text/panel **17.59:1**, and field/gold **12.35:1**. Rendered solid-background pairs also passed the design probe and axe checks. These numbers do not certify every point of the canvas/gradient composition; see validation limitations.

## Typography

Three families are used, with only weights 400 and 600:

- **Arial, Helvetica, sans-serif** (`--body`): copy, controls and labels. Body is 16px/1.6; compact UI copy is 14px/1.6; captions are 13px.
- **Barlow Condensed, Arial Narrow, sans-serif** (`--display`): 600-weight headings and arcade numbers. The local Latin WOFF2 is in `public/fonts/`. Heading line height is 1.1, with balanced wrapping.
- **IBM Plex Mono, ui-monospace, monospace** (`--mono`): 400-weight wallet identifiers, table data and selected numeric details. Prose uses the body family. The local Latin WOFF2 is bundled.

| Token | Size at default root | Used for |
| --- | --- | --- |
| `--text-xs` | 13px / .8125rem | Labels, captions, addresses and table data |
| `--text-sm` | 14px / .875rem | Buttons, instructions and compact copy |
| `--text-base` | 16px / 1rem | Body and small section headings |
| `--text-lg` | 24px / 1.5rem | Section headings, pace and metrics |
| `--text-xl` | 32px / 2rem | Overlay headings, score, mobile page heading |
| `--text-display` | 40px / 2.5rem | Desktop page heading |

Changing counters use tabular numerals. Page-heading tracking is −.025em; overlay-heading tracking is −.02em. Content otherwise uses natural spacing and sentence case. Descriptions use `text-wrap: pretty`; error text can wrap anywhere. The LED lettering is vector artwork in `DotTitle`, not another text scale. No font service is used on page load.

## Layout

`.site-shell` caps content at 1440px and uses 20px desktop inline padding. Major gaps are 20–28px, component padding is 20–24px, related controls use 8–12px gaps, and small label/value groups use 6–8px gaps. These are implemented CSS values rather than a separate generated spacing schema.

`.workspace` places the arcade and leaderboard in a flexible left column and the hardware card in a 300px right column. The DOM order is game, leaderboard, hardware status. At 1120px the side column becomes 280px and the gap becomes 16px. At 940px and below the grid becomes one column in the same reading order.

At 620px and below, the shell has 12px inline padding, navigation links move out of the header, the duplicated LED intro mark is hidden, and the page heading is 32px. The header still offers the product/home link and Connect. Game instructions remain available through the game toolbar. The game field becomes 320px tall; below 359px it becomes 300px tall and the shell uses 8px inline padding. The default desktop field is 420px; the intermediate one-column field is 400px.

The game overlay is placed beside the resting wheel. Playing recenters and enlarges the wheel using the preserved `sceneLayout` logic. Pointer controls switch to a hold-and-drag hint on coarse pointers. Compact tables use four fixed column roles with an adaptable keeper column; the own-player marker wraps below the address on small screens. The hardware card and footer wrap naturally. No page-level horizontal scrolling was observed at the validated widths.

Dialogs are centered on wider screens. At 620px and below they align to the bottom with 12px viewport margins and scroll internally within `100dvh`. Native zoom, RTL localization and physical devices are not claimed as tested.

## Elevation & depth

Surfaces use a single 1px structural border and no box shadow. The header is unboxed. The game field has its own darker background. A narrow dark-to-transparent overlay protects the ready/result copy over the canvas. The dialog backdrop uses `#070709df`; dialogs occupy layer 20, notifications layer 30 and the focused skip link layer 50. Notifications persist until dismissed.

## Shapes

Main panels and dialogs have 12px radii. Buttons, wallet rows and keyboard hints use 6px or 4px radii; the notification uses 8px. Borders identify component edges and selected states. Gold circles and blue squares belong to the preserved LED art. Canvas clipping is intentional artwork containment; meaningful DOM text is allowed to wrap.

## Components

These are implemented page patterns, not a new general-purpose component library.

| Pattern / source | Behavior |
| --- | --- |
| `Hamster`, `DotTitle` in `app/page.tsx` | Existing decorative identity. Hamster uses a relative local SVG. The real page heading remains text. |
| `.topbar`, `.wallet-button` | Home/brand left; utilities right. Connect opens one wallet sheet. A connected address offers disconnect with a descriptive accessible name/title. |
| `.start-button` | Gold primary action, at least 48px high. Ready, starting, ranked/practice, verifying and replay labels match the state. Disabled during a start or final verification. |
| `.game-tools` | 44×44px sound and help controls, plus Exit during play. Icon-only actions have labels and titles. |
| `.canvas-wrap` | Focused after starting. Arrow keys/A/D steer, pointer movement aims, touch captures a drag, and Escape exits. Result focus returns toward Play. Sound unlocks during the user gesture. |
| `.game-hud`, `.boost-status` | Tabular score, seeds, pace/time and labelled lives. Boost energy is a named progress bar. Live and practice Boost are distinguished in text. |
| `.leaderboard`, `.board-tabs` | Native table with scoped headings. Buttons expose selection through `aria-pressed`. Loading, empty, unavailable, populated and stale-refresh states have explicit copy and recovery. Shows up to 20 real API rows. |
| `.pulse-card` | Shows checking, running/resting, unavailable or static-preview state. Missing metrics use a dash. Only server-provided events expose Join Boost. Practice Boost remains explicit and separate. |
| `.modal`, `.wallet-list` | Labelled modal, background `inert`, focus trap, Escape/backdrop/close dismissal and focus return. Wallet names/icons come from EIP-6963; mobile links open this exact page in a wallet browser. Errors remain beside the attempted action. |
| `.toast`, `.announcer` | Persistent dismissible notification with a stable polite status region. |

Focus uses a 2px `--focus` outline with 4px offset; the game field draws it inward. Forced-color mode uses the system Highlight color. Hover styles are restricted to hover-capable devices. Press feedback scales to .96 only when motion is permitted. Reduced motion stops decorative idle canvas movement, scrolling animation, transitions and spinners; player-started game movement remains essential gameplay.

## Do's and don'ts

- Reuse the existing color roles, six type sizes and workspace alignment edges.
- Keep Play and the real game on the first phone screen. Put directions next to the game controls.
- Use local assets and hash anchors for static navigation. Rebuild `dist/` after source changes.
- Keep device-only practice scores separate from shared, server-verified scores. Never synthesize a live event, player, RPM or score.
- Prefer native buttons, links and tables. Keep a visible keyboard path and explicit loading/error recovery.
- Add a related surface by using the panel treatment, section heading and existing spacing; document any new reusable token rather than introducing a competing visual system.

## Attribution

Design guidance: Jakub Krehel, Better Interface, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT). Documentation method adapted from Paul Bakaus, Impeccable, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0). This document describes the implementation in this repository; it is not a copy of either reference manual. License texts are in `vendor/design-guidance-LICENSE.txt`.
