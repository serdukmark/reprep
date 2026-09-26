import { test, expect, choose } from "./audit-fixtures";
import type { Browser, Page } from "@playwright/test";

const tutorButton = "Я преподаватель";
const outsiderButton = "Другой преподаватель · демо";

async function login(page: Page, button = tutorButton) {
  await page.goto("/");
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Создать задание", exact: true }),
  ).toBeVisible();
}

// Revoke the actual synthetic session through the normal logout UI. The token
// is only copied into this test's second headless page and is never printed.
async function revokeFromOtherPage(
  page: Page,
  browser: Browser,
  button = tutorButton,
) {
  const revoker = await browser.newPage();
  try {
    const token = await page.evaluate(() =>
      sessionStorage.getItem("reprep.session"),
    );
    expect(Boolean(token)).toBe(true);
    await revoker.addInitScript(
      (value) => sessionStorage.setItem("reprep.session", value!),
      token,
    );
    await revoker.goto("/");
    await revoker
      .getByRole("button", {
        name:
          button === outsiderButton
            ? /Другой репетитор • демо/
            : /Алекс • демо/,
      })
      .click();
    const revoked = revoker.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/logout" &&
        r.request().method() === "POST",
    );
    await revoker.getByRole("button", { name: "Выйти", exact: true }).click();
    expect((await revoked).status()).toBe(200);
    await expect(
      revoker.getByRole("button", { name: button, exact: true }),
    ).toBeVisible();
  } finally {
    await revoker.close();
  }
}

async function freshLogin(page: Page, button = tutorButton, unsaved = false) {
  if (unsaved) page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Создать задание", exact: true }),
  ).toBeVisible();
}

async function fillDraft(
  page: Page,
  title: string,
  instructions: string,
  learner = true,
) {
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await page.getByLabel("Название работы").fill(title);
  await page.getByLabel("Инструкция ученику").fill(instructions);
  if (learner)
    await choose(
      page.getByRole("combobox", { name: "Ученик", exact: true }),
      "demo-link",
    );
  await page
    .getByLabel("Условие", { exact: true })
    .fill("Сколько будет 2 + 3?");
  await page.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await page.getByLabel("Навык", { exact: true }).fill("Сложение 🧮");
}

async function openWork(page: Page, title: string) {
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await page.getByPlaceholder("Найти задание").fill(title);
  await expect(page.locator(".assignment-row")).toHaveCount(1);
  await page.locator(".assignment-row").click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

async function expectSessionFailure(page: Page) {
  await expect(page.getByRole("alert").first()).toContainText(
    "Сессия завершилась. Войдите снова",
  );
}

test("empty tutor draft creation: revoked session preserves form, fresh login creates one draft", async ({
  page,
  browser,
}) => {
  const title = "Первый черновик после сессии 🧪",
    note = "Сначала подумай, затем проверь 2 + 3.";
  await login(page, outsiderButton);
  await fillDraft(page, title, note, false);
  await revokeFromOtherPage(page, browser, outsiderButton);
  const denied = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/assignments" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  expect((await denied).status()).toBe(401);
  await expectSessionFailure(page);
  await expect(page.getByLabel("Название работы")).toHaveValue(title);
  await expect(page.getByLabel("Инструкция ученику")).toHaveValue(note);
  await expect(page.getByLabel("Эталонный ответ", { exact: true })).toHaveValue(
    "5",
  );
  await expect(
    page.getByText("Черновик сохранён", { exact: true }),
  ).toHaveCount(0);
  await freshLogin(page, outsiderButton, true);
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await expect(page.locator(".assignment-row")).toHaveCount(0);
  await fillDraft(page, title, note, false);
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await openWork(page, title);
  await expect(page.locator(".instructions")).toHaveText(note);
  await expect(page.getByText("Черновик", { exact: true })).toBeVisible();
});

test("tutor draft editing: revoked session cannot replace saved contents and new login permits retry", async ({
  page,
  browser,
}) => {
  const title = "Черновик с истёкшей сессией",
    original = "Сохранённая инструкция",
    changed = "Новая инструкция 🧪\nПроверь каждый шаг.";
  await login(page);
  await fillDraft(page, title, original);
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page.getByLabel("Инструкция ученику").fill(changed);
  // Dismiss the previous successful save notice before testing false success.
  await expect(
    page.getByText("Черновик сохранён", { exact: true }),
  ).toHaveCount(0);
  await revokeFromOtherPage(page, browser);
  const denied = page.waitForResponse(
    (r) =>
      /^\/api\/assignments\/[^/]+$/.test(new URL(r.url()).pathname) &&
      r.request().method() === "PUT",
  );
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  expect((await denied).status()).toBe(401);
  await expectSessionFailure(page);
  await expect(page.getByLabel("Инструкция ученику")).toHaveValue(changed);
  await expect(
    page.getByText("Черновик сохранён", { exact: true }),
  ).toHaveCount(0);
  await freshLogin(page, tutorButton, true);
  await openWork(page, title);
  await expect(page.locator(".instructions")).toHaveText(original);
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page.getByLabel("Инструкция ученику").fill(changed);
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.locator(".instructions")).toHaveText(changed);
  await page.reload();
  await openWork(page, title);
  await expect(page.locator(".instructions")).toHaveText(changed);
});

