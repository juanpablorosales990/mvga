import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const OUT_DIR = path.resolve(process.cwd(), 'output', 'playwright');
fs.mkdirSync(OUT_DIR, { recursive: true });

function ts() {
  // Local time is fine for filenames; keep it filesystem-friendly.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
}

const RUN_ID = ts();

const targets = [
  { name: 'mvga-io-home', url: 'https://mvga.io/' },
  { name: 'mvga-io-transparency', url: 'https://mvga.io/transparency' },
  { name: 'app-mvga-io', url: 'https://app.mvga.io/' },
];

const consoleLog = [];

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    consoleLog.push({
      type: 'console',
      level: msg.type(),
      text: msg.text(),
      url: page.url(),
    });
  });
  page.on('pageerror', (err) => {
    consoleLog.push({
      type: 'pageerror',
      message: String(err?.message || err),
      url: page.url(),
    });
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure();
    consoleLog.push({
      type: 'requestfailed',
      url: page.url(),
      requestUrl: req.url(),
      method: req.method(),
      failure: failure ? failure.errorText : 'unknown',
    });
  });

  for (const t of targets) {
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(750);
    const file = path.join(OUT_DIR, `${t.name}-${RUN_ID}.png`);
    await page.screenshot({ path: file, fullPage: true });
    // eslint-disable-next-line no-console
    console.log(`screenshot:${file}`);
  }

  const logFile = path.join(OUT_DIR, `console-${RUN_ID}.json`);
  fs.writeFileSync(logFile, JSON.stringify(consoleLog, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`console:${logFile}`);
} finally {
  await browser.close();
}

