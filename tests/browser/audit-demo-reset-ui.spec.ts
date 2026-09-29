import { test, expect, choose } from "./audit-fixtures";
import { createHmac, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

// This destructive demo operation belongs only to the known synthetic audit
// database. Skip before fixtures if the caller selects any other surface.
test.skip(
  process.env.E2E_AUDIT !== "1" ||
    !/^http:\/\/127\.0\.0\.1:8017\/?$/.test(process.env.E2E_URL || ""),
  "UI reset is restricted to the isolated localhost:8017 audit server",
);

const seededTitle = "Линейные уравнения: от шага к решению";
const confirmation =
  "Сбросить только демонстрационные работы? Все демо-сессии завершатся.";

async function settings(page: Page, alias: string) {
  await page.getByRole("button", { name: new RegExp(alias) }).click();
  await expect(
    page.getByRole("heading", { name: "Мои данные", exact: true }),
  ).toBeVisible();
}

async function resetFromUI(page: Page, accept: boolean) {
  let seen = false;
  page.once("dialog", async (dialog) => {
    seen = true;
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toBe(confirmation);
    if (accept) await dialog.accept();
    else await dialog.dismiss();
  });
  const response = accept
    ? page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/demo/reset" &&
          r.request().method() === "POST",
      )
    : null;
  await page
    .getByRole("button", { name: "Восстановить демо", exact: true })
    .click();
  expect(seen).toBe(true);
  if (response) {
    expect((await response).status()).toBe(200);
    await expect(
      page.getByText("Демо восстановлено", { exact: true }),
    ).toBeVisible();
  }
}

async function reloadSession(page: Page, status: number) {
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/me",
  );
  await page.reload();
  expect((await response).status()).toBe(status);
}

