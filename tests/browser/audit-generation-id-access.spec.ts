import { test, expect, choose } from "./audit-fixtures";
import type { Page } from "@playwright/test";

async function login(page: Page, role: string) {
  await page.goto("/");
  await page.getByRole("button", { name: role, exact: true }).click();
}

async function connectForeignLearner(tutor: Page, learner: Page) {
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor
    .getByRole("button", { name: "Пригласить ученика", exact: true })
    .click();
  const code = await tutor.locator(".invite-box code").innerText();
  // The account is synthetic; all invitation and resource writes use visible UI.
  await learner.route("**/api/auth/demo/learner", (r) =>
    r.continue({
      url: new URL("/__audit__/identity/learner", r.request().url()).href,
    }),
  );
  await login(learner, "Я ученик");
  await learner.getByRole("button", { name: /Новый ученик • аудит/ }).click();
  await learner.getByLabel("Код приглашения", { exact: true }).fill(code);
  await learner
    .getByRole("button", { name: "Посмотреть приглашение", exact: true })
    .click();
  await learner
    .getByRole("button", { name: "Принять приглашение", exact: true })
    .click();
  await expect(
    learner.getByText("Вы подключились к преподавателю", { exact: true }),
  ).toBeVisible();
  await tutor.reload();
}

function sourceCards(page: Page, title: string) {
  return page.locator(".material-card").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}

async function createSource(page: Page, title: string, foreign: boolean) {
  await page.getByRole("button", { name: "Материалы", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить материал", exact: true })
    .click();
  await page.getByLabel("Название", { exact: true }).fill(title);
  const pupil = page.getByRole("combobox", { name: "Ученик", exact: true });
  if (foreign) {
    await pupil.click();
    await page.getByRole("option", { name: /Новый ученик • аудит/ }).click();
  } else {
    await choose(pupil, "demo-link");
  }
  await page.getByLabel("Или файл TXT").setInputFiles({
    name: foreign ? "private-source.txt" : "own-source.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      `${title}. Синтетический материал: сумма двух и трёх равна пяти. Для сложения начинаем с двух и добавляем три единицы.`,
    ),
  });
  await page.getByRole("checkbox", { name: /Разрешаю/ }).check();
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/materials") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  const id: string = (await response.json()).id;
  await expect(sourceCards(page, title)).toHaveCount(1);
  return id;
}

async function reloadHistory(page: Page, title: string, id: string) {
  await page.reload();
  await page.getByRole("button", { name: "Материалы", exact: true }).click();
  await expect(sourceCards(page, title).first()).toBeVisible();
  const loaded = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/materials/${id}/generations`) &&
      r.request().method() === "GET",
  );
  // Successful generation also creates a source snapshot with the same title.
  // Expand both cards; exactly one real generation belongs to the original.
  for (const summary of await sourceCards(page, title)
    .getByText("Создать задания из этого TXT", { exact: true })
    .all())
    await summary.click();
  const response = await loaded;
  expect(response.ok()).toBe(true);
  return response.json();
}

for (const method of ["GET", "POST"] as const)
  test(`generation ${method}: real foreign material is denied and own retry creates one draft`, async ({
    browser,
    page,
  }) => {
    test.skip(
      process.env.E2E_AUDIT !== "1",
      "Requires the isolated synthetic audit server and fixture AI",
    );
    const foreign = await browser.newPage(),
      child = await browser.newPage();
    const privateTitle = "Приватный источник коллеги 🧪";
    const ownTitle = "Свой источник для генерации 🧪";
    try {
      await login(foreign, "Другой преподаватель · демо");
      await connectForeignLearner(foreign, child);
      const foreignId = await createSource(foreign, privateTitle, true);
      const foreignCard = sourceCards(foreign, privateTitle);
      await foreignCard
        .getByText("Создать задания из этого TXT", { exact: true })
        .click();
      await foreignCard.getByLabel("Количество заданий").fill("2");
      await foreignCard
        .getByRole("button", { name: "Подготовить AI-черновик", exact: true })
        .click();
      await expect(
        foreignCard.getByRole("button", {
          name: "Открыть AI-черновик (2 заданий)",
          exact: true,
        }),
      ).toHaveCount(1, { timeout: 15000 });
      const foreignBefore = await reloadHistory(
        foreign,
        privateTitle,
        foreignId,
      );
      expect(foreignBefore).toHaveLength(1);
      expect(foreignBefore[0].status).toBe("completed");

      await login(page, "Я преподаватель");
      const ownId = await createSource(page, ownTitle, false);
      const ownCard = sourceCards(page, ownTitle);
      const path = `**/api/materials/${ownId}/generations`;
      let denied = 0;
      await page.route(path, async (r) => {
        if (r.request().method() !== method) return r.continue();
        const response = await r.fetch({
          url: r.request().url().replace(ownId, foreignId),
        });
        expect(response.status()).toBe(404);
        denied++;
        await r.fulfill({ response });
      });
      await ownCard
        .getByText("Создать задания из этого TXT", { exact: true })
        .click();
      await ownCard.getByLabel("Количество заданий").fill("1");
      if (method === "POST")
        await ownCard
          .getByRole("button", { name: "Подготовить AI-черновик", exact: true })
          .click();
      await expect(ownCard.getByRole("alert")).toBeVisible();
      expect(denied).toBeGreaterThanOrEqual(1);
      await expect(ownCard.getByLabel("Количество заданий")).toHaveValue("1");
      await expect(
        ownCard.getByRole("button", {
          name: "Подготовить AI-черновик",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(
        page.getByRole("button", { name: /Открыть AI-черновик/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: privateTitle, exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: "Скачать own-source.txt",
          exact: true,
        }),
      ).toBeVisible();
      expect(await reloadHistory(foreign, privateTitle, foreignId)).toEqual(
        foreignBefore,
      );
      await expect(
        sourceCards(foreign, privateTitle).getByRole("button", {
          name: /Открыть AI-черновик/,
        }),
      ).toHaveCount(1);

      await page.unroute(path);
      expect(await reloadHistory(page, ownTitle, ownId)).toEqual([]);
      await expect(page.getByRole("alert")).toHaveCount(0);
      await sourceCards(page, ownTitle)
        .getByLabel("Количество заданий")
        .fill("1");
      await sourceCards(page, ownTitle)
        .getByRole("button", { name: "Подготовить AI-черновик", exact: true })
        .click();
      await expect(
        sourceCards(page, ownTitle).getByRole("button", {
          name: "Открыть AI-черновик (1 заданий)",
          exact: true,
        }),
      ).toHaveCount(1, { timeout: 15000 });
      const ownAfter = await reloadHistory(page, ownTitle, ownId);
      expect(ownAfter).toHaveLength(1);
      expect(ownAfter[0].status).toBe("completed");
      expect(ownAfter[0].assignment_id).not.toBe(
        foreignBefore[0].assignment_id,
      );
      await expect(
        sourceCards(page, ownTitle).getByRole("button", {
          name: /Открыть AI-черновик/,
        }),
      ).toHaveCount(1);
      await page
        .getByRole("button", {
          name: "Открыть AI-черновик (1 заданий)",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("textbox", { name: "Условие", exact: true }),
      ).toHaveValue("Сколько будет 2+3?");
      expect(await reloadHistory(foreign, privateTitle, foreignId)).toEqual(
        foreignBefore,
      );
    } finally {
      await foreign.close();
      await child.close();
    }
  });