test("tutor publication: session revoked after draft save rejects publication until a fresh login", async ({
  page,
  browser,
}) => {
  const title = "Назначение после истечения сессии",
    note = "Условие сохранено, назначение требует входа 🧪";
  const learner = await browser.newPage();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reached!: () => void;
  const pending = new Promise<void>((resolve) => {
    reached = resolve;
  });
  try {
    await login(page);
    await fillDraft(page, title, note);
    // The UI saves a draft before publishing. Pause only the publish request,
    // then revoke through the other page, preserving a real server 401.
    await page.route("**/api/assignments/*/publish", async (route) => {
      reached();
      await held;
      await route.continue();
    });
    const denied = page.waitForResponse(
      (r) =>
        /\/api\/assignments\/[^/]+\/publish$/.test(new URL(r.url()).pathname) &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Назначить ученику", exact: true })
      .click();
    await pending;
    await revokeFromOtherPage(page, browser);
    release();
    expect((await denied).status()).toBe(401);
    await expectSessionFailure(page);
    await expect(page.getByLabel("Название работы")).toHaveValue(title);
    await expect(page.getByLabel("Инструкция ученику")).toHaveValue(note);
    await expect(
      page.getByText("Работа назначена ученику", { exact: true }),
    ).toHaveCount(0);
    await page.unroute("**/api/assignments/*/publish");
    await learner.goto("/");
    await learner
      .getByRole("button", { name: "Я ученик", exact: true })
      .click();
    await learner.getByRole("button", { name: "Задания", exact: true }).click();
    await learner.getByPlaceholder("Найти задание").fill(title);
    await expect(learner.locator(".assignment-row")).toHaveCount(0);
    await freshLogin(page, tutorButton, true);
    await openWork(page, title);
    await expect(page.getByText("Черновик", { exact: true })).toBeVisible();
    await expect(page.locator(".instructions")).toHaveText(note);
    await page
      .getByRole("button", { name: "Редактировать", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Назначить ученику", exact: true })
      .click();
    await expect(
      page.getByText("Работа назначена ученику", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await openWork(page, title);
    await expect(
      page.getByRole("button", { name: "Создать копию", exact: true }),
    ).toBeVisible();
    await learner.reload();
    await openWork(learner, title);
    await expect(learner.locator(".instructions")).toHaveText(note);
  } finally {
    release();
    await learner.close();
  }
});

test("tutor duplication: revoked session creates no copy, authenticated retry creates one private draft", async ({
  page,
  browser,
}) => {
  const title = "Линейные уравнения: от шага к решению",
    copy = title + " · копия";
  const learner = await browser.newPage();
  try {
    await login(page);
    await openWork(page, title);
    await revokeFromOtherPage(page, browser);
    const denied = page.waitForResponse(
      (r) =>
        /\/api\/assignments\/[^/]+\/duplicate$/.test(
          new URL(r.url()).pathname,
        ) && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Создать копию", exact: true })
      .click();
    expect((await denied).status()).toBe(401);
    await expectSessionFailure(page);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Название работы")).toHaveCount(0);
    await freshLogin(page);
    await page.getByRole("button", { name: "Задания", exact: true }).click();
    await page.getByPlaceholder("Найти задание").fill(copy);
    await expect(page.locator(".assignment-row")).toHaveCount(0);
    await page.getByPlaceholder("Найти задание").fill(title);
    await page.locator(".assignment-row").click();
    await page
      .getByRole("button", { name: "Создать копию", exact: true })
      .click();
    await expect(page.getByLabel("Название работы")).toHaveValue(copy);
    await page.reload();
    await openWork(page, copy);
    await expect(page.getByText("Черновик", { exact: true })).toBeVisible();
    await learner.goto("/");
    await learner
      .getByRole("button", { name: "Я ученик", exact: true })
      .click();
    await learner.getByRole("button", { name: "Задания", exact: true }).click();
    await learner.getByPlaceholder("Найти задание").fill(copy);
    await expect(learner.locator(".assignment-row")).toHaveCount(0);
  } finally {
    await learner.close();
  }
});

for (const action of ["create", "revoke"] as const)
  test(`tutor learner invitation ${action}: expired session preserves server state and fresh login recovers`, async ({
    page,
    browser,
  }) => {
    const observer = await browser.newPage();
    const invitations = (p: Page) =>
      p
        .locator("section.card")
        .filter({
          has: p.getByRole("heading", { name: "Приглашения", exact: true }),
        });
    const learners = async (p: Page) =>
      p.getByRole("button", { name: "Ученики", exact: true }).click();
    let code = "";
    try {
      await login(page, outsiderButton);
      await learners(page);
      if (action === "revoke") {
        await page
          .getByRole("button", { name: "Пригласить ученика", exact: true })
          .click();
        await expect(page.locator(".invite-box code")).toBeVisible();
        code = await page.locator(".invite-box code").innerText();
        await expect(invitations(page).locator(".line")).toHaveCount(1);
      }
      await revokeFromOtherPage(page, browser, outsiderButton);
      const denied = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          (action === "create"
            ? new URL(r.url()).pathname === "/api/invitations"
            : /\/api\/invitations\/[^/]+\/revoke$/.test(
                new URL(r.url()).pathname,
              )),
      );
      await page
        .getByRole("button", {
          name: action === "create" ? "Пригласить ученика" : "Отозвать",
          exact: true,
        })
        .click();
      expect((await denied).status()).toBe(401);
      await expectSessionFailure(page);
      if (action === "create") {
        await expect(page.locator(".invite-box")).toHaveCount(0);
        await expect(invitations(page)).toHaveCount(0);
      } else {
        await expect(page.locator(".invite-box code")).toHaveText(code);
        await expect(invitations(page)).toContainText("Ожидает ученика");
        await expect(invitations(page)).not.toContainText("Отозвано");
      }
      // An independently authenticated UI sees the actual persisted state.
      await login(observer, outsiderButton);
      await learners(observer);
      if (action === "create")
        await expect(invitations(observer)).toHaveCount(0);
      else {
        await expect(invitations(observer).locator(".line")).toHaveCount(1);
        await expect(invitations(observer)).toContainText("Ожидает ученика");
      }
      await freshLogin(page, outsiderButton);
      await learners(page);
      await page
        .getByRole("button", {
          name: action === "create" ? "Пригласить ученика" : "Отозвать",
          exact: true,
        })
        .click();
      if (action === "create")
        await expect(page.locator(".invite-box code")).toBeVisible();
      else await expect(invitations(page)).toContainText("Отозвано");
      await page.reload();
      await learners(page);
      await expect(invitations(page).locator(".line")).toHaveCount(1);
      await expect(invitations(page)).toContainText(
        action === "create" ? "Ожидает ученика" : "Отозвано",
      );
      await expect(
        page.getByRole("button", { name: "Отозвать", exact: true }),
      ).toHaveCount(action === "create" ? 1 : 0);
    } finally {
      await observer.close();
    }
  });
