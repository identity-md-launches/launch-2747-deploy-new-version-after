# Wheelkeepers

A free Squeekchain arcade powered by a real hamster. Aim a collector around the wheel, catch gold seeds and dodge blue glitches as the pace increases.

The ready-to-host website is **`dist/index.html` and the rest of `dist/`**. Its JavaScript, CSS, fonts, favicon and share image are bundled locally, with relative asset URLs for static hosting at a subpath. `web/main.tsx` renders the existing game in `app/page.tsx`; it uses the same simulation and artwork as the Worker application.

[Open the live arcade](https://wheelkeepers-a-little-hamster-a.imd.site) · [Canonical game and API](https://wheelkeepers.dpdns.org/) · [Upstream repository](https://github.com/xqsy/wheelkeepers)

## Install, rebuild and preview

Requires Node.js 22.13 or newer and npm. Use the supplied, unchanged `package-lock.json`.

```sh
npm ci
node scripts/typecheck-static.mjs
node scripts/build-static.mjs
node scripts/preview-static.mjs
```

Open **http://localhost:4173/preview/**. The preview deliberately serves a subpath, so relative asset failures are observable. Change the port with `--port 8080`. Stop it with Ctrl+C. Rebuild after changing source; the preview serves the new files on reload.

`build-static.mjs` writes a fresh production export to `dist/`. Keep every file it produces, including the hashed assets and font licenses. It removes the superseded export and duplicate public font binaries. No server, database, credentials, package cache or dependency directory belongs in the upload. Hosting of this export is handled by the contributor network after submission; this task does not run a publishing command.

The build and static typecheck also accept `--toolchain /path/to/toolchain`, where that directory has dependencies installed from this repository's manifest and lockfile. This allows checks without writing dependency directories into the checkout. No new application dependency or package-manifest change is required.

## Play

- **Mouse:** move around the wheel to aim the gold collector.
- **Touch:** hold and drag on the game field.
- **Keyboard:** hold Left/Right or A/D. Escape or Exit leaves the run without submitting it.
- Seeds earn 50 points. Every three consecutive seeds adds +10 per catch, up to +50. Blue glitches cost a life; three lost lives end the run.
- Sound starts with the Play gesture and can be muted using the speaker control. Audio support is optional; a sound failure does not prevent play.

Practice works without an account or network. Arcade and Practice Boost have separate device bests. If browser storage is blocked, the result explains that the best lasts only until the page is closed or reloaded.

## Shared scores and live Boost

Live features use the existing public API at `https://wheelkeepers.dpdns.org/api/`. The approved static origin is `https://wheelkeepers-a-little-hamster-a.imd.site`. Other static hosts, localhost previews and shared IPFS gateways show an explicit practice view; they do not fabricate a shared leaderboard or hardware events. Open the approved live arcade to compete. Moving live features to another hostname requires the API owner's corresponding origin authorization; the client cannot grant that itself.

Static wallet sessions use origin-bound bearer authentication in the current tab's session storage, with cross-site cookies omitted. The canonical game and original local Worker entry retain same-origin cookie requests. The client checks service compatibility before requesting wallet access, checks the sign-in message's site, and handles HTML errors and timeouts with a readable recovery message.

Wallet sign-in requests account access and one message signature. It never asks for a transaction, token approval or chain switch. The sheet discovers browser wallets with EIP-6963 and offers mobile browser links for MetaMask, Coinbase Wallet, Rabby and Phantom. This revision retains the project's existing account/message-signing connector stack; a Coinbase passkey/Smart Wallet connector and contract-account signature verification are not implemented or claimed.

On the live service, a newly observed hardware transition from resting to running opens a shared **90-second entry window**. A Boost run lasts up to **75 seconds** or three lost lives. The event freezes the seed and starting RPM. Golden sequences appear at 12, 30, 48 and 66 seconds; catch all 12 seeds in a sequence for +500. Started events survive a rest or feed outage. Activity entirely between server observations can be missed. Boost scores use a separate event leaderboard; Practice Boost never submits a ranked score.

The static export contains the frontend. The deployed API and its database must remain available for shared scores, authentication and hardware events. This task updates no onchain contract or production API state. The protected `lib/` backend snapshot remains unchanged; the deployed API's later CORS/bearer implementation is maintained upstream.

## Original Worker development

The existing framework and build configuration are preserved. To work on the local Worker and local D1 database:

```sh
npm run db:migrate:local
npm run dev
```

Open http://localhost:5173/. Migrations apply only to the local development database. `npm run build` produces the framework/Worker build; run `node scripts/build-static.mjs` afterward to prepare the static `dist/` upload described above.

## Validation

```sh
npm test
node --experimental-strip-types --test tests/static-client.test.mjs
npm run typecheck
node scripts/typecheck-static.mjs
npm run build
node scripts/build-static.mjs
node scripts/check-static.mjs
```

Final results on 30 October 2026: **20 core tests + 6 API-client tests passed**, full and static typechecks passed, original Worker and static production builds passed, **26 browser validation groups passed in Chromium/WebKit**, and the design probe passed **16/16**. The live API passed three read-only browser requests. Real wallets, physical phones, native zoom and screen readers remain untested; fixture signatures never reached production.

Optional browser validation uses Playwright and axe installed **outside this repository**:

```sh
npm install --prefix /tmp/wheelkeepers-browser-tools --cache /tmp/wheelkeepers-browser-cache playwright@1.64.1 @axe-core/playwright@4.14.0
/tmp/wheelkeepers-browser-tools/node_modules/.bin/playwright install chromium webkit
node --experimental-strip-types tests/static-browser.mjs \
  --playwright /tmp/wheelkeepers-browser-tools/node_modules/playwright/index.mjs \
  --axe /tmp/wheelkeepers-browser-tools/node_modules/@axe-core/playwright/dist/index.js \
  --out test/scratch/browser-validation
```

The browser test owns and closes its static preview. It checks the real production export, uses explicitly intercepted browser fixtures for wallet signatures and ranked writes, and performs read-only requests against the live API. Fixture games use accelerated animation timestamps; simulation/checkpoint equivalence is checked independently with the shared engine. No production scores or accounts are created by this check. Headless WebKit requires its platform libraries and a working software EGL runtime.

Actual results, screenshots, six-domain Better Interface coverage, resolved findings and remaining limitations are recorded in [VALIDATION.md](VALIDATION.md). Implemented design tokens and components are documented in [DESIGN.md](DESIGN.md).

## About and attribution

Wheelkeepers is an independent community project, not an official Squeekchain product. It grants no tokens or NFT rights. Barlow Condensed and IBM Plex Mono retain their font licenses in `public/fonts/` and the export. The LED hamster mark, canvas art, gameplay and replay engine continue the existing project. The static API and default-audio fixes follow upstream commit `03a1b92e82a3f48c8544ccf92b79317da3380c3e` (30 October 2026), adapted to this checkout's permitted paths.

Design review uses Jakub Krehel's Better Interface (MIT); documentation method is adapted from Paul Bakaus's Impeccable (Apache-2.0). Attribution and license texts are retained in [vendor/design-guidance-LICENSE.txt](vendor/design-guidance-LICENSE.txt).
