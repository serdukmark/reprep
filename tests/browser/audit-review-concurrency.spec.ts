import { test, expect } from "./audit-fixtures";
for (const mode of ["same", "conflict"])
  test(`review two tabs ${mode}: the first teacher decision remains authoritative`, async ({
    context,
    request,
  }) => {
    const login = await request.post("/api/auth/demo/tutor");
    const headers = { Authorization: "Bearer " + (await login.json()).token };
    const created = await request.post("/api/assignments", {
      headers,
      data: {
        relationship_id: "demo-link",
        title: "Одно решение преподавателя",
        tasks: [
          {
            id: "one",
            type: "numeric",
            prompt: "Сколько будет 2+3?",
            answer: "5",
            skill: "Единственный результат",
          },
        ],
      },
    });
    expect(created.ok()).toBe(true);
    const aid = (await created.json()).id;
    expect(
      (await request.post(`/api/assignments/${aid}/publish`, { headers })).ok(),
    ).toBe(true);
    const learner = await context.newPage(),
      first = await context.newPage(),
      second = await context.newPage();
    await learner.goto("/");
    await learner
      .getByRole("button", { name: "Я ученик", exact: true })
      .click();
    await learner
      .getByRole("button", { name: /Одно решение преподавателя/ })
      .click();
    await learner.getByLabel("Ответ на задание 1").fill("5");
    await expect(learner.getByRole("status")).toHaveText("Сохранено");
    learner.once("dialog", (d) => d.accept());
    await learner
      .getByRole("button", { name: "Отправить работу", exact: true })
      .click();
    for (const page of [first, second]) {
      await page.goto("/");
      await page
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
      await page
        .getByRole("button", { name: /Одно решение преподавателя/ })
        .click();
      await expect(
        page.getByRole("button", { name: "Подтвердить разбор", exact: true }),
      ).toBeVisible({ timeout: 15000 });
    }
    const snapshot = await (
      await request.get(`/api/assignments/${aid}`, { headers })
    ).json();
    await second.route(`**/api/assignments/${aid}`, (r) =>
      r.fulfill({ json: snapshot }),
    );
    if (mode === "conflict")
      await second
        .getByLabel("Комментарий к работе")
        .fill("Запоздавшая отмена");
    await first
      .getByRole("button", { name: "Подтвердить разбор", exact: true })
      .click();
    await expect(
      first.getByText("Проверено преподавателем", { exact: true }),
    ).toBeVisible();
    const ack = second.waitForResponse((r) =>
      /\/api\/submissions\/[^/]+\/review$/.test(new URL(r.url()).pathname),
    );
    await second
      .getByRole("button", {
        name: mode === "same" ? "Подтвердить разбор" : "Вернуть на доработку",
        exact: true,
      })
      .click();
    expect((await ack).status()).toBe(mode === "same" ? 200 : 409);
    if (mode === "conflict") {
      await expect(second.getByRole("alert").first()).toContainText(
        "Решение уже сохранено",
      );
      await expect(second.getByLabel("Комментарий к работе")).toHaveValue(
        "Запоздавшая отмена",
      );
    }
    await second.unroute(`**/api/assignments/${aid}`);
    await second.reload();
    await second
      .getByRole("button", { name: /Одно решение преподавателя/ })
      .click();
    await expect(
      second.getByText("Проверено преподавателем", { exact: true }),
    ).toBeVisible();
    await learner.reload();
    await learner
      .getByRole("button", { name: /Одно решение преподавателя/ })
      .click();
    await expect(
      learner.getByText("Проверено преподавателем", { exact: true }),
    ).toBeVisible();
    await expect(
      learner.getByRole("button", { name: "Отправить работу", exact: true }),
    ).toHaveCount(0);
    await learner
      .getByRole("button", { name: "Мой прогресс", exact: true })
      .click();
    await expect(
      learner.getByText("Единственный результат", { exact: true }),
    ).toBeVisible();
    await expect(
      learner.getByText("1 проверенных ответов · 1 верных", { exact: true }),
    ).toBeVisible();
  });
