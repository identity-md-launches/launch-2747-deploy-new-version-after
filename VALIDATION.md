# Wheelkeepers validation — 30 October 2026

## Outcome and scope

**Complete for the stated static website scope.** The deliverable is the rebuilt `dist/`, its React/TypeScript source, the existing unchanged package manifest/lockfile, and the documentation. This is worker-side evidence, not independent network certification. Publication is performed by the contributor network after submission; this job publishes no site or onchain transaction.

The job continues the existing Wheelkeepers arcade. The linked upstream repository's newer static API and default-sound fixes were inspected at commit `03a1b92e82a3f48c8544ccf92b79317da3380c3e`. Their frontend behavior was adapted into permitted source paths. The existing game engine, artwork, event rules, Worker build configuration and dependencies remain intact. No contract, private credential, production database or API deployment was changed.

Visual idea: a gold LED hamster inside a blue LED wheel, on a compact dark arcade surface.

| Acceptance area | Result | Evidence |
| --- | --- | --- |
| Usable site and primary interactions | Met | Both browser engines completed play/exit, help, sound, Boost practice, board tabs, fixture sign-in and verified completion. |
| Responsive layout | Met | No horizontal overflow at 320, 390, 768, 940, 1120 and 1440 CSS pixels in Chromium and WebKit. |
| Source, lockfile and static export | Met | Original `package.json` and `package-lock.json` retained; `dist/index.html` and 10 companion files included. |
| Production build and typecheck | Met | Static production build, strict static typecheck, full project typecheck and original Worker production build all exited 0. |
| Useful interaction validation | Met | 26 core/API-client tests; 26 browser validation groups; fixture checkpoints independently replayed. |
| Better Interface, all six domains | Met with explicit limits | Coverage and resolved findings below; taste@1 16/16; axe scans found no violations in final inspected states. |
| Product and main action on first 390 screen | Yes | At 390×844, wheel is x13/y339.95, 364×320; Play is x29/y529.92, 78.81×48, ending at y577.92. |
| Title, favicon, description, og:title, og:image | Met | `web/index.html`, built `dist/index.html`, local 1200×630 `share.png`. |
| Design documentation | Met | Root `DESIGN.md` extracted from final source and rendered behavior. |
| Install, preview and rebuild documentation | Met | Root `README.md` includes both static and original Worker workflows. |

## Commands and actual results

Dependencies were installed from the unchanged manifest and lockfile into an isolated temporary toolchain. Full framework checks used a fresh temporary copy of the final source with those dependencies, preserving the protected dependency/configuration paths in the submitted repository.

