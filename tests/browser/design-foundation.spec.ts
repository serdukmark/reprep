import { mkdir, writeFile } from "node:fs/promises";
import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";

test.skip(
  process.env.E2E_AUDIT !== "1",
  "Design acceptance requires the isolated audit fixture and seeded synthetic data",
);

const baseline = process.env.DESIGN_BASELINE === "1";
const artifactRoot = `artifacts/design-foundation/${baseline ? "baseline" : "after"}`;

// Read the colors actually painted by the product, including transparent layers.
// Expected ratios come from WCAG, not from copies of the implementation tokens.
async function contrastReport(page: Page) {
  return page.evaluate(() => {
    type Color = [number, number, number, number];
    const parse = (value: string): Color => {
      const components = value.match(/[\d.]+/g)?.map(Number) || [];
      if (components.length < 3)
        throw new Error(`Unsupported computed color: ${value}`);
      return [components[0], components[1], components[2], components[3] ?? 1];
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
    const luminance = (color: Color) =>
      color
        .slice(0, 3)
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const ratio = (a: Color, b: Color) =>
      (Math.max(luminance(a), luminance(b)) + 0.05) /
      (Math.min(luminance(a), luminance(b)) + 0.05);
    const measurements: {
      element: string;
      kind: string;
      foreground: Color;
      background: Color;
      ratio: number;
      minimum: number;
    }[] = [];
    const record = (
      element: Element,
      kind: string,
      foreground: Color,
      bg: Color,
      minimum: number,
    ) =>
      measurements.push({
        element: `${element.tagName.toLowerCase()}.${element.className} ${(element.textContent || element.getAttribute("aria-label") || element.getAttribute("placeholder") || "").trim().slice(0, 70)}`,
        kind,
        foreground,
        background: bg,
        ratio: ratio(over(foreground, bg), bg),
        minimum,
      });
    const selector =
      ".primary, .secondary, .dark, .text-button, .badge, .skill-tag, .notice, .error, .toast, .choice-trigger, .choice-option, .card h2, .card h3, .card p, .card small, .page-heading p, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea";
    for (const element of document.querySelectorAll(selector)) {
      const style = getComputedStyle(element);
      if (
        !element.getClientRects().length ||
        style.visibility === "hidden" ||
        Number(style.opacity) < 1 ||
        element.matches(":disabled")
      )
        continue;
      const bg = background(element);
      const large =
        parseFloat(style.fontSize) >= 24 ||
        (parseFloat(style.fontSize) >= 18.66 &&
          parseInt(style.fontWeight) >= 700);
      record(element, "text", parse(style.color), bg, large ? 3 : 4.5);
      if (
        element.matches("input, textarea") &&
        element.getAttribute("placeholder")
      )
        record(
          element,
          "placeholder",
          parse(getComputedStyle(element, "::placeholder").color),
          bg,
          4.5,
        );
      if (
        element.matches(
          "input:not([type=checkbox]):not([type=radio]), textarea, .choice-trigger",
        ) &&
        parseFloat(style.borderTopWidth) > 0
      ) {
        record(
          element,
          "field border / inside",
          parse(style.borderTopColor),
          bg,
          3,
        );
        record(
          element,
          "field border / outside",
          parse(style.borderTopColor),
          background(element.parentElement),
          3,
        );
      }
      if (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0)
        record(
          element,
          "focus",
          parse(style.outlineColor),
          background(element.parentElement),
          3,
        );
    }
    for (const element of document.querySelectorAll(".skill-track > span")) {
      if (element.getBoundingClientRect().width > 0)
        record(
          element,
          "progress fill / track",
          parse(getComputedStyle(element).backgroundColor),
          background(element.parentElement),
          3,
        );
    }
    return measurements;
  });
}

async function checkContrast(page: Page, name: string) {
  const measurements = await contrastReport(page);
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(
    `${artifactRoot}/${name}-contrast.json`,
    JSON.stringify(measurements, null, 2) + "\n",
  );
  expect(
    measurements.length,
    "There must be real product components to measure",
  ).toBeGreaterThan(0);
  const failures = measurements.filter((entry) => entry.ratio < entry.minimum);
  expect(failures, `Computed component contrast: ${name}`).toEqual([]);
}

async function navigate(page: Page, name: string) {
  // Login resolves asynchronously; wait for the authenticated shell before
  // deciding whether this viewport needs the mobile navigation button.
  await expect(page.locator(".shell")).toBeVisible();
  const menu = page.getByRole("button", { name: "Открыть меню", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
  await expect(page.locator("h1").first()).toBeVisible();
}

async function capture(page: Page, name: string) {
  await mkdir(artifactRoot, { recursive: true });
  await page.screenshot({
    path: `${artifactRoot}/${name}.png`,
    fullPage: true,
  });
  if (!baseline) {
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect(page.locator("body")).toHaveCSS("font-size", "17px");
    const emoji = await page.evaluate(() => {
      const expression =
        /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/gu;
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width > 0 && rect.height > 0 && style.visibility !== "hidden"
        );
      };
      const findings: string[] = [];
      const add = (value: string, label: string) => {
        const matches = value.match(expression);
        if (matches) findings.push(`${label}: ${matches.join(" ")}`);
      };
      add(document.body.innerText, "visible text");
      for (const element of document.querySelectorAll("*")) {
        if (!visible(element)) continue;
        for (const attribute of ["aria-label", "title", "alt"])
          add(element.getAttribute(attribute) || "", attribute);
        for (const pseudo of ["::before", "::after"])
          add(getComputedStyle(element, pseudo).content, pseudo);
      }
      return findings;
    });
    expect(
      emoji,
      "Product text, accessible names and CSS content use SVG icons, never emoji",
    ).toEqual([]);
    await checkContrast(page, name);
  }
}

test("design foundation: system preference and explicit theme overrides", async ({
  page,
}) => {
  test.skip(baseline, "The original product only has a light theme");
  await page.goto("/");
  const background = () =>
    page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).backgroundColor);
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(background).toBe("rgb(255, 255, 255)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(background).toBe("rgb(19, 31, 36)");
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await expect.poll(background).toBe("rgb(255, 255, 255)");
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await expect.poll(background).toBe("rgb(19, 31, 36)");
  await page.evaluate(() =>
    document.documentElement.removeAttribute("data-theme"),
  );
  await expect.poll(background).toBe("rgb(255, 255, 255)");
});