async function createNumeric(
  page: Page,
  title: string,
  publish: boolean,
  learner: boolean,
  relationship?: string,
) {
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await page.getByLabel("Название работы").fill(title);
  await choose(
    page.getByRole("combobox", { name: "Ученик", exact: true }),
    learner ? relationship || { index: 1 } : "",
  );
  await page
    .getByLabel("Условие", { exact: true })
    .fill("Сколько будет 6 + 7? 🧮");
  await page.getByLabel("Эталонный ответ", { exact: true }).fill("13");
  await page
    .getByLabel("Навык", { exact: true })
    .fill("Синтетическое сложение");
  await page
    .getByRole("button", {
      name: publish ? "Назначить ученику" : "Сохранить черновик",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
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

test("demo reset UI: cancelling preserves work, confirming restores demo and revokes the other demo sessions", async ({
  page,
  browser,
}) => {
  const learner = await browser.newPage(),
    colleague = await browser.newPage(),
    guardian = await browser.newPage();
  const removedTitle = "Демо-черновик до восстановления 🧪";
  const groupTitle = "Демо-группа до восстановления 🧪";
  let resetPosts = 0;
  page.on("request", (r) => {
    if (
      new URL(r.url()).pathname === "/api/demo/reset" &&
      r.method() === "POST"
    )
      resetPosts++;
  });
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await createNumeric(page, removedTitle, false, false);
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await page.getByLabel("Название группы").fill(groupTitle);
    await page.getByRole("checkbox", { name: /Саша • демо/ }).check();
    await page
      .getByRole("button", { name: "Сохранить группу", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: groupTitle, exact: true }),
    ).toBeVisible();
    await learner.goto("/");
    await learner
      .getByRole("button", { name: "Я ученик", exact: true })
      .click();
    await openWork(learner, seededTitle);
    await learner.getByLabel("Ответ на задание 1", { exact: true }).fill("19");
    await learner
      .getByRole("button", { name: "Сохранить ответы", exact: true })
      .click();
    await expect(learner.getByRole("status")).toHaveText("Сохранено");
    await colleague.goto("/");
    await colleague
      .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
      .click();
    await expect(
      colleague.getByRole("button", { name: /Другой репетитор • демо/ }),
    ).toBeVisible();
    await guardian.goto("/");
    await guardian
      .getByRole("button", { name: "Я родитель", exact: true })
      .click();
    await expect(
      guardian.getByRole("heading", { name: "Кабинет родителя", exact: true }),
    ).toBeVisible();

    await settings(page, "Алекс • демо");
    await resetFromUI(page, false);
    expect(resetPosts).toBe(0);
    await reloadSession(page, 200);
    await openWork(page, removedTitle);
    await reloadSession(learner, 200);
    await openWork(learner, seededTitle);
    await expect(
      learner.getByLabel("Ответ на задание 1", { exact: true }),
    ).toHaveValue("19");

    await settings(page, "Алекс • демо");
    await resetFromUI(page, true);
    expect(resetPosts).toBe(1);
    // The initiating page receives a fresh demo-tutor session, as the UI
    // handler explicitly applies the reset response before refreshing.
    await reloadSession(page, 200);
    await page.getByRole("button", { name: "Задания", exact: true }).click();
    await expect(page.locator(".assignment-row")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: new RegExp(removedTitle) }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: new RegExp(seededTitle) }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", {
        name: /Дроби и уравнения: самостоятельная работа/,
      }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await expect(page.locator(".learner-list button")).toHaveCount(2);
    await expect(
      page.getByText("Групп пока нет.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: groupTitle, exact: true }),
    ).toHaveCount(0);

    // A saved response in an already open learner page cannot write into the
    // freshly seeded work using its revoked session.
    const refused = learner.waitForResponse(
      (r) =>
        new URL(r.url()).pathname ===
          "/api/assignments/demo-assignment/draft" &&
        r.request().method() === "PUT",
    );
    await learner.getByLabel("Ответ на задание 1", { exact: true }).fill("23");
    await learner
      .getByRole("button", { name: "Сохранить ответы", exact: true })
      .click();
    expect((await refused).status()).toBe(401);
    await expect(learner.locator(".save-error")).toContainText(
      "Сессия завершилась",
    );
    await expect(
      learner.getByLabel("Ответ на задание 1", { exact: true }),
    ).toHaveValue("23");
    learner.once("dialog", (dialog) => dialog.accept());
    await reloadSession(learner, 401);
    await expect(
      learner.getByRole("button", { name: "Я ученик", exact: true }),
    ).toBeVisible();
    await reloadSession(colleague, 401);
    await expect(
      colleague.getByRole("button", {
        name: "Другой преподаватель · демо",
        exact: true,
      }),
    ).toBeVisible();
    await reloadSession(guardian, 401);
    await expect(
      guardian.getByRole("button", { name: "Я родитель", exact: true }),
    ).toBeVisible();
    await learner
      .getByRole("button", { name: "Я ученик", exact: true })
      .click();
    await openWork(learner, seededTitle);
    await expect(
      learner.getByLabel("Ответ на задание 1", { exact: true }),
    ).toHaveValue("");
    await expect(
      learner.getByLabel("Ответ на задание 3", { exact: true }),
    ).toHaveValue("");
    await expect(learner.getByRole("radio", { checked: true })).toHaveCount(0);

    const afterTitle = "Новая работа после восстановления 🧪";
    await createNumeric(page, afterTitle, true, true, "demo-link");
    await learner.reload();
    await openWork(learner, afterTitle);
    await expect(
      learner.getByRole("heading", {
        name: "Сколько будет 6 + 7? 🧮",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      learner.getByLabel("Ответ на задание 1", { exact: true }),
    ).toHaveValue("");
  } finally {
    await learner.close();
    await colleague.close();
    await guardian.close();
  }
});

// Synthetic signed launch data uses the audit server's documented test key.
// CDN is replaced locally; no real MAX account, bot, network or personal data.
async function registerSyntheticNonDemo(
  page: Page,
  role: "Преподаватель" | "Ученик",
  alias: string,
) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({
      id: randomInt(1_000_000_000, 9_000_000_000),
      first_name: "Синтетический",
    }),
    query_id: "audit-demo-reset",
  };
  const key = createHmac("sha256", "WebAppData")
    .update("synthetic-max-test-token")
    .digest();
  const hash = createHmac("sha256", key)
    .update(
      Object.entries(fields)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => k + "=" + v)
        .join("\n"),
    )
    .digest("hex");
  const raw = new URLSearchParams({ ...fields, hash }).toString();
  await page.route("https://st.max.ru/js/max-web-app.js", (route) =>
    route.fulfill({ body: 'window.WebApp={initData:""}' }),
  );
  await page.route("https://telegram.org/js/telegram-web-app.js", (route) =>
    route.fulfill({
      body: 'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}',
    }),
  );
  await page.goto("/#WebAppData=" + encodeURIComponent(raw));
  await page.getByLabel("Как к вам обращаться").fill(alias);
  await page
    .locator(".registration-role")
    .filter({ has: page.getByRole("radio", { name: new RegExp("^" + role) }) })
    .click();
  const registered = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/auth/max" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Войти через MAX", exact: true })
    .click();
  const response = await registered;
  expect(response.status()).toBe(200);
  const { user } = await response.json();
  expect(user.demo).toBe(0);
  expect(user.alias).toBe(alias);
  await expect(
    page.getByRole("heading", {
      name:
        role === "Преподаватель"
          ? "Хороший день, чтобы учить."
          : "Ваш следующий шаг.",
      exact: true,
    }),
  ).toBeVisible();
}