| Command / check | Actual result |
| --- | --- |
| `npm ci` against the original manifest/lockfile in the isolated toolchain | Installed 708 packages. An initial attempt used an unwritable default npm cache; rerunning with a writable temporary cache succeeded. No manifest/lockfile change. |
| `npm test` | Exit 0; **20/20** game, event, extension-error and hamster-rendering tests passed. |
| `node --experimental-strip-types --test tests/static-client.test.mjs` | Exit 0; **6/6** passed: endpoint/session selection, cookie isolation, invalid/offline responses before wallet prompts, message signing, domain mismatch, and expired/blocked storage. |
| `npm run typecheck` in the isolated copy | Exit 0; full project `tsc --noEmit`. |
| `node scripts/typecheck-static.mjs --toolchain …` | Exit 0; strict no-emit check of the static React entry and transitive UI/game modules. |
| `npm run build` in the isolated copy | Exit 0; all five vinext build phases completed. Framework warning: `/` could not be classified by static analysis; this was a warning, not a failed build. |
| `node scripts/build-static.mjs --toolchain …` | Exit 0; Vite 8.0.13 production export. Final application JS approximately 238.38 kB / 76.89 kB gzip; CSS 19.35 kB / 4.69 kB gzip. |
| `node --experimental-strip-types tests/static-browser.mjs --playwright … --axe … --out test/scratch/browser-validation` | Exit 0; **26/26** validation groups in Chromium and WebKit with Playwright 1.64.1 and axe adapter 4.14.0. |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste --offline` with the installed Playwright module | Exit 0; **16/16** measured checks passed. No external font/resource requests. |
| `node scripts/check-static.mjs` | Exit 0; 11 complete export files, all 6 local HTML/CSS/image asset references resolve with relative URLs; prohibited existing paths unchanged; submission additions below 8 MiB. Exact final byte counts are in `docs/validation/integrity.json`. |
| `git diff --check` | Exit 0. |

The design probe was run once before changes and after the final UI changes. The baseline passed **8/16** and attempted three missing same-origin `/api/` routes from static hosting. The final export passes **16/16**, including render, layout, targets, contrast, casing, tracking, eyebrows, type scale/families, copy, surfaces, motion and sharing. At 390, all measured controls meet the 44px comfortable size; first-screen prose is 14 words by the probe's definition.

The first browser pass exposed an invalid ARIA label on the lives display, which was repaired. A source review extended the correction to populated keeper identifiers before the final populated-table audit. The harness also corrected a canvas-fallback-text false positive, a duplicate button selector, an overly strict pixel threshold for an antialiased aim marker, and a premature leaderboard assertion. Final checks wait for the score refresh and inspect the finished export. None of those intermediate failures is counted as a final pass without rerunning its affected check.

WebKit initially lacked discoverable runtime dependencies. It was successfully exercised using the supplied external shared-library/software-EGL runtime. Playwright's package-level dependency preflight was skipped for that externally supplied runtime; both the browser process and the actual page/interaction checks ran. This was not recorded as an unperformed WebKit test.

## Browser and interaction evidence

The local preview served the export under `/preview/`. The responsive sweep used touch-capable browser contexts at 320×700, 390×844, 768×1024, 940×900, 1120×900 and 1440×900. The standalone taste probe additionally used its normal desktop context at 1440×900. The browser tool independently inspected the final export at 1280×720 with desktop controls, played and exited a practice run, opened/closed help, inspected the accessibility snapshot and console, and visually confirmed a keyboard focus ring.

Final browser checks covered:

- Relative local JS, CSS, SVG, PNG and WOFF2 loading with no local resource failures or script errors.
- The product, Play button and legible instructions on the first 390px screen.
- Keyboard Play, arrow steering, Escape exit and focus on the game field.
- Native touch start/move/end in Chromium, with the rendered aim marker measured at the requested angle; touch tap in both engines. WebKit native drag and physical touch devices were not tested.
- Help and wallet-sheet focus trapping, inert background, Escape dismissal and focus return; four mobile wallet browser links preserve the page URL.
- Default audio resume during Play, mute toggle and optional audio behavior. Device speaker output was not assessed.
- Idle canvas frames remain identical under reduced motion; no endless CSS animation remains.
- EIP-6963 wallet discovery, cancellation/retry, the account/message-only sequence, origin-bound bearer game calls and disconnect, using browser-only fixtures.
- A complete fixture-ranked run in each engine: three checkpoints independently replayed with the shared engine, matching score/lives/catches, then final score refresh into the shared-board UI.
- Guest completion, reload persistence, separate Practice Boost bests, and no ranked-start request from Practice Boost.
- Induced API failures with unavailable/retry UI while practice continues; blocked local storage gives an honest session-only result.
- Axe scans of ready, instructions, wallet and populated leaderboard states in both engines: no violations. This does not establish complete accessibility compliance.

Real API verification used only GET requests from the authorized published page origin, while intercepting that page's frontend files from the local export. `auth/session`, `leaderboard` and `pulse` each returned HTTP 200 in Chromium. No live wallet signatures, sessions, runs, score submissions or production fixtures were created by these checks. Hardware status can change after this dated observation.

Evidence retained:

- [`browser-validation.json`](docs/validation/browser-validation.json): all 26 final browser group results and the three live GET outcomes.
- [`taste.json`](docs/validation/taste.json): all 16 final probe results.
- [`screenshots/chromium-390.png`](docs/validation/screenshots/chromium-390.png) and [`screenshots/webkit-390.png`](docs/validation/screenshots/webkit-390.png): first phone screen.
- [`screenshots/chromium-1440.png`](docs/validation/screenshots/chromium-1440.png) and [`screenshots/webkit-1440.png`](docs/validation/screenshots/webkit-1440.png): expanded layout in the touch-capable responsive sweep.
- [`keyboard-focus.png`](docs/validation/keyboard-focus.png): keyboard-focused skip link at desktop size, inspected visually.

Raw probe screenshots and intermediate fixtures were kept in the task's disposable scratch directory. They are not runtime dependencies.

## Better Interface coverage

| Domain | Status | Checked | Limits / not applicable |
| --- | --- | --- | --- |
| Accessibility | Checked | Native buttons/links/table, accessible names, scoped column headers, lives image label, hidden full identifiers, keyboard controls, skip link, focus trap/return, inert background, stable status/error regions, reduced motion, targets; eight final axe state scans across two engines. | No screen-reader session, physical device, full forced-colors visual pass, or nonvisual equivalent to the canvas game. Axe is not an accessibility certification. No forms are present. |
| Layout | Checked | DOM order, two-column/one-column adaptation, six widths, 390 first screen, no overflow; modal scrolling, mobile controls and relative assets. | Native 200% browser zoom and RTL/pseudo-localization were not performed. Only English/dark mode are implemented. |
| Writing | Checked | Four-word headline plus plain product sentence, verb-led actions, adjacent directions, correct 90-second entry versus 75-second run, truthful practice/shared-data distinction, readable error recovery. | No translation or separate editorial content is in scope. |
| Typography | Checked | Six source sizes, two weights, three families, intended WOFF2 faces loaded, tabular changing digits, wrapping, 13px caption minimum, body-family prose. | Native text enlargement and other platform font renderers were not separately assessed. |
| Colors | Checked with limits | Semantic hex roles, actual solid-background pairs in the probe/axe, exact source-pair calculations, text/icon/underline status cues. Muted/panel 7.90:1; muted/page 6.96:1; primary action ink/gold 12.35:1. | The probe leaves six text boxes over canvas/gradients unmeasured. Their screenshots were inspected, but no exhaustive per-pixel contrast claim is made. No light theme is present. |
| UI details | Checked | Existing LED identity, restrained surfaces, 44px toolbar controls, loading/empty/error/success/retry states, hover gating, explicit transitions, reduced-motion idle art, persistent dismissible notices, wallet pending logic reviewed in source and rejection/retry exercised in the browser. | Animations-panel replay at 10% speed and physical wallet-app transitions were not performed. |

## Findings, corrections and recheck

All references below point to final source. Applicable high and medium findings within the website scope were corrected.

| Severity / finding | Source | Before and user impact | Correction and evidence |
| --- | --- | --- | --- |
| High — static clients requested a missing local API | `components/services/api-client.ts:22`, `components/services/api-client.ts:81` | A gateway copy asked its own origin for `/api/`, producing 404s and broken wallet/score flows. | Existing production API, tab-bound bearer sessions with cookies omitted, service precheck, timeouts and readable errors. Unsupported static origins explicitly offer practice. Six client tests, fixture browser sign-in/completion and real CORS GETs pass. |
| Medium — sound fix absent | `app/page.tsx:30`, `app/page.tsx:186` | The newer default-audio/user-gesture fix was not in the checkout. | Sound defaults on and resumes before an asynchronous ranked-start request. Both engines observed resume during Play; mute and unavailable-audio fallback remain. |
| High — tiny and inconsistent text/control system | `app/globals.css:3`, `app/globals.css:53`, `app/globals.css:199` | Phone copy reached 6px and the baseline used 11 type sizes at 390. Toolbar controls were 23px. Footer text measured 3.44:1. | Six sizes, 13px caption minimum, body-family prose, two weights, higher-contrast supporting text, 44px toolbar controls. Final probe passes type/contrast/target checks; both engines reflow at all inspected widths. |
| Medium — remote fonts and missing share metadata | `app/globals.css:1`, `web/index.html:8`, `app/layout.tsx:5` | Font requests left the site and `og:title` / `og:image` were absent. | Local WOFF2 plus license files; complete metadata and a real local 1200×630 share PNG. No remote font/resource requests in static preview. Share check passes. |
| High — modal/background and semantic gaps | `app/page.tsx:41`, `app/page.tsx:250`, `app/page.tsx:290`, `app/page.tsx:323` | Dialog background was not inert; custom leaderboard rows lacked native table relationships. During verification, a label on a generic lives div failed axe. | Inert/scroll locking, keyboard trap/return, native table headings, named image role for lives and hidden full identifiers. Final ready/dialog/populated-table axe scans pass in both engines. |
| Medium — incomplete state and persistence wording | `app/page.tsx:56`, `app/page.tsx:119`, `app/page.tsx:219`, `app/page.tsx:305` | A stale refresh could be silent, local saving was stated even if storage failed, and Boost copy blurred entry/run duration. | Guarded board refresh, stale-score notice and Retry; session-only warning when storage is blocked; explicit preview/checking/feed states; 90-second entry and 75-second run copy. Failure, storage and completion browser cases pass. |

No unresolved high/medium repository finding is being hidden as a pass. The functional/service limitations below remain explicit.

## Remaining boundaries

- Static live features depend on the existing API and its exact authorized origin. Other hosts remain usable practice sites. Changing the API's allowlist or deploying its later CORS/bearer implementation is outside this static delivery; protected `lib/` files were not changed.
- The existing account/message-signing wallet stack is retained. EIP-6963 and mobile browser links are present; a Coinbase passkey/Smart Wallet connector and contract-account signature verification are not implemented. No real wallet, passkey, wallet-app deep-link handoff or production score write was exercised.
- A real resting-to-running hardware transition and a live 75-second event were not induced. Existing event/engine tests cover persistence, timing, golden orbit accounting and deterministic replay. Browser fixture games accelerate animation timestamps and do not certify wall-clock anti-cheat enforcement.
- Nonvisual gameplay, screen readers, native 200% zoom, physical devices, exhaustive canvas/gradient contrast and animation-tool slow replay remain unverified as listed in coverage.

The live EthSkills index and its frontend UX topic were consulted for product metadata, pending/error clarity and the existing signature-only boundary. No Solidity, DeFi integration, chain change or transaction work was required.
