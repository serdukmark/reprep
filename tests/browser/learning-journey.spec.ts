import {
  test as base,
  expect,
  APIRequestContext,
  Locator,
  Page,
} from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { choose } from "./audit-fixtures";

type JourneyFixture = { tutor: string; learner: string; relationship: string };
const subject = "Синтетическая алгебра: путь";
const title = "Синтетическая работа для серии";
const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
const artifactRoot = "artifacts/journey-integration";

async function json(
  request: APIRequestContext,
  method: string,
  url: string,
  token = "",
  data?: unknown,
) {
  const response = await request.fetch(url, {
    method,
    headers: headers(token),
    data,
  });
  expect(
    response.ok(),
    `${method} ${url}: HTTP ${response.status()}`,
  ).toBeTruthy();
  return response.json();
}

// This suite deliberately resets only the synthetic demo on an isolated local
// server. Checking its address and AI engine happens before any mutation.
const test = base.extend<{ journey: JourneyFixture }>({
  journey: async ({ request, baseURL }, use) => {
    if (
      !baseURL ||
      !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)
    )
      throw Error("Learning journey tests require an isolated loopback server");
    const config = await json(request, "GET", "/api/config");
    expect(config.assessment).toBe("local_rules");
    expect(config.learning_journey_enabled).toBe(true);
    const initial = await json(request, "POST", "/api/auth/demo/tutor");
    const tutor = (
      await json(request, "POST", "/api/demo/reset", initial.token)
    ).token;
    const learner = (await json(request, "POST", "/api/auth/demo/learner"))
      .token;
    const invitation = await json(request, "POST", "/api/invitations", tutor, {
      subject,
    });
    await json(request, "POST", "/api/invitations/accept", learner, {
      token: invitation.token,
    });
    const relations = await json(request, "GET", "/api/relationships", learner);
    const relationship = relations.find(
      (row: { subject: string }) => row.subject === subject,
    ).id;
    await use({ tutor, learner, relationship });
  },
});

async function enter(page: Page, token: string) {
  await page.addInitScript(
    (value) => sessionStorage.setItem("reprep.session", value),
    token,
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Мой прогресс", exact: true }),
  ).toBeVisible();
}

async function selectJourney(page: Page, relationship: string) {
  await choose(
    page.getByRole("combobox", { name: "Обучение для серии" }),
    relationship,
  );
  await expect(page.getByTestId("journey-streak")).toContainText(subject);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${artifactRoot}/${name}.png`,
    fullPage: true,
  });
}

async function narrowScreenshot(page: Page, name: string) {
  await page.setViewportSize({ width: 320, height: 800 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  // System Chrome may repeat viewport tiles in tall fullPage mobile captures.
  // Keep this a literal phone viewport; widgets receive dedicated captures below.
  await page.screenshot({ path: `${artifactRoot}/${name}-320.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function widgetScreenshot(
  page: Page,
  widget: Locator,
  name: string,
  width: number,
) {
  const previous = page.viewportSize()!;
  await page.setViewportSize({ width, height: width === 320 ? 800 : 1000 });
  await widget.scrollIntoViewIfNeeded();
  // Capture the entire widget in one frame without Chrome fullPage stitching.
  const height = await widget.evaluate(
    (element) => Math.ceil(element.getBoundingClientRect().height) + 100,
  );
  await page.setViewportSize({ width, height: Math.max(height, 800) });
  await widget.scrollIntoViewIfNeeded();
  await widget.screenshot({ path: `${artifactRoot}/${name}.png` });
  await checkWidgetContrast(widget, name);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.setViewportSize(previous);
}

async function inspectPathAtPhoneWidth(page: Page, path: Locator) {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const state of ["confirmed", "current", "locked"]) {
    const node = path.locator(`[data-state="${state}"]`);
    await node.scrollIntoViewIfNeeded();
    // Allow subpixel IntersectionObserver rounding; horizontal bounds below
    // remain strict and catch genuine clipping at the 320 px viewport.
    await expect(node).toBeInViewport({ ratio: 0.999 });
    const box = await node.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    await page.screenshot({
      path: `${artifactRoot}/path-node-${state}-320.png`,
    });
  }
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await widgetScreenshot(page, path, "path-widget-320", 320);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await widgetScreenshot(page, path, "path-widget-desktop", 1440);
}