async function ownSnapshot(page: Page, alias: string) {
  await settings(page, alias);
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Скачать мои данные", exact: true })
    .click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe("reprep-my-data.json");
  expect(await file.failure()).toBeNull();
  const data = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(data.account.demo).toBe(0);
  expect(data.account.alias).toBe(alias);
  expect(Object.keys(data.account).sort()).toEqual([
    "alias",
    "demo",
    "external_id",
    "id",
    "role",
  ]);
  await expect(
    page.getByText("Файл экспорта передан браузеру", { exact: true }),
  ).toBeVisible();
  const { exported_at: _exportedAt, ...snapshot } = data;
  return snapshot;
}

test("demo reset UI preserves synthetic non-demo identities, sessions, relationship, assignment and saved learner draft", async ({
  page,
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  const tutorAlias = "Синтетический постоянный преподаватель 🧪";
  const learnerAlias = "Синтетический постоянный ученик 🧪";
  const title = "Синтетическая работа вне демо 🧪";
  try {
    await registerSyntheticNonDemo(tutor, "Преподаватель", tutorAlias);
    await registerSyntheticNonDemo(learner, "Ученик", learnerAlias);
    await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
    await tutor
      .getByRole("button", { name: "Пригласить ученика", exact: true })
      .click();
    const code = await tutor.locator(".invite-box code").innerText();
    await settings(learner, learnerAlias);
    await learner.getByLabel("Код приглашения", { exact: true }).fill(code);
    await learner
      .getByRole("button", { name: "Посмотреть приглашение", exact: true })
      .click();
    await expect(
      learner.getByText(new RegExp("Преподаватель: " + tutorAlias)),
    ).toBeVisible();
    await learner
      .getByRole("button", { name: "Принять приглашение", exact: true })
      .click();
    await expect(
      learner.getByText("Вы подключились к преподавателю", { exact: true }),
    ).toBeVisible();
    await tutor.reload();
    await createNumeric(tutor, title, true, true);
    await learner.reload();
    await openWork(learner, title);
    await learner.getByLabel("Ответ на задание 1", { exact: true }).fill("13");
    await learner
      .getByRole("button", { name: "Сохранить ответы", exact: true })
      .click();
    await expect(learner.getByRole("status")).toHaveText("Сохранено");
    const tutorBefore = await ownSnapshot(tutor, tutorAlias);
    const learnerBefore = await ownSnapshot(learner, learnerAlias);
    expect(tutorBefore.assignments).toHaveLength(1);
    expect(tutorBefore.assignments[0].title).toBe(title);
    expect(learnerBefore.drafts).toHaveLength(1);
    expect(Object.values(learnerBefore.drafts[0].answers)).toEqual(["13"]);
    await expect(
      tutor.getByRole("button", { name: "Восстановить демо", exact: true }),
    ).toHaveCount(0);

    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await createNumeric(
      page,
      "Синтетический удаляемый демо-черновик",
      false,
      false,
    );
    await settings(page, "Алекс • демо");
    await resetFromUI(page, true);
    await page.getByRole("button", { name: "Задания", exact: true }).click();
    await expect(page.locator(".assignment-row")).toHaveCount(2);
    await expect(
      page.getByRole("button", {
        name: /Синтетический удаляемый демо-черновик/,
      }),
    ).toHaveCount(0);

    await reloadSession(tutor, 200);
    await reloadSession(learner, 200);
    expect(await ownSnapshot(tutor, tutorAlias)).toEqual(tutorBefore);
    expect(await ownSnapshot(learner, learnerAlias)).toEqual(learnerBefore);
    await openWork(learner, title);
    await expect(
      learner.getByLabel("Ответ на задание 1", { exact: true }),
    ).toHaveValue("13");
    await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
    await expect(tutor.locator(".learner-list button")).toHaveCount(1);
    await expect(tutor.locator(".learner-list")).toContainText(learnerAlias);
  } finally {
    await tutor.close();
    await learner.close();
  }
});
