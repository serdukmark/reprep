import { test, expect, choose } from "./audit-fixtures";
import type { Browser, Locator, Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Создать задание", exact: true }),
  ).toBeVisible();
}

async function revokeFromOtherPage(page: Page, browser: Browser) {
  const revoker = await browser.newPage();
  try {
    // Only this synthetic test session is copied to another headless page.
    // Logout follows the UI and reaches the server; no synthetic 401 response.
    const token = await page.evaluate(() =>
      sessionStorage.getItem("reprep.session"),
    );
    expect(Boolean(token)).toBe(true);
    await revoker.addInitScript(
      (value) => sessionStorage.setItem("reprep.session", value!),
      token,
    );
    await revoker.goto("/");
    await revoker.getByRole("button", { name: /Алекс • демо/ }).click();
    const response = revoker.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/logout" &&
        r.request().method() === "POST",
    );
    await revoker.getByRole("button", { name: "Выйти", exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(
      revoker.getByRole("button", { name: "Я преподаватель", exact: true }),
    ).toBeVisible();
  } finally {
    await revoker.close();
  }
}

for (const kind of ["assign", "lessons"] as const)
  test(`group ${kind}: revoked session preserves bulk form, fresh login creates one record per learner`, async ({
    page,
    browser,
  }) => {
    const groupTitle = `Группа после отзыва сессии ${kind}`;
    const resourceTitle =
      kind === "assign"
        ? "Групповое сложение после входа 🧮"
        : "Групповой урок после входа 🧪";
    const starts = "2026-12-20T15:00",
      duration = "75";
    const instruction = "Решите самостоятельно и запишите ответ.";
    const group = () =>
      page
        .locator("article")
        .filter({
          has: page.getByRole("heading", { name: groupTitle, exact: true }),
        });
    const command =
      kind === "assign"
        ? "Назначить работу всем 2 участникам"
        : "Запланировать для всех 2 участников";
    const rows = () =>
      kind === "assign"
        ? page.locator(".assignment-row")
        : page
            .locator(".lesson-row")
            .filter({
              has: page.getByRole("heading", {
                name: resourceTitle,
                exact: true,
              }),
            });

    const prepare = async (card: Locator) => {
      if (kind === "assign") {
        await card
          .getByRole("combobox", {
            name: `Работа для группы ${groupTitle}`,
            exact: true,
          })
          .click();
        await page
          .getByRole("listbox")
          .getByRole("option", { name: resourceTitle, exact: true })
          .click();
      } else {
        await card.getByLabel("Тема общего занятия").fill(resourceTitle);
        await card.getByLabel("Начало общего занятия").fill(starts);
        await card.getByLabel("Длительность общего занятия").fill(duration);
      }
    };
    const showResults = async () => {
      await page
        .getByRole("button", {
          name: kind === "assign" ? "Задания" : "Расписание",
          exact: true,
        })
        .click();
      if (kind === "assign")
        await page.getByPlaceholder("Найти задание").fill(resourceTitle);
    };
    const verifyCreated = async () => {
      await expect(rows()).toHaveCount(kind === "assign" ? 3 : 2);
      for (const alias of ["Саша • демо", "Женя • демо"]) {
        const own = rows().filter({ hasText: alias });
        await expect(own).toHaveCount(1);
        await expect(own).toContainText(
          kind === "assign" ? "Назначено" : "Запланировано",
        );
        if (kind === "lessons") {
          await expect(own).toContainText("15:00");
          await expect(own).toContainText("75 мин");
        }
      }
      if (kind === "assign")
        await expect(rows().filter({ hasText: "Черновик" })).toHaveCount(1);
    };

    await login(page);
    if (kind === "assign") {
      // A private source without a learner makes accidental publication and
      // duplicate copies distinguishable from the source in the visible list.
      await page
        .getByRole("button", { name: "Создать задание", exact: true })
        .click();
      await page.getByLabel("Название работы").fill(resourceTitle);
      await choose(
        page.getByRole("combobox", { name: "Ученик", exact: true }),
        "",
      );
      await page.getByLabel("Инструкция ученику").fill(instruction);
      await page
        .getByLabel("Условие", { exact: true })
        .fill("Сколько будет 7 + 5?");
      await page.getByLabel("Эталонный ответ", { exact: true }).fill("12");
      await page.getByLabel("Навык", { exact: true }).fill("Сложение");
      await page
        .getByRole("button", { name: "Сохранить черновик", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: resourceTitle, exact: true }),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await page.getByLabel("Название группы").fill(groupTitle);
    await page.getByRole("checkbox", { name: /Саша • демо/ }).check();
    await page.getByRole("checkbox", { name: /Женя • демо/ }).check();
    await page
      .getByRole("button", { name: "Сохранить группу", exact: true })
      .click();
    await expect(group()).toBeVisible();
    await prepare(group());
    await revokeFromOtherPage(page, browser);
    const denied = page.waitForResponse(
      (r) =>
        new RegExp(`/api/groups/[^/]+/${kind}$`).test(
          new URL(r.url()).pathname,
        ) && r.request().method() === "POST",
    );
    await group().getByRole("button", { name: command, exact: true }).click();
    expect((await denied).status()).toBe(401);
    await expect(page.getByRole("alert").first()).toContainText(
      "Сессия завершилась. Войдите снова",
    );
    await expect(
      page.getByText("Создано записей для участников: 2", { exact: true }),
    ).toHaveCount(0);
    if (kind === "assign") {
      await expect(group().getByRole("combobox")).toHaveText(resourceTitle);
    } else {
      await expect(group().getByLabel("Тема общего занятия")).toHaveValue(
        resourceTitle,
      );
      await expect(group().getByLabel("Начало общего занятия")).toHaveValue(
        starts,
      );
      await expect(
        group().getByLabel("Длительность общего занятия"),
      ).toHaveValue(duration);
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await showResults();
    await expect(rows()).toHaveCount(kind === "assign" ? 1 : 0);
    if (kind === "assign") await expect(rows()).toContainText("Черновик");
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await expect(group()).toContainText("Саша • демо");
    await expect(group()).toContainText("Женя • демо");
    await prepare(group());
    const accepted = page.waitForResponse(
      (r) =>
        new RegExp(`/api/groups/[^/]+/${kind}$`).test(
          new URL(r.url()).pathname,
        ) && r.request().method() === "POST",
    );
    await group().getByRole("button", { name: command, exact: true }).click();
    expect((await accepted).status()).toBe(200);
    await expect(
      page.getByText("Создано записей для участников: 2", { exact: true }),
    ).toBeVisible();
    await showResults();
    await verifyCreated();
    await page.reload();
    await showResults();
    await verifyCreated();

    const learner = await browser.newPage();
    try {
      await learner.goto("/");
      await learner
        .getByRole("button", { name: "Я ученик", exact: true })
        .click();
      await learner
        .getByRole("button", {
          name: kind === "assign" ? "Задания" : "Расписание",
          exact: true,
        })
        .click();
      if (kind === "assign") {
        await learner.getByPlaceholder("Найти задание").fill(resourceTitle);
        await expect(learner.locator(".assignment-row")).toHaveCount(1);
        await learner.locator(".assignment-row").click();
        await expect(learner.locator(".instructions")).toHaveText(instruction);
      } else {
        await expect(
          learner.getByRole("heading", { name: resourceTitle, exact: true }),
        ).toHaveCount(1);
      }
      await expect(
        learner.getByText("Женя • демо", { exact: true }),
      ).toHaveCount(0);
    } finally {
      await learner.close();
    }
  });