async function integratedThemes(page: Page, widget: Locator, name: string) {
  // Exercise the real bundled CSS and OS preference, without injected tokens.
  const originalTheme = await page.locator("html").getAttribute("data-theme");
  const originalDark = await page.evaluate(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  await page
    .locator("html")
    .evaluate((root) => root.removeAttribute("data-theme"));
  try {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        theme === "light" ? "rgb(255, 255, 255)" : "rgb(19, 31, 36)",
      );
      await expect(page.locator("body")).toHaveCSS("font-size", "17px");
      await widgetScreenshot(
        page,
        widget,
        `integrated-${name}-${theme}-desktop`,
        1440,
      );
      await widgetScreenshot(
        page,
        widget,
        `integrated-${name}-${theme}-320`,
        320,
      );
    }
  } finally {
    await page.emulateMedia({ colorScheme: originalDark ? "dark" : "light" });
    await page.locator("html").evaluate((root, value) => {
      if (value === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", value);
    }, originalTheme);
  }
}

type Color = [number, number, number, number];
type Measurement = {
  element: string;
  kind: string;
  foreground: Color;
  background: Color;
  ratio: number;
  minimum: number;
};

// Chromium native progress pseudo-elements cannot be reliably queried through
// getComputedStyle. Decode its screenshot to measure the actually painted fill.
function pngPixel(png: Buffer, fraction: number): Color {
  let width = 0,
    height = 0,
    channels = 0;
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset);
    const kind = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + size);
    if (kind === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8], "8-bit screenshot PNG").toBe(8);
      expect([2, 6], "RGB or RGBA screenshot PNG").toContain(data[9]);
      expect(data[12], "Non-interlaced screenshot PNG").toBe(0);
      channels = data[9] === 6 ? 4 : 3;
    }
    if (kind === "IDAT") chunks.push(data);
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    expect(filter, "Supported PNG scanline filter").toBeLessThanOrEqual(4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= channels ? pixels[i - channels] : 0;
      const b = y > 0 ? pixels[i - stride] : 0;
      const c = y > 0 && x >= channels ? pixels[i - stride - channels] : 0;
      const prediction = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][
        filter
      ];
      pixels[i] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
  }
  const x = Math.max(0, Math.min(width - 1, Math.floor(width * fraction)));
  const i = (Math.floor(height / 2) * width + x) * channels;
  return [
    pixels[i],
    pixels[i + 1],
    pixels[i + 2],
    channels === 4 ? pixels[i + 3] / 255 : 1,
  ];
}

