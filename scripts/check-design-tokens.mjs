// Read-only design contract and contrast check. Never executes the reference generator.
// Usage: node scripts/check-design-tokens.mjs [path/to/tokens.css]
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referencePath = resolve(root, "design-mockup/styles.css");
const candidatePath = resolve(root, process.argv[2] || "apps/client/src/tokens.css");
const problems = [];

// Keep ancestry so an automatic dark rule cannot be mistaken for the light default.
function rules(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack = [];
  const found = [];
  let start = 0;
  let quote = "";
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === "{") {
      stack.push({ selector: css.slice(start, i).trim(), start: i + 1 });
      start = i + 1;
    } else if (char === "}") {
      const rule = stack.pop();
      if (!rule) throw new Error("Unbalanced closing brace in CSS");
      found.push({ ...rule, body: css.slice(rule.start, i), parents: stack.map((p) => p.selector) });
      start = i + 1;
    } else if (char === ";") start = i + 1;
  }
  if (stack.length || quote) throw new Error("Unclosed CSS block or string");
  return found.filter((rule) => !rule.selector.startsWith("@"));
}

function declarations(rule, label) {
  const tokens = {};
  for (const [, name, value] of rule.body.matchAll(/--([\w-]+)\s*:\s*([^;{}]+);/g)) {
    if (Object.hasOwn(tokens, name)) problems.push(`${label}: duplicate --${name}`);
    tokens[name] = value.trim();
  }
  return tokens;
}