for (const width of [320, 360]) {
  test(`design foundation: ${width}px fields and keyboard choice fit`, async ({
    page,
  }) => {
    test.skip(
      baseline,
      "Additional acceptance checks for the migrated foundation",
    );
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Создать задание", exact: true })
      .click();
    const input = page.getByLabel("Название работы");
    await input.fill(
      "Синтетическая проверка длинного заголовка и доступности полей",
    );
    await input.focus();
    await expect(input).toHaveCSS("outline-style", "solid");
    await checkContrast(page, `${width}-light-input-focus`);
    const pupil = page.getByRole("combobox", { name: "Ученик", exact: true });
    await pupil.focus();
    await page.keyboard.press("ArrowDown");
    const popup = page.getByRole("listbox");
    await expect(popup).toBeVisible();
    const bounds = await popup.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await capture(page, `${width}-light-keyboard-choice`);
    await page.keyboard.press("Escape");
    await expect(pupil).toBeFocused();
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await capture(page, `${width}-${theme}-assignment-builder`);
    }
    const controls = await page
      .locator(
        "input:not([type=hidden]), textarea, .choice-trigger, .primary, .secondary",
      )
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length)
          .map((element) => ({
            tag: element.tagName,
            height: element.getBoundingClientRect().height,
            font: parseFloat(getComputedStyle(element).fontSize),
          })),
      );
    expect(
      controls.filter((control) => control.height < 44 || control.font < 16),
    ).toEqual([]);
    page.on("dialog", (dialog) => dialog.accept());
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const [index, destination] of [
        "Сегодня",
        "Задания",
        "Ученики",
        "Расписание",
        "Материалы",
        "Репетиторы",
      ].entries()) {
        await navigate(page, destination);
        await capture(page, `${width}-${theme}-navigation-${index}`);
      }
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`design foundation: ${theme} button hover, press, focus and disabled state`, async ({
    page,
  }) => {
    test.skip(
      baseline,
      "Additional acceptance checks for the migrated foundation",
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/");
    const primary = page.getByRole("button", {
      name: "Я преподаватель",
      exact: true,
    });
    await primary.hover();
    await checkContrast(page, `${theme}-button-hover`);
    await page.mouse.down();
    await checkContrast(page, `${theme}-button-pressed`);
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await page.keyboard.press("Tab");
    await primary.focus();
    await expect(primary).toHaveCSS("outline-style", "solid");
    await checkContrast(page, `${theme}-button-focus`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(primary).toHaveCSS("transition-duration", "0s");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/auth/demo/tutor", async (route) => {
      await pending;
      await route.continue();
    });
    try {
      await primary.click();
      await expect(primary).toBeDisabled();
      await page.screenshot({
        path: `${artifactRoot}/${theme}-button-disabled.png`,
        fullPage: true,
      });
      await expect(primary).toHaveCSS("opacity", "1");
      const colors = await primary.evaluate((button) => {
        const style = getComputedStyle(button);
        return { background: style.backgroundColor, text: style.color };
      });
      await writeFile(
        `${artifactRoot}/${theme}-button-disabled.json`,
        JSON.stringify(colors, null, 2) + "\n",
      );
    } finally {
      release();
    }
    await expect(
      page.getByRole("heading", { name: "Хороший день, чтобы учить." }),
    ).toBeVisible();
  });
}