async function checkWidgetContrast(widget: Locator, name: string) {
  const measurements: Measurement[] = await widget.evaluate((root) => {
    type Color = [number, number, number, number];
    const parse = (value: string): Color => {
      const c = value.match(/[\d.]+/g)?.map(Number) || [];
      if (c.length < 3) throw Error(`Unsupported computed color: ${value}`);
      return [c[0], c[1], c[2], c[3] ?? 1];
    };
    const over = (top: Color, bottom: Color): Color => [
      top[0] * top[3] + bottom[0] * (1 - top[3]),
      top[1] * top[3] + bottom[1] * (1 - top[3]),
      top[2] * top[3] + bottom[2] * (1 - top[3]),
      1,
    ];
    const background = (element: Element | null): Color => {
      const ancestors: Element[] = [];
      for (let current = element; current; current = current.parentElement)
        ancestors.unshift(current);
      return ancestors.reduce<Color>(
        (color, item) =>
          over(parse(getComputedStyle(item).backgroundColor), color),
        [255, 255, 255, 1],
      );
    };
    const luminance = (c: Color) =>
      c
        .slice(0, 3)
        .map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const results: Measurement[] = [];
    const record = (
      element: Element,
      kind: string,
      foreground: Color,
      bg: Color,
      minimum: number,
    ) => {
      const a = luminance(over(foreground, bg)),
        b = luminance(bg);
      results.push({
        element: `${element.tagName.toLowerCase()}.${element.getAttribute("class") || ""} ${(element.textContent || element.getAttribute("aria-label") || "").trim().slice(0, 70)}`,
        kind,
        foreground,
        background: bg,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        minimum,
      });
    };
    for (const element of [root, ...root.querySelectorAll("*")]) {
      const style = getComputedStyle(element);
      if (
        !element.getClientRects().length ||
        style.visibility === "hidden" ||
        Number(style.opacity) < 1 ||
        element.matches(":disabled")
      )
        continue;
      const bg = background(element);
      const text = [...element.childNodes].some(
        (child) =>
          child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
      if (text) {
        const large =
          parseFloat(style.fontSize) >= 24 ||
          (parseFloat(style.fontSize) >= 18.66 &&
            parseInt(style.fontWeight) >= 700);
        record(element, "text", parse(style.color), bg, large ? 3 : 4.5);
      }
      if (element.tagName.toLowerCase() === "svg")
        record(element, "status icon", parse(style.color), bg, 3);
      if (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0)
        record(
          element,
          "focus or selected outline",
          parse(style.outlineColor),
          background(element.parentElement),
          3,
        );
    }
    return results;
  });
  for (const progress of await widget.locator("progress").all()) {
    const details = await progress.evaluate((element: HTMLProgressElement) => ({
      value: element.value,
      max: element.max,
      label: element.getAttribute("aria-label") || "progress",
      track: getComputedStyle(element).backgroundColor,
    }));
    if (details.value <= 0) continue;
    const shot = await progress.screenshot();
    const amount = details.value / details.max;
    const fill = pngPixel(shot, amount / 2);
    const track =
      amount < 1
        ? pngPixel(shot, amount + (1 - amount) / 2)
        : ([...details.track.match(/[\d.]+/g)!.map(Number), 1].slice(
            0,
            4,
          ) as Color);
    const luminance = (c: Color) =>
      c
        .slice(0, 3)
        .map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const a = luminance(fill),
      b = luminance(track);
    measurements.push({
      element: details.label,
      kind: "painted progress fill / track",
      foreground: fill,
      background: track,
      ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      minimum: 3,
    });
  }
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(
    `${artifactRoot}/${name}-contrast.json`,
    JSON.stringify(measurements, null, 2) + "\n",
  );
  expect(
    measurements.length,
    "Actual journey content was measured",
  ).toBeGreaterThan(0);
  expect(
    measurements.filter((entry) => entry.ratio < entry.minimum),
    `Computed journey contrast: ${name}`,
  ).toEqual([]);
}

async function noEmoji(region: Locator) {
  const copy = await region.evaluate((root) =>
    [root, ...root.querySelectorAll("*")]
      .map((node) =>
        [
          node.textContent,
          node.getAttribute("aria-label"),
          node.getAttribute("title"),
          getComputedStyle(node, "::before").content,
          getComputedStyle(node, "::after").content,
        ].join(" "),
      )
      .join(" "),
  );
  expect(copy).not.toMatch(
    /[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3\u2605\u2606]/u,
  );
  expect(await region.locator("svg").count()).toBeGreaterThan(0);
}

async function createWork(request: APIRequestContext, journey: JourneyFixture) {
  const now = new Date();
  const weekEnd = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 7 - ((now.getUTCDay() + 6) % 7),
  );
  const due_at = new Date(
    Math.min(now.getTime() + 3600000, weekEnd - 1),
  ).toISOString();
  const tasks = ["Дроби", "Дроби", "Линейные уравнения"].map((skill, i) => ({
    id: `task-${i + 1}`,
    type: "short_text",
    prompt: `Объясните шаг ${i + 1} решения.`,
    answer: "",
    rubric: "Понятно объяснить равенство.",
    skill,
    options: [],
    hint: "",
  }));
  const work = await json(request, "POST", "/api/assignments", journey.tutor, {
    relationship_id: journey.relationship,
    title,
    instructions: "Синтетические данные для локальной проверки.",
    due_at,
    feedback_policy: "after_review",
    tasks,
  });
  await json(
    request,
    "POST",
    `/api/assignments/${work.id}/publish`,
    journey.tutor,
  );
  await json(
    request,
    "PUT",
    `/api/relationships/${journey.relationship}/skill-graph`,
    journey.tutor,
    {
      revision: 0,
      skills: ["Дроби", "Линейные уравнения", "Квадратные уравнения"],
      edges: [
        { prerequisite: "Дроби", skill: "Линейные уравнения" },
        { prerequisite: "Линейные уравнения", skill: "Квадратные уравнения" },
      ],
    },
  );
  return work;
}

