// Source-only guard for authored interface icons. Does not alter learner/user content.
// Usage: node scripts/check-design-emoji.mjs [file-or-directory ...]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = process.argv.slice(2).map((path) => resolve(root, path));
if (!paths.length) paths.push(resolve(root, "apps/client"));
const extensions = new Set([".html", ".css", ".js", ".mjs", ".jsx", ".ts", ".tsx", ".json", ".svg"]);
const ignoredDirectories = new Set(["node_modules", "dist", ".git"]);
// Digits, #, and * are legal text. The keycap combining mark is forbidden separately.
const emoji = /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/u;
// These text-presentation substitutes are also icons: use the existing SVG set.
const textIcon = /[\u2713\u2714\u2715\u2716\u2717\u2718]/u;
const problems = [];
let files = 0;

function point(value, radix) {
  const n = parseInt(value, radix);
  return n <= 0x10ffff ? String.fromCodePoint(n) : "\uFFFD";
}

function decoded(line, css) {
  let text = line
    .replace(/&#x([\da-f]+);/gi, (_, value) => point(value, 16))
    .replace(/&#(\d+);/g, (_, value) => point(value, 10));
  if (css) {
    // CSS permits one to six hex digits followed by optional whitespace.
    text = text.replace(/\\([\da-f]{1,6})(?:\r\n|[ \t\r\n\f])?/gi, (_, value) => point(value, 16));
  } else {
    text = text.replace(/\\u\{([\da-f]{1,6})\}|\\u([\da-f]{4})|\\x([\da-f]{2})/gi,
      (_, codePoint, unit, byte) => point(codePoint || unit || byte, 16));
  }
  return text;
}

function inspect(path) {
  if (!existsSync(path)) throw new Error(`Missing source path: ${relative(root, path)}`);
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path).sort()) {
      if (!ignoredDirectories.has(name)) inspect(resolve(path, name));
    }
    return;
  }
  if (!extensions.has(extname(path))) return;
  files++;
  readFileSync(path, "utf8").split(/\r?\n/).forEach((line, index) => {
    const hits = new Set([...line, ...decoded(line, extname(path) === ".css")]
      .filter((char) => emoji.test(char) || textIcon.test(char))
      .map((char) => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`));
    if (hits.size) problems.push(`${relative(root, path)}:${index + 1}: ${[...hits].join(", ")} — use an SVG icon`);
  });
}

try {
  for (const path of paths) inspect(path);
  if (!files) throw new Error("No client source files were checked");
  if (problems.length) {
    console.error(`Interface icon guard failed (${problems.length} lines):\n${problems.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${files} client source files contain no emoji or text icon substitutes, including CSS/Unicode escapes and numeric HTML entities.`);
    console.log("Source check only; generated/runtime content needs browser verification. User content is never stripped or modified.");
  }
} catch (error) {
  console.error(`Interface icon check failed: ${error.message}`);
  process.exitCode = 1;
}
