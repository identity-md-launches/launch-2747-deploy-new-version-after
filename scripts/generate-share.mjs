import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const i = process.argv.indexOf('--playwright');
const module = i < 0 ? 'playwright' : process.argv[i + 1];
const { chromium } = await import(module);
const font = await readFile(resolve(root, 'public/fonts/barlow-condensed-latin-600-normal.woff2'));
const hamster = await readFile(resolve(root, 'public/hamster-mark.svg'), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
    @font-face{font-family:Barlow;src:url(data:font/woff2;base64,${font.toString('base64')});font-weight:600}
    *{box-sizing:border-box}body{margin:0;background:#0b0b0d;color:#f2f2f4;font-family:Arial,sans-serif}
    main{width:1200px;height:630px;padding:64px;display:flex;align-items:center;gap:64px;background-image:radial-gradient(#24242e 1px,transparent 1px);background-size:12px 12px}
    .copy{width:630px;background:#0b0b0d;padding-block:20px}h1{font:600 80px/1.02 Barlow,sans-serif;margin:22px 0;color:#ffc048;letter-spacing:-1px}p{font-size:23px;line-height:1.5;color:#a3a3b2;margin:0 0 32px}.brand{font-size:24px;letter-spacing:1px}.play{display:inline-block;padding:16px 32px;background:#ffc048;color:#070709;font-weight:600;font-size:22px;border-radius:8px}.mark{width:330px;flex-shrink:0}.mark svg{width:100%;height:auto}
  </style><main><div class="copy"><span class="brand">Wheelkeepers</span><h1>Keep the wheel alive.</h1><p>A Squeekchain arcade powered by a real hamster.</p><span class="play">Play free ↗</span></div><div class="mark">${hamster}</div></main></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(root, 'public/share.png'), type: 'png' });
  console.log('Generated public/share.png (1200 × 630).');
} finally { await browser.close(); }
