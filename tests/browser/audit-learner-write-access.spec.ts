import { test, expect, choose } from "./audit-fixtures";
import type { Browser, Page } from "@playwright/test";

// FR-SUB-002/003/004, FR-AUTH-001 and the cross-learner security gate.
// Both relationships, assignments, drafts and submitted originals are made
// through UI. Routes select fresh synthetic identities and substitute only
// the malicious assignment ID; no API fixture creates or inspects work.
const ownTitle = "Своя работа проверки записи 🧪";
const foreignTitle = "Чужая работа проверки записи 🧪";
const ownOriginal =
  "Мой первый ответ: равенство сохраняется 🧪\nВторая строка.";
const ownChanged =
  "Мой исправленный ответ: Ё, <текст> & 2 + 3 = 5 🧪\nНовая строка.";
const foreignOriginal = "Чужой приватный ответ 🧪\nЕго нельзя менять.";
const foreignChanged =
  "Чужой приватный черновик после возврата 🧪\nНовая попытка ещё не сдана.";

async function login(page: Page, role: string) {
  await page.goto("/");
  await page.getByRole("button", { name: role, exact: true }).click();
}

async function openWork(page: Page, title: string) {
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

async function reloadWork(page: Page, title: string) {
  await page.reload();
  await openWork(page, title);
}

async function createPair(
  tutor: Page,
  learner: Page,
  role: string,
  title: string,
) {
  await login(tutor, role);
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor
    .getByRole("button", { name: "Пригласить ученика", exact: true })
    .click();
  const code = await tutor.locator(".invite-box code").innerText();
  await learner.route("**/api/auth/demo/learner", (route) =>
    route.continue({
      url: new URL("/__audit__/identity/learner", route.request().url()).href,
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
  await tutor
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await tutor.getByLabel("Название работы").fill(title);
  await tutor.getByRole("combobox", { name: "Ученик", exact: true }).click();
  await tutor.getByRole("option", { name: /Новый ученик • аудит/ }).click();
  await choose(
    tutor.getByRole("combobox", { name: "Формат ответа", exact: true }),
    "short_text",
  );
  await tutor
    .getByLabel("Условие", { exact: true })
    .fill("Объясните, почему одинаковое преобразование сохраняет равенство.");
  await tutor
    .getByLabel("Критерии проверки", { exact: true })
    .fill("Ученик объясняет одинаковое преобразование обеих частей.");
  await tutor
    .getByLabel("Навык", { exact: true })
    .fill("Преобразование равенств");
  const created = tutor.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/assignments" &&
      response.request().method() === "POST",
  );
  await tutor
    .getByRole("button", { name: "Назначить ученику", exact: true })
    .click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const assignmentId: string = (await response.json()).id;
  expect(assignmentId).toBeTruthy();
  await expect(
    tutor.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await reloadWork(learner, title);
  return assignmentId;
}

async function prepare(browser: Browser, learner: Page) {
  const tutor = await browser.newPage();
  const foreignTutor = await browser.newPage();
  const foreignLearner = await browser.newPage();
  const close = async () => {
    await tutor.close();
    await foreignTutor.close();
    await foreignLearner.close();
  };
  try {
    const ownId = await createPair(tutor, learner, "Я преподаватель", ownTitle);
    const foreignId = await createPair(
      foreignTutor,
      foreignLearner,
      "Другой преподаватель · демо",
      foreignTitle,
    );
    expect(ownId).not.toBe(foreignId);
    return { tutor, foreignTutor, foreignLearner, ownId, foreignId, close };
  } catch (error) {
    await close();
    throw error;
  }
}

async function saveAnswer(page: Page, answer: string) {
  await page.getByLabel("Ответ на задание 1").fill(answer);
  await page
    .getByRole("button", { name: "Сохранить ответы", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Сохранено");
}

async function submit(page: Page, assignmentId: string, expectedStatus = 200) {
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === `/api/assignments/${assignmentId}/submit` &&
      r.request().method() === "POST",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  expect((await response).status()).toBe(expectedStatus);
}

async function assertHistory(page: Page, originals: string[]) {
  const toggle = page.getByRole("button", { name: /^История попыток/ });
  if (originals.length === 0) {
    // Before a first submission the UI omits the entire history component.
    // Callers also check the editable saved answer and the tutor's absent original.
    await expect(toggle).toHaveCount(0);
    return;
  }
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    const loaded = page.waitForResponse(
      (response) =>
        /^\/api\/assignments\/[^/]+\/attempts$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === "GET",
    );
    await toggle.click();
    expect((await loaded).status()).toBe(200);
  }
  const history = page.locator(".attempt-history");
  // Wait for the history request as well as its DOM rows, especially for []:
  // an immediately empty container alone would not prove an empty archive.
  await expect(
    history.getByText(
      "Отправленные ответы сохраняются неизменными. Эти ответы видны только ученику и его преподавателю.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(history.getByRole("status")).toHaveCount(0);
  await expect(history.getByRole("alert")).toHaveCount(0);
  await expect(history.locator(".assignment-row")).toHaveCount(
    originals.length,
  );
  for (const [index, original] of originals.entries()) {
    await history
      .getByRole("button", { name: new RegExp(`^Попытка ${index + 1} `) })
      .click();
    await expect(
      history.locator(".attempt-detail .original p"),
    ).toHaveJSProperty("textContent", original);
  }
}

async function returnWork(
  tutor: Page,
  learner: Page,
  title: string,
  answer: string,
) {
  await reloadWork(tutor, title);
  await expect(
    tutor.locator(".work-task .original p").first(),
  ).toHaveJSProperty("textContent", answer);
  await tutor
    .getByLabel("Комментарий к работе")
    .fill("Добавьте пояснение, сохранив первую попытку 🧪");
  await tutor
    .getByRole("button", { name: "Вернуть на доработку", exact: true })
    .click();
  await expect(tutor.getByText(/Преподаватель вернул работу:/)).toBeVisible();
  await reloadWork(learner, title);
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue(answer);
}

async function assertForeignUnchanged(
  learner: Page,
  tutor: Page,
  draft: string,
  originals: string[],
) {
  await reloadWork(learner, foreignTitle);
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue(draft);
  await expect(
    learner.getByRole("button", { name: "Отправить работу", exact: true }),
  ).toBeEnabled();
  await assertHistory(learner, originals);
  await reloadWork(tutor, foreignTitle);
  if (originals.length) {
    await expect(
      tutor.locator(".work-task .original p").first(),
    ).toHaveJSProperty("textContent", originals[originals.length - 1]);
    await expect(tutor.getByText(/Преподаватель вернул работу:/)).toBeVisible();
  } else {
    await expect(tutor.locator(".work-task .original")).toHaveCount(0);
    await expect(
      tutor.getByRole("heading", { name: "Ваше решение", exact: true }),
    ).toHaveCount(0);
  }
  await expect(tutor.getByText(draft, { exact: true })).toHaveCount(0);
}

for (const mode of ["manual save", "autosave"] as const)
  test(`learner ${mode}: foreign assignment ID is denied, retains input and correct retry survives reload`, async ({
    browser,
    page,
  }) => {
    const data = await prepare(browser, page);
    try {
      await saveAnswer(page, ownOriginal);
      await saveAnswer(data.foreignLearner, foreignOriginal);
      const path = `**/api/assignments/${data.ownId}/draft`;
      let denied = 0;
      await page.route(path, async (route) => {
        const response = await route.fetch({
          url: new URL(
            `/api/assignments/${data.foreignId}/draft`,
            route.request().url(),
          ).href,
        });
        expect(response.status()).toBe(404);
        denied++;
        await route.fulfill({ response });
      });
      await page.getByLabel("Ответ на задание 1").fill(ownChanged);
      if (mode === "manual save")
        await page
          .getByRole("button", { name: "Сохранить ответы", exact: true })
          .click();
      await expect(page.locator(".save-error")).toContainText(
        "Запись не найдена",
      );
      expect(denied).toBe(1);
      await expect(page.getByLabel("Ответ на задание 1")).toHaveValue(
        ownChanged,
      );
      await expect(page.getByRole("status")).toContainText(
        "Есть несохранённые ответы",
      );
      await expect(page.getByRole("status")).not.toHaveText("Сохранено");
      await assertForeignUnchanged(
        data.foreignLearner,
        data.foreignTutor,
        foreignOriginal,
        [],
      );
      await expect(page.getByLabel("Ответ на задание 1")).toHaveValue(
        ownChanged,
      );
      await page.unroute(path);
      await page
        .getByRole("button", { name: "Сохранить ответы", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveText("Сохранено");
      await reloadWork(page, ownTitle);
      await expect(page.getByLabel("Ответ на задание 1")).toHaveValue(
        ownChanged,
      );
      await assertHistory(page, []);
      await assertForeignUnchanged(
        data.foreignLearner,
        data.foreignTutor,
        foreignOriginal,
        [],
      );
    } finally {
      await data.close();
    }
  });

for (const mode of ["first submission", "returned submission"] as const)
  test(`learner ${mode}: foreign assignment ID cannot submit or overwrite another learner's original`, async ({
    browser,
    page,
  }) => {
    const data = await prepare(browser, page);
    try {
      await saveAnswer(page, ownOriginal);
      await saveAnswer(data.foreignLearner, foreignOriginal);
      const returned = mode === "returned submission";
      if (returned) {
        await submit(page, data.ownId);
        await submit(data.foreignLearner, data.foreignId);
        await returnWork(data.tutor, page, ownTitle, ownOriginal);
        await returnWork(
          data.foreignTutor,
          data.foreignLearner,
          foreignTitle,
          foreignOriginal,
        );
        await saveAnswer(data.foreignLearner, foreignChanged);
      }
      await saveAnswer(page, ownChanged);
      const path = `**/api/assignments/${data.ownId}/submit`;
      let denied = 0;
      await page.route(path, async (route) => {
        const response = await route.fetch({
          url: new URL(
            `/api/assignments/${data.foreignId}/submit`,
            route.request().url(),
          ).href,
        });
        expect(response.status()).toBe(404);
        denied++;
        await route.fulfill({ response });
      });
      await submit(page, data.ownId, 404);
      await expect(
        page.getByRole("alert").filter({ hasText: "Запись не найдена" }),
      ).toBeVisible();
      expect(denied).toBe(1);
      await expect(page.getByLabel("Ответ на задание 1")).toHaveValue(
        ownChanged,
      );
      await expect(
        page.getByRole("button", { name: "Отправить работу", exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByText("Ответы сохранены и отправлены.", { exact: false }),
      ).toHaveCount(0);
      await assertHistory(page, returned ? [ownOriginal] : []);
      await assertForeignUnchanged(
        data.foreignLearner,
        data.foreignTutor,
        returned ? foreignChanged : foreignOriginal,
        returned ? [foreignOriginal] : [],
      );

      await page.unroute(path);
      await submit(page, data.ownId);
      await expect(page.getByLabel("Ответ на задание 1")).toHaveCount(0);
      await expect(
        page.getByText("Ответы сохранены и отправлены.", { exact: false }),
      ).toBeVisible();
      await reloadWork(page, ownTitle);
      await expect(
        page.locator(".work-task .original p").first(),
      ).toHaveJSProperty("textContent", ownChanged);
      await assertHistory(
        page,
        returned ? [ownOriginal, ownChanged] : [ownChanged],
      );
      await reloadWork(data.tutor, ownTitle);
      await expect(
        data.tutor.locator(".work-task .original p").first(),
      ).toHaveJSProperty("textContent", ownChanged);
      await assertHistory(
        data.tutor,
        returned ? [ownOriginal, ownChanged] : [ownChanged],
      );
      await assertForeignUnchanged(
        data.foreignLearner,
        data.foreignTutor,
        returned ? foreignChanged : foreignOriginal,
        returned ? [foreignOriginal] : [],
      );
    } finally {
      await data.close();
    }
  });