test("design foundation: tutor review, confirmed progress and recoverable error in both themes", async ({
  page,
  browser,
  request,
}) => {
  test.skip(
    baseline,
    "Additional real state coverage, separate from before/after screen pairs",
  );
  const login = async (role: string) => {
    const response = await request.post(`/api/auth/demo/${role}`);
    expect(response.ok()).toBeTruthy();
    return { Authorization: `Bearer ${(await response.json()).token}` };
  };
  const tutor = await login("tutor");
  const learner = await login("learner");
  const created = await request.post("/api/assignments", {
    headers: tutor,
    data: {
      relationship_id: "demo-link",
      title: "Синтетическая проверка оформления прогресса",
      instructions: "Покажите вычисления",
      tasks: [
        {
          id: "foundation",
          type: "numeric",
          prompt: "2 + 2 = ?",
          answer: "4",
          rubric: "Сложить два и два",
          skill: "Сложение: демонстрация оформления",
          options: [],
          hint: "",
        },
      ],
    },
  });
  expect(created.ok()).toBeTruthy();
  const assignment = (await created.json()).id;
  expect(
    (
      await request.post(`/api/assignments/${assignment}/publish`, {
        headers: tutor,
      })
    ).ok(),
  ).toBeTruthy();
  const submitted = await request.post(
    `/api/assignments/${assignment}/submit`,
    { headers: learner, data: { revision: 0, answers: { foundation: "4" } } },
  );
  expect(submitted.ok()).toBeTruthy();
  const submission = (await submitted.json()).id;
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`/api/assignments/${assignment}`, {
              headers: tutor,
            })
          ).json()
        ).submission.status,
    )
    .toBe("awaiting_review");
  const reviewPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  try {
    await reviewPage.goto("/");
    await reviewPage
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await reviewPage
      .getByRole("button", {
        name: /Синтетическая проверка оформления прогресса/,
      })
      .click();
    await expect(reviewPage.locator(".assessment")).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await reviewPage.emulateMedia({ colorScheme: theme });
      await capture(reviewPage, `390-${theme}-tutor-review`);
    }
  } finally {
    await reviewPage.close();
  }
  expect(
    (
      await request.post(`/api/submissions/${submission}/review`, {
        headers: tutor,
        data: {
          action: "corrected",
          tasks: [
            {
              task_id: "foundation",
              correctness: "correct",
              feedback: "Вычисление подтверждено преподавателем.",
            },
          ],
          note: "Синтетическая проверка",
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  await navigate(page, "Мой прогресс");
  const skill = page
    .locator(".skill")
    .filter({ hasText: "Сложение: демонстрация оформления" });
  await expect(skill).toBeVisible();
  await skill.locator("summary").click();
  await expect(skill.locator(".skill-track > span")).toBeVisible();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await capture(page, `390-${theme}-confirmed-progress`);
  }
  await page.route("**/api/relationships/demo-link/export", (route) =>
    route.abort(),
  );
  await page
    .getByRole("button", { name: "Экспорт прогресса", exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await capture(page, `390-${theme}-recoverable-error`);
  }
});

for (const width of [390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`design foundation: ${width}px ${theme} real product screens`, async ({
      page,
      browser,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.emulateMedia({ colorScheme: theme });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "Я преподаватель", exact: true }),
      ).toBeVisible();
      await capture(page, `${width}-${theme}-login`);
      await page
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Хороший день, чтобы учить." }),
      ).toBeVisible();
      // The shell appears before its parallel data requests finish. Capture
      // the known synthetic state, never a transient zero-count dashboard.
      await expect(page.locator(".assignment-row")).toHaveCount(2);
      await capture(page, `${width}-${theme}-tutor-dashboard`);
      await page
        .getByRole("button", { name: "Создать задание", exact: true })
        .click();
      await expect(page.getByLabel("Название работы")).toBeVisible();
      await capture(page, `${width}-${theme}-assignment-builder`);
      await navigate(page, "Задания");
      await expect(page.locator(".assignment-row")).toHaveCount(2);
      await capture(page, `${width}-${theme}-assignments`);

      const learner = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        colorScheme: theme,
      });
      try {
        learner.on("pageerror", (error) => errors.push(error.message));
        await learner.goto("/");
        await learner
          .getByRole("button", { name: "Я ученик", exact: true })
          .click();
        await expect(learner.locator("h1").first()).toBeVisible();
        await expect(learner.locator(".assignment-row")).toHaveCount(1);
        await capture(learner, `${width}-${theme}-learner-dashboard`);
        await navigate(learner, "Мой прогресс");
        await capture(learner, `${width}-${theme}-learner-progress`);
      } finally {
        await learner.close();
      }
      expect(errors).toEqual([]);
    });
  }
}
