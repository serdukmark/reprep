import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";

// U020 / FR-AUTH-003 / FR-PROG-001–003. All learning data is created through
// UI; interceptors only select a fresh identity and substitute a foreign ID.
const ownTitle = "Своя работа для карты прогресса 🧪";
const foreignTitle = "Приватная работа коллеги для карты прогресса 🧪";
const ownSkill = "Свой подтверждённый навык равенств 🧪";
const foreignSkill = "Чужой подтверждённый навык равенств 🧪";

async function login(page: Page, role: string) {
  await page.goto("/");
  await page.getByRole("button", { name: role, exact: true }).click();
}

async function openProgress(page: Page, pupil: RegExp) {
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: pupil }).click();
  await expect(
    page.getByRole("heading", { name: "Карта навыков", exact: true }),
  ).toBeVisible();
}

async function createReviewedWork(
  tutor: Page,
  learner: Page,
  pupil: RegExp,
  title: string,
  skill: string,
) {
  await tutor
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await tutor.getByLabel("Название работы").fill(title);
  await tutor.getByRole("combobox", { name: "Ученик", exact: true }).click();
  await tutor.getByRole("option", { name: pupil }).click();
  await tutor
    .getByLabel("Условие", { exact: true })
    .fill("Сколько будет 2 + 3?");
  await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await tutor.getByLabel("Навык", { exact: true }).fill(skill);
  const created = tutor.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/assignments" &&
      response.request().method() === "POST",
  );
  await tutor
    .getByRole("button", { name: "Назначить ученику", exact: true })
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  const work: { relationship_id: string } = await response.json();
  expect(work.relationship_id).toBeTruthy();
  await expect(
    tutor.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();

  await learner.reload();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await learner.getByLabel("Ответ на задание 1").fill("5");
  await learner
    .getByRole("button", { name: "Сохранить ответы", exact: true })
    .click();
  await expect(learner.getByRole("status")).toHaveText("Сохранено");
  learner.once("dialog", (dialog) => dialog.accept());
  await learner
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(learner.locator(".work-task .original p")).toHaveText("5");
  await tutor.reload();
  await tutor.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    tutor.getByRole("button", { name: "Подтвердить разбор", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await tutor
    .getByRole("button", { name: "Подтвердить разбор", exact: true })
    .click();
  await expect(
    tutor.getByText("Проверено преподавателем", { exact: true }),
  ).toBeVisible();
  return work.relationship_id;
}

async function assertEvidence(page: Page, skill: string, title: string) {
  const panel = page.locator(".progress-panel");
  const entry = panel
    .locator("details.skill")
    .filter({ has: page.getByText(skill, { exact: true }) });
  await expect(entry).toHaveCount(1);
  await expect(entry.locator("summary")).toContainText(
    "1 проверенных ответов · 1 верных",
  );
  if ((await entry.getAttribute("open")) === null)
    await entry.locator("summary").click();
  await expect(entry.locator(".evidence")).toHaveCount(1);
  await expect(entry.locator(".evidence")).toContainText(title);
  await expect(entry.locator(".evidence")).toContainText(
    "Подтверждён AI-разбор",
  );
}

test("tutor progress: a foreign relationship with confirmed evidence is denied and own selection recovers", async ({
  page,
  browser,
}) => {
  const learner = await browser.newPage();
  const foreignTutor = await browser.newPage();
  const foreignLearner = await browser.newPage();
  try {
    await login(page, "Я преподаватель");
    await login(learner, "Я ученик");
    const ownRelationship = await createReviewedWork(
      page,
      learner,
      /Саша • демо/,
      ownTitle,
      ownSkill,
    );
    expect(ownRelationship).toBe("demo-link");

    await login(foreignTutor, "Другой преподаватель · демо");
    await foreignTutor
      .getByRole("button", { name: "Ученики", exact: true })
      .click();
    await foreignTutor
      .getByRole("button", { name: "Пригласить ученика", exact: true })
      .click();
    const code = await foreignTutor.locator(".invite-box code").innerText();
    await foreignLearner.route("**/api/auth/demo/learner", (route) =>
      route.continue({
        url: new URL("/__audit__/identity/learner", route.request().url()).href,
      }),
    );
    await login(foreignLearner, "Я ученик");
    await foreignLearner
      .getByRole("button", { name: /Новый ученик • аудит/ })
      .click();
    await foreignLearner
      .getByLabel("Код приглашения", { exact: true })
      .fill(code);
    await foreignLearner
      .getByRole("button", { name: "Посмотреть приглашение", exact: true })
      .click();
    await foreignLearner
      .getByRole("button", { name: "Принять приглашение", exact: true })
      .click();
    await expect(
      foreignLearner.getByText("Вы подключились к преподавателю", {
        exact: true,
      }),
    ).toBeVisible();
    await foreignTutor.reload();
    const foreignRelationship = await createReviewedWork(
      foreignTutor,
      foreignLearner,
      /Новый ученик • аудит/,
      foreignTitle,
      foreignSkill,
    );
    expect(foreignRelationship).not.toBe(ownRelationship);
    await openProgress(foreignTutor, /Новый ученик • аудит/);
    await assertEvidence(foreignTutor, foreignSkill, foreignTitle);
    await openProgress(page, /Саша • демо/);
    await assertEvidence(page, ownSkill, ownTitle);

    // Start from another authorized pupil, so choosing Sasha must issue a new
    // progress request instead of simply retaining the selected card.
    await page.getByRole("button", { name: /Женя • демо/ }).click();
    await expect(
      page.locator(".progress-panel").getByText(ownSkill, { exact: true }),
    ).toHaveCount(0);
    const path = "**/api/relationships/demo-link/progress";
    let denied = 0;
    await page.route(path, async (route) => {
      expect(route.request().method()).toBe("GET");
      const response = await route.fetch({
        url: new URL(
          `/api/relationships/${foreignRelationship}/progress`,
          route.request().url(),
        ).href,
      });
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain(foreignSkill);
      denied++;
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Запись не найдена" }),
    ).toBeVisible();
    expect(denied).toBe(1);
    await expect(page.locator(".learner-list button.active")).toContainText(
      "Саша • демо",
    );
    await expect(page.getByText(foreignSkill, { exact: true })).toHaveCount(0);
    await expect(page.getByText(foreignTitle, { exact: true })).toHaveCount(0);
    // Current UI clears the previous summary before requesting progress. On
    // 404 the map is empty and the failure is visible; no stale summary claim.
    await expect(page.locator(".progress-panel details.skill")).toHaveCount(0);
    await expect(
      page
        .locator(".progress-panel")
        .getByText("Прогресс начинается с обратной связи", { exact: true }),
    ).toBeVisible();

    await page.unroute(path);
    await page.getByRole("button", { name: /Женя • демо/ }).click();
    const recovered = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          "/api/relationships/demo-link/progress" &&
        response.request().method() === "GET",
    );
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    expect((await recovered).status()).toBe(200);
    await assertEvidence(page, ownSkill, ownTitle);
    await expect(page.getByText(foreignSkill, { exact: true })).toHaveCount(0);
    // Selection recovers the data; a fresh load also starts without the prior
    // global alert. This does not claim that selection alone dismisses it.
    await page.reload();
    await openProgress(page, /Саша • демо/);
    await assertEvidence(page, ownSkill, ownTitle);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText(foreignSkill, { exact: true })).toHaveCount(0);
    await foreignTutor.reload();
    await openProgress(foreignTutor, /Новый ученик • аудит/);
    await assertEvidence(foreignTutor, foreignSkill, foreignTitle);
    await expect(foreignTutor.getByText(ownSkill, { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await learner.close();
    await foreignTutor.close();
    await foreignLearner.close();
  }
});
