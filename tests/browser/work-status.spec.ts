import { test, expect } from "@playwright/test";
test("work list separates overdue, active and complete; builder persists own lesson link", async ({
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
  const prefix = "Статусы " + Date.now();
  const task = {
    id: "sum",
    type: "numeric",
    prompt: "2+2?",
    answer: "4",
    rubric: "Сложение",
    skill: "Счёт",
    options: [],
    hint: "",
  };
  const ids: Record<string, string> = {};
  for (const name of ["Просрочена", "Активна", "Завершена"]) {
    ids[name] = (
      await (
        await request.post("/api/assignments", {
          headers: th,
          data: {
            relationship_id: "demo-link",
            title: prefix + " " + name,
            due_at: new Date(
              Date.now() + (name === "Активна" ? 1 : -1) * 86400000,
            ).toISOString(),
            tasks: [task],
          },
        })
      ).json()
    ).id;
    await request.post("/api/assignments/" + ids[name] + "/publish", {
      headers: th,
    });
  }
  const sid = (
    await (
      await request.post("/api/assignments/" + ids["Завершена"] + "/submit", {
        headers: lh,
        data: { revision: 0, answers: { sum: "4" } },
      })
    ).json()
  ).id;
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get("/api/assignments/" + ids["Завершена"], {
              headers: th,
            })
          ).json()
        ).submission.status,
    )
    .toBe("awaiting_review");
  await request.post("/api/submissions/" + sid + "/review", {
    headers: th,
    data: {
      action: "corrected",
      tasks: [{ task_id: "sum", correctness: "correct", feedback: "Верно" }],
      note: "",
    },
  });
  const learner = await browser.newPage();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner.getByRole("button", { name: "Задания", exact: true }).click();
  await learner.getByPlaceholder("Найти задание").fill(prefix);
  for (const [filter, title] of [
    ["overdue", "Просрочена"],
    ["active", "Активна"],
    ["completed", "Завершена"],
  ]) {
    await learner
      .getByRole("combobox", { name: "Статус работ", exact: true })
      .selectOption(filter);
    await expect(learner.locator(".assignment-row")).toHaveCount(1);
    await expect(learner.locator(".assignment-row")).toContainText(title);
  }
  const tutor = await browser.newPage();
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await tutor
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await tutor.getByLabel("Ученик", { exact: true }).selectOption("demo-link");
  const lessons = await (
    await request.get("/api/lessons", { headers: th })
  ).json();
  const lesson = lessons.find((l: any) => l.relationship_id === "demo-link");
  await tutor
    .getByRole("combobox", { name: "Занятие для этой работы", exact: true })
    .selectOption(lesson.id);
  await tutor.getByLabel("Название работы").fill(prefix + " привязка");
  await tutor.getByLabel("Условие", { exact: true }).fill("2+2?");
  await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("4");
  await tutor.getByLabel("Навык", { exact: true }).fill("Счёт");
  const save = tutor.waitForResponse(
    (r) =>
      r.url().endsWith("/api/assignments") && r.request().method() === "POST",
  );
  await tutor
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  const draft = await (await save).json();
  expect(
    (
      await (
        await request.get("/api/assignments/" + draft.id, { headers: th })
      ).json()
    ).lesson_id,
  ).toBe(lesson.id);
  await tutor.close();
  await learner.close();
});
