// High-resolution UI screenshots for the video (1440x900 at 2x = 2880x1800).
// Reads pages only; nothing in DocAI is changed.
//
//   DOCAI_URL   the DocAI with real data (default http://localhost:4310)
//   SAMPLE_URL  a DocAI holding the sample invoice from docs/samples (default http://localhost:4320)
//   SAMPLE_DOC  that invoice's document id
//   WIZARD_URL  a DocAI build with the AI setup wizard (default http://localhost:4321)
//
// Usage: node scripts/capture.mjs [name ...]   (no names: capture all)
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "assets", "screens");
const DOCAI = process.env.DOCAI_URL || "http://localhost:4310";
const SAMPLE = process.env.SAMPLE_URL || "http://localhost:4320";
const SAMPLE_DOC = process.env.SAMPLE_DOC || "le2tgiqlfai3ptmti2q66";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Click the first button inside the mini app's iframe whose text matches. */
async function clickInApp(page, text) {
  for (const frame of page.frames()) {
    const clicked = await frame.evaluate((t) => {
      const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === t);
      if (!button) return false;
      button.click();
      return true;
    }, text).catch(() => false);
    if (clicked) return;
  }
  throw new Error(`No "${text}" button in the app`);
}

/**
 * The AI setup wizard, opened from Settings → Processing → Change AI provider
 * (WIZARD_URL: a DocAI build that has it). Captures only the dialog. Nothing
 * is saved: the dialog is closed without finishing.
 */
const WIZARD = process.env.WIZARD_URL || "http://localhost:4321";
async function wizard(page, provider) {
  await page.locator("::-p-text(Processing)").click();
  await page.locator('[data-testid="ai-setup-open-btn"]').click();
  await wait(1200);
  await page.locator(`[data-testid="ai-setup-choice-${provider}"]`).click();
  await page.mouse.move(4, 4);
  await wait(500);
}
async function wizardStep(page, provider) {
  await wizard(page, provider);
  await page.locator('[data-testid="ai-setup-next"]').click();
  await page.mouse.move(4, 4);
  await wait(2500); // the Ollama check, the local model status
}

const SHOTS = {
  "wizard-choose": { url: `${WIZARD}/settings`, then: (page) => wizard(page, "local"), element: '[data-testid="ai-setup-wizard"]' },
  "wizard-local": { url: `${WIZARD}/settings`, then: (page) => wizardStep(page, "local"), element: '[data-testid="ai-setup-wizard"]' },
  "wizard-ollama": { url: `${WIZARD}/settings`, then: (page) => wizardStep(page, "ollama"), element: '[data-testid="ai-setup-wizard"]' },
  "wizard-cloud": { url: `${WIZARD}/settings`, then: (page) => wizardStep(page, "anthropic"), element: '[data-testid="ai-setup-wizard"]' },
  // Files & Folders, the Lunch folder of the real drive
  drive: { url: `${DOCAI}/folder/27v48w3c8e78dgao5et6d` },
  apps: { url: `${DOCAI}/apps` },
  // Monthly Expenses, September (the app opens on the current month)
  expenses: {
    url: `${DOCAI}/app/wemqams2wykexa3w6qm3w`,
    then: async (page) => { await clickInApp(page, "‹"); await wait(2500); },
  },
  reconciliation: { url: `${DOCAI}/app/jmzh57q2u3hkb8cproovg` },
  // The sample invoice: folder list, extracted fields, line items
  "sample-list": { url: `${SAMPLE}/folder` },
  "sample-fields": { url: `${SAMPLE}/document/${SAMPLE_DOC}`, settle: 10000 },
  "sample-items": {
    url: `${SAMPLE}/document/${SAMPLE_DOC}`,
    settle: 10000,
    then: async (page) => {
      await page.locator("::-p-text(Invoice Items)").click();
      await wait(1500);
    },
  },
};

const chrome = execSync("npx --yes hyperframes@0.8.220 browser path", { encoding: "utf8" })
  .trim().split("\n").pop();
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
fs.mkdirSync(OUT, { recursive: true });
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
try {
  for (const name of names) {
    const shot = SHOTS[name];
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await page.goto(shot.url, { waitUntil: "networkidle0", timeout: 60000 });
    await wait(shot.settle ?? 3000);
    if (shot.then) await shot.then(page);
    const file = path.join(OUT, `${name}.png`);
    if (shot.element) await (await page.$(shot.element)).screenshot({ path: file });
    else await page.screenshot({ path: file });
    console.log(`[capture] ${name} -> ${path.relative(ROOT, file)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
