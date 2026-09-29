// Контраст по WCAG 2.2 для основных сочетаний макета. Без зависимостей.
// Запуск: node tools/contrast.mjs   → печатает таблицу и пишет ../contrast.md
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "styles.css"), "utf8");

function block(selector) {
  const start = css.indexOf(selector + " {");
  if (start < 0) throw new Error("Не найден блок " + selector);
  const body = css.slice(start, css.indexOf("}", start));
  const tokens = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2].toLowerCase();
  return tokens;
}
const light = block(":root");
const dark = { ...light, ...block('[data-theme="dark"]') };

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [где на экране, цвет текста/знака, фон, тип]. text — 4.5:1, ui — 3:1 (иконки, рамки, заливки).
const pairs = [
  ["Основной текст", "ink", "bg", "text"],
  ["Основной текст на сером поле ввода", "ink", "surface-2", "text"],
  ["Вторичный текст (подписи, даты)", "ink-2", "bg", "text"],
  ["Вторичный текст на карточке", "ink-2", "surface", "text"],
  ["Надпись на главной кнопке", "action-text", "action", "text"],
  ["«Верно», «Освоено» на зелёной плашке", "green-ink", "green-tint", "text"],
  ["«Сохранено», «Проверил Алекс»", "green-ink", "bg", "text"],
  ["«Почти», подсказка о формате ответа", "amber-ink", "amber-tint", "text"],
  ["«ждёт 2 дня», «есть ошибка» в таблице", "amber-ink", "bg", "text"],
  ["Выбранный вариант, активная вкладка", "blue-ink", "blue-tint", "text"],
  ["Ссылки, кнопка «Подсказка»", "blue-ink", "bg", "text"],
  ["Текст подсказки в синей карточке", "ink", "blue-tint", "text"],
  ["Текст в янтарной карточке", "ink", "amber-tint", "text"],
  ["«Маленькая победа»", "purple-ink", "purple-tint", "text"],
  ["Текст на зелёной плашке раздела", "on-green", "green", "text"],
  ["Всплывающее сообщение", "bg", "ink", "text"],
  ["Иконка на зелёном круге (готово)", "on-green", "green", "ui"],
  ["Рамка выбранного варианта", "blue", "bg", "ui"],
  ["Рамка поля ввода", "line-strong", "bg", "ui"],
  ["Рамка поля с ошибкой формата", "amber-line", "bg", "ui"],
  ["Кольцо фокуса", "focus", "bg", "ui"],
  ["Заливка прогресса на фоне экрана", "meter", "bg", "ui"],
  ["Заливка прогресса на своей дорожке", "meter", "meter-track", "ui"],
  ["Янтарная шкала «тренируем» на своей дорожке", "amber-line", "amber-tint", "ui"],
  ["Иконка на янтарном круге (тренируем)", "on-amber", "amber", "ui"],
  ["Огонёк серии", "flame", "bg", "ui"],
  ["Неактивная кнопка (WCAG не требует)", "disabled-text", "disabled-bg", "info"],
];

const need = { text: 4.5, ui: 3, info: 0 };
const rows = [];
let failures = 0;
for (const [where, fg, bg, kind] of pairs) {
  const l = ratio(light[fg], light[bg]);
  const d = ratio(dark[fg], dark[bg]);
  const verdict = (v) => (kind === "info" ? "справочно" : v >= need[kind] ? "ок" : "НИЖЕ НОРМЫ");
  if (kind !== "info" && (l < need[kind] || d < need[kind])) failures++;
  rows.push(`| ${where} | ${kind === "text" ? "текст ≥ 4.5" : kind === "ui" ? "знак ≥ 3" : "—"} | \`${light[fg]}\` на \`${light[bg]}\` | **${l.toFixed(2)}** ${verdict(l)} | \`${dark[fg]}\` на \`${dark[bg]}\` | **${d.toFixed(2)}** ${verdict(d)} |`);
}

const md = `# Контраст цветов макета

Считается скриптом \`node tools/contrast.mjs\` по токенам из \`styles.css\` (формула WCAG 2.2). Норма: обычный текст — 4.5:1, иконки, рамки и заливки, без которых не понять смысл, — 3:1.

| Где | Норма | Светлая тема | Контраст | Тёмная тема | Контраст |
|---|---|---|---|---|---|
${rows.join("\n")}

${failures ? `**Ниже нормы: ${failures}.** См. пояснения в README.` : "Все обязательные сочетания проходят норму в обеих темах."}

Для сравнения — фирменные сочетания Duolingo «как есть»: белый на зелёном \`#58cc02\` — **${ratio("#ffffff", "#58cc02").toFixed(2)}**, серый \`#777777\` на белом — **${ratio("#777777", "#ffffff").toFixed(2)}**, синий \`#1cb0f6\` на белом — **${ratio("#1cb0f6", "#ffffff").toFixed(2)}**. Поэтому в макете кнопка светлой темы темнее (\`${light.action}\`), а текст на ярких цветах идёт отдельными «чернильными» оттенками.
`;
writeFileSync(join(here, "..", "contrast.md"), md);
console.log(md);
process.exitCode = failures ? 1 : 0;
