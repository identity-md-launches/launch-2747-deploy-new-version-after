# Wheelkeepers

A browser arcade game for the Squeekchain community. Guide a collector around a hamster wheel, catch seeds, avoid glitches, and survive as the pace increases.

**[Play Wheelkeepers](https://wheelkeepers.dpdns.org/)**

## How to play

- Move the mouse around the wheel to aim. On a phone, hold and drag on the playfield.
- Arrow keys and A/D are also supported.
- Catch seeds to earn points and avoid glitches to protect your three hearts.
- The run continues until you lose all hearts, with increasing difficulty.

Practice is available without a wallet. Connect an Ethereum wallet and sign a message to enter the leaderboard. Playing does not require tokens, gas, transaction approvals, or NFT ownership. Wallet addresses used for ranked play are visible on the public leaderboard.

## Squeekchain integration

Live courses use data from the official Squeekchain status feed. The game shows the feed's availability and offers practice mode when live data is unavailable.

## Run locally

Requires Node.js 22.13 or newer and npm.

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Open [localhost:5173](http://localhost:5173/).

Local development uses a local database. The migrations do not connect to the deployed game's database. No production credentials are required.
## Checks

```sh
npm run typecheck
npm test
npm run build
```

## About

Wheelkeepers is an independent community project and is not an official Squeekchain product. Third-party license notices are retained alongside the corresponding assets and tools.
