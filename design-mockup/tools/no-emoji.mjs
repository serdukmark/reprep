// Страж правила «в интерфейсе нет эмодзи». Запуск из design-mockup: node tools/no-emoji.mjs
// 1) исходники: каждый текстовый файл макета построчно;
// 2) отрисованная страница: текст всех экранов, подписи для экранного диктора, всплывающие сообщения
//    и CSS-content, во всех состояниях — эмодзи мог прийти из скрипта или стилей;
// 3) награды нарисованы: у серии, наград и праздника должен быть SVG-значок, а не символ.
// Код выхода 1 — нарушение. Ничего не устанавливает: Playwright берётся из node_modules проекта.
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mock = join(here, "..");
// Эмодзи и всё, что их собирает: пиктограммы, вариационный селектор, флаги, «клавиша».
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/u;
const TEXT = new Set([".html", ".css", ".js", ".mjs", ".md", ".txt", ".json", ".svg"]);
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== "screens") walk(path); continue; }
    if (!TEXT.has(extname(name))) continue;
    readFileSync(path, "utf8").split("\n").forEach((line, i) => {
      const found = [...line].filter((ch) => EMOJI.test(ch));
      if (found.length) problems.push(`${relative(mock, path)}:${i + 1}  ${found.join(" ")}  ${line.trim().slice(0, 90)}`);
    });
  }
}
walk(mock);

const require = createRequire(join(mock, "..", "package.json"));
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
try {
  const page = await browser.newPage({ viewport: { width: 1740, height: 1000 } });
  const base = pathToFileURL(join(mock, "index.html")).href;
  for (const query of ["gallery=1", "gallery=1&state=invalid", "gallery=1&state=hint", "gallery=1&home=after"]) {
    await page.goto(`${base}?${query}`);
    const found = await page.evaluate((source) => {
      const re = new RegExp(source, "u");
      const hits = [];
      const check = (where, text) => { if (text && re.test(text)) hits.push(`${where}: ${text.trim().slice(0, 80)}`); };
      check("текст экранов", document.body.innerText);
      for (const el of document.querySelectorAll("*")) {
        for (const attr of ["aria-label", "title", "placeholder", "alt", "data-toast", "data-title"]) check(`[${attr}]`, el.getAttribute(attr));
        for (const pseudo of ["::before", "::after"]) {
          const content = getComputedStyle(el, pseudo).content;
          if (content && content !== "none" && content !== "normal") check(`CSS ${pseudo}`, content);
        }
      }
      // Награды и прогресс нарисованы, а не набраны символом
      const drawn = {
        "огонёк серии": [...document.querySelectorAll(".streak, .streak-up")].every((el) => el.querySelector("svg use[href='#i-flame']")),
        "награда": [...document.querySelectorAll(".medal, .chip.purple")].every((el) => el.querySelector("svg")),
        "праздник «Отправлено»": !!document.querySelector(".burst .core svg"),
        "узлы пути": [...document.querySelectorAll(".path .dot")].every((el) => el.querySelector("svg")),
      };
      for (const [name, ok] of Object.entries(drawn)) if (!ok) hits.push(`${name}: нет SVG-значка`);
      return hits;
    }, EMOJI.source);
    for (const hit of found) problems.push(`index.html?${query}  ${hit}`);
  }
} finally {
  await browser.close();
}

if (problems.length) {
  console.log("Найдены эмодзи или ненарисованные значки:\n" + problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Эмодзи нет: исходники, текст всех экранов и состояний, подписи и CSS чистые; серия, награды, праздник и путь нарисованы SVG.");
}