function readThemeRules(path, label, automaticRequired) {
  const parsed = rules(readFileSync(path, "utf8"));
  const select = (predicate, name, required = true) => {
    const matches = parsed.filter(predicate);
    if (matches.length !== 1 && (required || matches.length)) {
      throw new Error(`${label}: expected one ${name} block, found ${matches.length}`);
    }
    return matches[0] ? declarations(matches[0], `${label} ${name}`) : null;
  };
  const hasSelector = (rule, pattern) => rule.selector.split(",").some((s) => pattern.test(s.trim()));
  const light = select((rule) => !rule.parents.length && hasSelector(rule, /^:root$/), ":root");
  const dark = select((rule) => !rule.parents.length && hasSelector(rule, /^(?::root)?\[data-theme\s*=\s*["']?dark["']?\]$/), "explicit dark");
  const automatic = select((rule) => rule.parents.some((p) => /^@media\b/.test(p) && /prefers-color-scheme\s*:\s*dark/.test(p)) && /^:root:not\(\[data-theme(?:\s*=\s*["']?light["']?)?\]\)$/.test(rule.selector), "system dark", automaticRequired);
  return { light, dark: { ...light, ...dark }, automatic: automatic && { ...light, ...automatic }, declaredDark: dark, declaredAutomatic: automatic };
}

const normalize = (value) => value.toLowerCase().replace(/\s+/g, "");
function compare(expected, actual, label) {
  for (const [name, value] of Object.entries(expected)) {
    if (!Object.hasOwn(actual, name)) problems.push(`${label}: missing --${name}`);
    else if (normalize(actual[name]) !== normalize(value)) problems.push(`${label}: --${name} is ${actual[name]}; reference requires ${value}`);
  }
  for (const name of Object.keys(actual)) {
    if (!Object.hasOwn(expected, name)) problems.push(`${label}: unapproved token --${name}`);
  }
}

function luminance(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex || "")) throw new Error(`Contrast requires a six-digit hex color, received ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

// Every pair from the immutable contrast.md, then combinations used by the product.
// Text is checked at 4.5 even when a particular label might qualify as large text.
const pairs = [
  ["Body text", "ink", "bg", 4.5],
  ["Input text", "ink", "surface-2", 4.5],
  ["Secondary text", "ink-2", "bg", 4.5],
  ["Secondary text on card", "ink-2", "surface", 4.5],
  ["Primary button", "action-text", "action", 4.5],
  ["Success badge", "green-ink", "green-tint", 4.5],
  ["Saved label", "green-ink", "bg", 4.5],
  ["Warning badge", "amber-ink", "amber-tint", 4.5],
  ["Warning text", "amber-ink", "bg", 4.5],
  ["Selected option text", "blue-ink", "blue-tint", 4.5],
  ["Link", "blue-ink", "bg", 4.5],
  ["Text on blue card", "ink", "blue-tint", 4.5],
  ["Text on amber card", "ink", "amber-tint", 4.5],
  ["Purple badge", "purple-ink", "purple-tint", 4.5],
  ["Green section text", "on-green", "green", 4.5],
  ["Toast", "bg", "ink", 4.5],
  ["Success icon", "on-green", "green", 3],
  ["Selected option border", "blue", "bg", 3],
  ["Input border", "line-strong", "bg", 3],
  ["Invalid input border", "amber-line", "bg", 3],
  ["Focus ring", "focus", "bg", 3],
  ["Progress fill on page", "meter", "bg", 3],
  ["Progress fill on track", "meter", "meter-track", 3],
  ["Amber progress fill", "amber-line", "amber-tint", 3],
  ["Amber circle icon", "on-amber", "amber", 3],
  ["Streak icon", "flame", "bg", 3],
  ["Disabled button (informational)", "disabled-text", "disabled-bg", 0],
  ["Secondary text on input", "ink-2", "surface-2", 4.5],
  ["Secondary text on green", "ink-2", "green-tint", 4.5],
  ["Secondary text on blue", "ink-2", "blue-tint", 4.5],
  ["Secondary text on amber", "ink-2", "amber-tint", 4.5],
  ["Secondary text on purple", "ink-2", "purple-tint", 4.5],
  ["Input border inside field", "line-strong", "surface-2", 3],
  ["Input border on card", "line-strong", "surface", 3],
  ["Selected border inside option", "blue", "blue-tint", 3],
  ["Streak icon on card", "flame", "surface", 3],
  ["Success text on input", "green-ink", "surface-2", 4.5],
  ["Primary button hover", "action-text", "action-lip", 4.5],
  ["Purple text on card", "purple-ink", "surface", 4.5],
  ["Text on green card", "ink", "green-tint", 4.5],
  ["Text on purple card", "ink", "purple-tint", 4.5],
  ["Focus ring on input", "focus", "surface-2", 3],
  ["Focus ring on card", "focus", "surface", 3],
];

try {
  if (process.argv.length > 3) throw new Error("Usage: node scripts/check-design-tokens.mjs [path/to/tokens.css]");
  const reference = readThemeRules(referencePath, "Reference", false);
  const candidate = readThemeRules(candidatePath, "Product", true);
  if (Object.keys(reference.light).length !== 36) throw new Error("Reference contract changed: expected 36 global tokens");
  compare(reference.light, candidate.light, "Light");
  compare(reference.dark, candidate.dark, "Explicit dark");
  compare(reference.dark, candidate.automatic, "System dark");
  for (const [theme, tokens] of [["Light", candidate.light], ["Dark", candidate.dark]]) {
    console.log(`\n${theme} theme contrast`);
    console.log("Pair | Tokens | Ratio | Minimum | Result");
    for (const [label, foreground, background, minimum] of pairs) {
      const ratio = contrast(tokens[foreground], tokens[background]);
      const result = minimum === 0 ? "INFO" : ratio >= minimum ? "PASS" : "FAIL";
      console.log(`${label} | --${foreground} / --${background} | ${ratio.toFixed(2)}:1 | ${minimum || "exempt"} | ${result}`);
      if (result === "FAIL") problems.push(`${theme}: ${label} has ${ratio.toFixed(2)}:1 contrast; requires ${minimum}:1`);
    }
  }
  if (problems.length) {
    console.error(`\nDesign checks failed (${problems.length}):\n${problems.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`\nPASS: all 36 reference tokens match; explicit and system dark match; ${(pairs.length - 1) * 2} required contrast checks pass, plus two disabled-state informational checks.`);
    console.log("This checks token pairs; browser checks must also verify the colors actually used by controls.");
  }
} catch (error) {
  console.error(`Design check failed: ${error.message}`);
  process.exitCode = 1;
}
