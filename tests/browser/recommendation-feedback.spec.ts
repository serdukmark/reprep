import { test, expect, choose } from "./audit-fixtures";
test("confirmed gap opens private practice draft and learner reports usefulness", async ({
  browser,
  request,
}) => {
  const th = {
    Authorization:
      "Bearer " +
      (await (await request.post("/api/auth/demo/tutor")).json()).token,
  };
  const lh = {
    Authorization:
      "Bearer " +
      (await (await request.post("/api/auth/demo/learner")).json()).token,
  };
  const title = "Проверка рекомендации " + Date.now();
  const aid = (
    await (
      await request.post("/api/assignments", {
        headers: th,
        data: {
          relationship_id: "demo-link",
          title,
          instructions: "Покажите вычисления",
          tasks: [
            {
              id: "practice",
              type: "numeric",
              prompt: "2+2?",
              answer: "4",
              rubric: "Сложить два и два",
              skill: "Навык рекомендации",
              options: [],
              hint: "",
            },
          ],
        },
      })
    ).json()
  ).id;
  await request.post("/api/assignments/" + aid + "/publish", { headers: th });
  const sid = (
    await (
      await request.post("/api/assignments/" + aid + "/submit", {
        headers: lh,
        data: { revision: 0, answers: { practice: "5" } },
      })
    ).json()
  ).id;
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get("/api/assignments/" + aid, { headers: th })
          ).json()
        ).submission.status,
    )
    .toBe("awaiting_review");
  expect(
    (
      await request.post("/api/submissions/" + sid + "/review", {
        headers: th,
        data: {
          action: "corrected",
          tasks: [
            {
              task_id: "practice",
              correctness: "incorrect",
              feedback: "Пересчитайте слагаемые.",
            },
          ],
          note: "",
        },
      })
    ).ok(),
  ).toBeTruthy();
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor.getByRole("button", { name: /Саша • демо/ }).click();
  const card = tutor.locator(".recommendations .work-task").filter({
    has: tutor.getByRole("heading", {
      name: "Навык рекомендации",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Подготовить тренировку" }).click();
  await expect(
    tutor.getByRole("heading", { name: "Редактирование работы", exact: true }),
  ).toBeVisible();
  await tutor
    .getByRole("button", { name: "Глазами ученика", exact: true })
    .click();
  await expect(
    tutor.getByLabel("Эталонный ответ", { exact: true }),
  ).toHaveCount(0);
  await expect(tutor.getByText("2+2?", { exact: true })).toBeVisible();
  await tutor
    .getByRole("button", { name: "Вернуться к редактору", exact: true })
    .click();
  await expect(
    tutor.getByLabel("Эталонный ответ", { exact: true }),
  ).toHaveValue("4");
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await choose(
    learner.getByRole("combobox", { name: "Тип отзыва", exact: true }),
    "useful",
  );
  await learner
    .getByLabel("Комментарий к разбору", { exact: true })
    .fill("Стало понятнее");
  await learner
    .getByRole("button", { name: "Отправить отзыв о разборе", exact: true })
    .click();
  await expect(
    learner.getByText("Сообщение сохранено для разбора командой", {
      exact: true,
    }),
  ).toBeVisible();
  await choose(
    learner.getByRole("combobox", { name: "Тип отзыва", exact: true }),
    "harmful_feedback",
  );
  await learner
    .getByLabel("Комментарий к разбору", { exact: true })
    .fill("Синтетическая жалоба");
  const saved = learner.waitForResponse(
    (r) => r.url().endsWith("/api/reports") && r.request().method() === "POST",
  );
  await learner
    .getByRole("button", { name: "Отправить отзыв о разборе", exact: true })
    .click();
  expect((await saved).ok()).toBeTruthy();
  const exported = await (
    await request.get("/api/account/export", { headers: lh })
  ).json();
  expect(
    exported.reports
      .filter((r: any) => r.context_id === aid)
      .map((r: any) => r.category)
      .sort(),
  ).toEqual(["harmful_feedback", "useful"]);
  await tutor.close();
  await learner.close();
});