test("journey uses real submissions, TXT progress and tutor-confirmed skill states", async ({
  page,
  request,
  journey,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const work = await createWork(request, journey);
  await enter(page, journey.learner);
  await selectJourney(page, journey.relationship);
  await expect(page.getByTestId("journey-streak")).toContainText(
    "Серия ещё не началась",
  );
  await page.getByRole("button", { name: "Мой путь", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Мой путь", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("journey-path").locator('[data-state="current"]'),
  ).toContainText("Дроби");
  await expect(
    page.getByTestId("journey-path").locator('[data-state="locked"]'),
  ).toHaveCount(2);
  await expect(
    page.getByTestId("journey-path").locator('[data-state="confirmed"]'),
  ).toHaveCount(0);
  await screenshot(page, "path-before-review-desktop");
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  const progress = page.getByRole("progressbar", { name: "Ответы в работе" });
  await expect(progress).toHaveAttribute("value", "0");
  await expect(progress).toHaveAttribute("max", "3");
  await page.getByLabel("Ответ на задание 1").fill("   ");
  await expect(progress).toHaveAttribute("value", "0");
  await page
    .getByLabel("Ответ на задание 1")
    .fill("Дробная черта означает деление.");
  await expect(progress).toHaveAttribute("value", "1");
  await page.getByLabel("TXT к заданию 2").setInputFiles({
    name: "solution.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Три четверти равны 0,75."),
  });
  await expect(progress).toHaveAttribute("value", "2");
  await integratedThemes(
    page,
    page.getByRole("region", { name: "Прогресс ответов" }),
    "answer-progress",
  );
  await page
    .getByLabel("Ответ на задание 3")
    .fill("Вычесть число из обеих частей.");
  await expect(progress).toHaveAttribute("value", "3");
  await screenshot(page, "work-progress-desktop");
  await narrowScreenshot(page, "work-progress");
  // A failed POST must keep the answer and must never display a receipt.
  await page.route(`**/api/assignments/${work.id}/submit`, (route) =>
    route.abort(),
  );
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Отправлено", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue(
    "Дробная черта означает деление.",
  );
  await screenshot(page, "submission-failed-desktop");
  await page.unroute(`**/api/assignments/${work.id}/submit`);
  // If the POST succeeds but its subsequent refresh fails, the server receipt
  // still wins: do not reopen an editable form or invite duplicate submission.
  await page.route(`**/api/assignments/${work.id}`, (route) => route.abort());
  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/assignments/${work.id}/submit`) &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  const receipt = await (await submitted).json();
  await expect(
    page.getByRole("heading", { name: "Отправлено", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отправить работу", exact: true }),
  ).toHaveCount(0);
  const moment = page.getByRole("region", { name: "Работа отправлена" });
  await expect(moment.getByTestId("journey-week-medal")).toBeVisible();
  await noEmoji(moment);
  await screenshot(page, "submitted-desktop");
  await narrowScreenshot(page, "submitted");
  await integratedThemes(page, moment, "submitted");
  await page.unroute(`**/api/assignments/${work.id}`);
  const facts = await json(
    request,
    "GET",
    `/api/relationships/${journey.relationship}/learning-journey`,
    journey.learner,
  );
  expect(facts.streak.count).toBe(1);
  expect(facts.week).toMatchObject({
    total: 1,
    submitted: 1,
    on_time: 1,
    complete: true,
    time_zone: "UTC",
  });
  const pendingGraph = await json(
    request,
    "GET",
    `/api/relationships/${journey.relationship}/skill-graph`,
    journey.learner,
  );
  expect(
    pendingGraph.nodes.every(
      (node: { evidence_count: number }) => node.evidence_count === 0,
    ),
  ).toBe(true);
  await json(
    request,
    "POST",
    `/api/submissions/${receipt.id}/review`,
    journey.tutor,
    {
      action: "corrected",
      note: "Синтетическая проверка преподавателя.",
      tasks: [
        {
          task_id: "task-1",
          correctness: "correct",
          feedback: "Деление объяснено верно.",
        },
        {
          task_id: "task-2",
          correctness: "correct",
          feedback: "Преобразование дроби верно.",
        },
        {
          task_id: "task-3",
          correctness: "partially_correct",
          feedback: "Поясните сохранение равенства.",
        },
      ],
    },
  );
  await page.getByRole("button", { name: "Мой прогресс", exact: true }).click();
  await page
    .locator(".learner-list")
    .getByRole("button", { name: new RegExp(subject) })
    .click();
  const path = page.getByTestId("journey-path");
  await expect(path).toBeVisible();
  await expect(path.locator('[data-state="confirmed"]')).toContainText("Дроби");
  await expect(path.locator('[data-state="current"]')).toContainText(
    "Линейные уравнения",
  );
  await expect(path.locator('[data-state="locked"]')).toContainText(
    "Квадратные уравнения",
  );
  await expect(path).toContainText("2 из 2");
  await path.locator('[data-state="confirmed"]').click();
  const evidence = path.getByRole("list", { name: "Проверки по навыку Дроби" });
  await expect(evidence.getByRole("listitem")).toHaveCount(2);
  await expect(evidence.getByRole("listitem").first()).toContainText(
    "Проверка исправлена преподавателем",
  );
  await noEmoji(path);
  await screenshot(page, "path-reviewed-desktop");
  await narrowScreenshot(page, "path-reviewed");
  await inspectPathAtPhoneWidth(page, path);
  await integratedThemes(page, path, "path");
  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  await expect(page.getByTestId("journey-streak")).toContainText(
    "1 подряд в срок",
  );
  await noEmoji(page.getByTestId("journey-streak"));
  await screenshot(page, "streak-desktop");
  await narrowScreenshot(page, "streak");
  await integratedThemes(page, page.getByTestId("journey-streak"), "streak");
  expect(errors).toEqual([]);
});

test("empty journey shows no invented counts and recovers after a feature request failure", async ({
  page,
  request,
  journey,
}) => {
  const facts = await json(
    request,
    "GET",
    `/api/relationships/${journey.relationship}/learning-journey`,
    journey.learner,
  );
  expect(facts.data_status).toBe("empty");
  expect(facts.streak.count).toBeNull();
  expect(facts.week).toMatchObject({ total: 0, submitted: 0, complete: false });
  await enter(page, journey.learner);
  await page.route(
    `**/api/relationships/${journey.relationship}/learning-journey`,
    (route) => route.abort(),
  );
  await selectJourney(page, journey.relationship);
  const card = page.getByTestId("journey-streak");
  await expect(card.getByRole("alert")).toBeVisible();
  await expect(card.getByTestId("journey-week-medal")).toHaveCount(0);
  await screenshot(page, "streak-failure-desktop");
  await page.unroute(
    `**/api/relationships/${journey.relationship}/learning-journey`,
  );
  await card.getByRole("button", { name: "Повторить загрузку серии" }).click();
  await expect(card).toContainText("Серия ещё не началась");
  await expect(card).toContainText("На этой неделе нет работ со сроком сдачи");
  await expect(card.getByRole("progressbar")).toHaveCount(0);
  await noEmoji(card);
  await screenshot(page, "empty-streak-desktop");
  await narrowScreenshot(page, "empty-streak");
  await page.route(
    `**/api/relationships/${journey.relationship}/skill-graph`,
    (route) => route.abort(),
  );
  await card.getByRole("button", { name: "Мой путь", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Мой путь", exact: true }),
  ).toBeVisible();
  const path = page.getByTestId("journey-path");
  await expect(path.getByRole("alert")).toBeVisible();
  await expect(path.locator("[data-state]")).toHaveCount(0);
  await page.unroute(
    `**/api/relationships/${journey.relationship}/skill-graph`,
  );
  await path.getByRole("button", { name: "Попробовать ещё раз" }).click();
  await expect(
    path.getByRole("heading", { name: "Путь ещё не составлен" }),
  ).toBeVisible();
  await expect(path.locator("[data-state]")).toHaveCount(0);
  await expect(path).toContainText(/ещё|пока/i);
  await screenshot(page, "empty-path-desktop");
  await narrowScreenshot(page, "empty-path");
});

test("unknown reviewed evidence stays ungraded and incomplete history cannot award a medal", async ({
  page,
  request,
  journey,
}) => {
  const work = await createWork(request, journey);
  const submission = await json(
    request,
    "POST",
    `/api/assignments/${work.id}/submit`,
    journey.learner,
    {
      revision: 0,
      answers: {
        "task-1": "Нужна помощь.",
        "task-2": "Пока не понял.",
        "task-3": "Объясните шаг.",
      },
    },
  );
  await json(
    request,
    "POST",
    `/api/submissions/${submission.id}/review`,
    journey.tutor,
    {
      action: "corrected",
      note: "Синтетический случай: пока невозможно оценить.",
      tasks: [1, 2, 3].map((i) => ({
        task_id: `task-${i}`,
        correctness: "unknown",
        feedback: "Разберём на занятии.",
      })),
    },
  );
  await enter(page, journey.learner);
  await selectJourney(page, journey.relationship);
  await page.getByRole("button", { name: "Мой путь", exact: true }).click();
  const path = page.getByTestId("journey-path");
  const first = path.locator('[data-state="current"]');
  await expect(first).toContainText("Дроби");
  await expect(first).toContainText("Проверки пока без оценки");
  await expect(path.locator('[data-state="confirmed"]')).toHaveCount(0);
  await expect(path.locator('[data-state="locked"]')).toHaveCount(2);
  await expect(path).not.toContainText("0 из 0");
  await first.click();
  await expect(path).toContainText(
    "Преподаватель пока не смог оценить ответы по этому навыку",
  );
  await expect(
    path
      .getByRole("list", { name: "Проверки по навыку Дроби" })
      .getByRole("listitem"),
  ).toHaveCount(2);
  await widgetScreenshot(page, path, "unknown-evidence-widget-320", 320);
  // Fault injection only: an incomplete-history response must suppress even a
  // contradictory complete=true field, never show optimistic rewards/counts.
  await page.route(
    `**/api/relationships/${journey.relationship}/learning-journey`,
    async (route) => {
      const response = await route.fetch();
      const value = await response.json();
      await route.fulfill({
        response,
        json: {
          ...value,
          data_status: "insufficient_data",
          insufficient_count: 1,
          streak: { ...value.streak, count: null },
          week: { ...value.week, complete: true },
        },
      });
    },
  );
  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  const card = page.getByTestId("journey-streak");
  await expect(card).toContainText("Недостаточно данных");
  await expect(card.getByTestId("journey-week-medal")).toHaveCount(0);
  await expect(card.getByRole("progressbar")).toHaveCount(0);
  await expect(card.locator(".journey-streak-count")).toHaveCount(0);
  await widgetScreenshot(
    page,
    card,
    "insufficient-history-fault-desktop",
    1440,
  );
});

test("receipt follows the returned attempt identity and ends when its review arrives", async ({
  page,
  request,
  journey,
}) => {
  const work = await createWork(request, journey);
  const first = await json(
    request,
    "POST",
    `/api/assignments/${work.id}/submit`,
    journey.learner,
    {
      revision: 0,
      answers: {
        "task-1": "Ответ первой попытки.",
        "task-2": "Пояснение второй задачи.",
        "task-3": "Пояснение третьей задачи.",
      },
    },
  );
  await json(
    request,
    "POST",
    `/api/submissions/${first.id}/review`,
    journey.tutor,
    {
      action: "returned",
      tasks: [],
      note: "Первый возврат: дополните ответ.",
    },
  );
  await enter(page, journey.learner);
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue(
    "Ответ первой попытки.",
  );

  type ImmediateReview = { id: string; action: "returned" | "corrected" };
  let action: ImmediateReview["action"] = "returned";
  let pending: ImmediateReview | null = null;
  const receipts: string[] = [];
  page.on("dialog", (dialog) => dialog.accept());
  await page.route(`**/api/assignments/${work.id}/submit`, async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    const submission = await response.json();
    receipts.push(submission.id);
    pending = { id: submission.id, action };
    await route.fulfill({ response });
  });
  await page.route(`**/api/assignments/${work.id}`, async (route) => {
    const review = pending;
    if (review) {
      pending = null;
      // Real tutor review committed before the post-submit GET. The returned
      // status stays the same across attempts, but its submission ID changes.
      await json(
        request,
        "POST",
        `/api/submissions/${review.id}/review`,
        journey.tutor,
        {
          action: review.action,
          note:
            review.action === "returned"
              ? "Второй возврат: уточните пояснение."
              : "Третья попытка проверена.",
          tasks:
            review.action === "returned"
              ? []
              : [1, 2, 3].map((i) => ({
                  task_id: `task-${i}`,
                  correctness: "correct",
                  feedback: `Пояснение ${i} принято преподавателем.`,
                })),
        },
      );
    }
    await route.continue();
  });

  await page.getByLabel("Ответ на задание 1").fill("Ответ второй попытки.");
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(
    page.getByText(/Второй возврат: уточните пояснение/),
  ).toBeVisible();
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue(
    "Ответ второй попытки.",
  );
  await expect(
    page.getByRole("button", { name: "Отправить работу", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Работа отправлена" }),
  ).toHaveCount(0);
  await screenshot(page, "returned-again-editable-desktop");

  action = "corrected";
  await page.getByLabel("Ответ на задание 1").fill("Ответ третьей попытки.");
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(
    page.getByText("Пояснение 1 принято преподавателем.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отправить работу", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Работа отправлена" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Отправлено", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Ответы сохранены. Теперь работу проверит преподаватель.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".work-task .original p").first()).toHaveText(
    "Ответ третьей попытки.",
  );
  await screenshot(page, "review-arrives-no-pending-receipt-desktop");
  const attempts = await json(
    request,
    "GET",
    `/api/assignments/${work.id}/attempts`,
    journey.learner,
  );
  expect(
    attempts.items.map((item: { attempt: number }) => item.attempt),
  ).toEqual([3, 2, 1]);
  expect(new Set([first.id, ...receipts]).size).toBe(3);
  const facts = await json(
    request,
    "GET",
    `/api/relationships/${journey.relationship}/learning-journey`,
    journey.learner,
  );
  expect(facts.streak.count).toBe(1);
});

test("acknowledged resubmission keeps its own original and hides the previous attempt feedback during refresh failure", async ({
  page,
  request,
  journey,
}) => {
  const work = await createWork(request, journey);
  const first = await json(
    request,
    "POST",
    `/api/assignments/${work.id}/submit`,
    journey.learner,
    {
      revision: 0,
      answers: {
        "task-1": "Первый оригинал до исправления.",
        "task-2": "Старое пояснение второй задачи.",
        "task-3": "Старое пояснение третьей задачи.",
      },
    },
  );
  const oldFeedback = "Комментарий только к первой попытке";
  await json(
    request,
    "POST",
    `/api/submissions/${first.id}/review`,
    journey.tutor,
    {
      action: "returned",
      note: "Верните дополненное объяснение.",
      tasks: [1, 2, 3].map((i) => ({
        task_id: `task-${i}`,
        correctness: "partially_correct",
        feedback: `${oldFeedback} ${i}.`,
      })),
    },
  );
  await enter(page, journey.learner);
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    page.getByText(`${oldFeedback} 1.`, { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Ответ на задание 1")
    .fill("Новый оригинал второй попытки.");
  await page.route(`**/api/assignments/${work.id}`, (route) => route.abort());
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Отправлено", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".work-task .original p").first()).toHaveText(
    "Новый оригинал второй попытки.",
  );
  await expect(page.getByText(new RegExp(oldFeedback))).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Отправить работу", exact: true }),
  ).toHaveCount(0);
  const saved = await json(
    request,
    "GET",
    `/api/assignments/${work.id}`,
    journey.learner,
  );
  expect(saved.submission.id).not.toBe(first.id);
  expect(saved.submission.answers["task-1"]).toBe(
    "Новый оригинал второй попытки.",
  );
  await screenshot(
    page,
    "resubmission-refresh-failure-original-isolation-desktop",
  );
});

test("disabled journey keeps original learner workflow and makes no journey requests", async ({
  page,
  request,
  journey,
}) => {
  const work = await createWork(request, journey);
  let journeyRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/learning-journey")) journeyRequests++;
  });
  await page.route("**/api/config", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), learning_journey_enabled: false },
    });
  });
  await enter(page, journey.learner);
  await expect(page.getByTestId("journey-streak")).toHaveCount(0);
  await page.getByRole("button", { name: "Мой прогресс", exact: true }).click();
  await page
    .locator(".learner-list")
    .getByRole("button", { name: new RegExp(subject) })
    .click();
  await expect(
    page.getByRole("heading", { name: "Граф навыков", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Мой путь", exact: true }),
  ).toHaveCount(0);
  await screenshot(page, "feature-off-desktop");
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    page.getByRole("progressbar", { name: "Ответы в работе" }),
  ).toHaveCount(0);
  for (let i = 1; i <= 3; i++)
    await page.getByLabel(`Ответ на задание ${i}`).fill("Синтетический ответ.");
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Отправить работу", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Отправлено", exact: true }),
  ).toHaveCount(0);
  const saved = await json(
    request,
    "GET",
    `/api/assignments/${work.id}`,
    journey.learner,
  );
  expect(saved.submission).toBeTruthy();
  expect(journeyRequests).toBe(0);
});
