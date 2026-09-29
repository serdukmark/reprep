// Снимки экранов макета безголовым Chrome + проверка узких экранов.
// Ничего не устанавливает: берёт Playwright, уже лежащий в node_modules проекта, и системный Chrome.
// Запуск из design-mockup: node tools/shoot.mjs
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mock = join(here, "..");
const require = createRequire(join(mock, "..", "package.json"));
const { chromium } = require("@playwright/test");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const page0 = pathToFileURL(join(mock, "index.html")).href;

const shots = [
  ["01-segodnya", "l-home"],
  ["01b-segodnya-posle-otpravki", "l-home", null, "home=after"],
  ["02-novoe-zadanie", "l-intro"],
  ["03-zadanie-chislo", "l-task-1", "filled"],
  ["03b-zadanie-oshibka-formata", "l-task-1", "invalid"],
  ["03c-zadanie-podskazka", "l-task-1", "hint"],
  ["04-zadanie-vybor", "l-task-2", "filled"],
  ["05-zadanie-obyasnenie", "l-task-3", "filled"],
  ["06-pered-otpravkoy", "l-check"],
  ["07-otpravleno", "l-sent"],
  ["08-razbor", "l-review"],
  ["09-moy-put", "l-path"],
  ["10-repetitor-proverka", "t-queue"],
  ["11-roditel-svodka", "p-summary"],
];
const url = (screen, theme, state, extra) =>
  `${page0}?shot=1&screen=${screen}&theme=${theme}${state ? "&state=" + state : ""}${extra ? "&" + extra : ""}`;

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
try {
  for (const theme of ["light", "dark"]) {
    const dir = join(mock, "screens", theme);
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ru-RU", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    for (const [name, screen, state, extra] of shots) {
      await page.goto(url(screen, theme, state, extra));
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(dir, name + ".png") });
    }
    await ctx.close();

    // Обзор: все экраны одной картинкой
    const g = await browser.newContext({ viewport: { width: 1740, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const gp = await g.newPage();
    await gp.goto(`${page0}?gallery=1&theme=${theme}`);
    await gp.waitForTimeout(800);
    await gp.screenshot({ path: join(mock, "screens", `overview-${theme}.png`), fullPage: true });
    await g.close();
  }

  // Как макет выглядит открытым на компьютере: рамка телефона и список экранов
  const d = await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
  const dp = await d.newPage();
  await dp.goto(`${page0}?theme=light#l-home`);
  await dp.waitForTimeout(600);
  await dp.screenshot({ path: join(mock, "screens", "prototype-desktop.png") });
  await d.close();

  // Узкие экраны: ищем горизонтальное переполнение на каждом экране
  const report = [];
  for (const [w, h] of [[390, 844], [360, 740], [320, 640]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    const p = await c.newPage();
    for (const [name, screen, state, extra] of shots) {
      await p.goto(url(screen, "light", state, extra));
      await p.waitForTimeout(250);
      const r = await p.evaluate(() => {
        const vw = window.innerWidth;
        const active = document.querySelector(".screen.active");
        const over = [...active.querySelectorAll("*")]
          .filter((el) => { const b = el.getBoundingClientRect(); return b.width && b.right > vw + 1 && getComputedStyle(el).position !== "absolute"; })
          .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""));
        const small = [...active.querySelectorAll("a, button, input, textarea, [role=radio]")]
          .filter((el) => { const b = el.getBoundingClientRect(); return b.width && b.height && (b.height < 44 || b.width < 44) && getComputedStyle(el).display !== "none"; })
          .map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30));
        return { page: document.documentElement.scrollWidth, over: [...new Set(over)].slice(0, 5), small: [...new Set(small)].slice(0, 6) };
      });
      report.push({ width: w, name, ...r });
    }
    await c.close();
  }
  const lines = report.map((r) => `${r.width}px  ${r.name.padEnd(28)} ширина страницы ${r.page}${r.over.length ? "  ПЕРЕПОЛНЕНИЕ: " + r.over.join(", ") : ""}${r.small.length ? "  цели < 44px: " + r.small.join(" | ") : ""}`);
  writeFileSync(join(here, "narrow-report.txt"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
} finally {
  await browser.close();
}
