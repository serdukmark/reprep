import { test, expect } from "./audit-fixtures";

test("guardian invitation opens only read-only summary and tutor can revoke it", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    parent = await browser.newPage();
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor.getByRole("button", { name: /Саша • демо/ }).click();
  await tutor
    .getByRole("button", { name: "Создать приглашение родителю" })
    .click();
  const code = await tutor
    .getByLabel("Код родителя", { exact: true })
    .inputValue();
  await parent.goto("/");
  await parent.getByRole("button", { name: "Я родитель", exact: true }).click();
  await expect(
    parent.getByRole("heading", { name: "Кабинет родителя" }),
  ).toBeVisible();
  await parent.getByLabel("Код приглашения родителю").fill(code);
  await parent.getByRole("button", { name: "Принять доступ" }).click();
  await parent.getByRole("button", { name: /Саша • демо/ }).click();
  await expect(
    parent.getByRole("heading", { name: "Подтверждённый прогресс" }),
  ).toBeVisible();
  await expect(
    parent.getByText("Проверенных результатов пока нет."),
  ).toBeVisible();
  await expect(
    parent.getByRole("heading", { name: "Расписание ученика" }),
  ).toBeVisible();
  await expect(
    parent.getByRole("button", { name: "Отправить работу" }),
  ).toHaveCount(0);
  const learnerSession = await (
    await tutor.request.post("/api/auth/demo/learner")
  ).json();
  const tutorSession = await (
    await tutor.request.post("/api/auth/demo/tutor")
  ).json();
  const sent = await tutor.request.post(
    "/api/assignments/demo-assignment/submit",
    {
      headers: { Authorization: "Bearer " + learnerSession.token },
      data: {
        revision: 0,
        answers: {
          linear: "5",
          fraction: "0,75",
          reason: "Сохраняем равенство",
        },
      },
    },
  );
  expect(sent.ok()).toBeTruthy();
  const id = (await sent.json()).id;
  const reviewed = await tutor.request.post(`/api/submissions/${id}/review`, {
    headers: { Authorization: "Bearer " + tutorSession.token },
    data: {
      action: "corrected",
      note: "",
      tasks: ["linear", "fraction", "reason"].map((task_id) => ({
        task_id,
        correctness: "correct",
        feedback: "Проверено преподавателем",
      })),
    },
  });
  expect(reviewed.ok()).toBeTruthy();
  await expect(
    parent.getByText(/Последний результат: Верно/).first(),
  ).toBeVisible();
  // A real foreign relationship exists, but substituting it must clear the visible summary.
  await parent.route("**/api/guardian/links/demo-link", (route) =>
    route.continue({ url: route.request().url() + "-2" }),
  );
  await expect(parent.getByRole("alert")).toBeVisible({ timeout: 12000 });
  await expect(
    parent.getByRole("heading", { name: "Подтверждённый прогресс" }),
  ).toHaveCount(0);
  await parent.unroute("**/api/guardian/links/demo-link");
  await expect(
    parent.getByRole("heading", { name: "Подтверждённый прогресс" }),
  ).toBeVisible({ timeout: 12000 });
  await parent.route("**/api/guardian/links/demo-link", (route) =>
    route.abort(),
  );
  await expect(parent.getByRole("alert")).toContainText(
    "Не удалось связаться с сервером",
    { timeout: 12000 },
  );
  await expect(
    parent.getByRole("heading", { name: "Подтверждённый прогресс" }),
  ).toHaveCount(0);
  await parent.unroute("**/api/guardian/links/demo-link");
  await expect(
    parent.getByRole("heading", { name: "Подтверждённый прогресс" }),
  ).toBeVisible({ timeout: 12000 });
  await tutor.getByRole("button", { name: "Отозвать доступ родителя" }).click();
  await expect(parent.getByText(/Открытых доступов нет/)).toBeVisible();
  await expect(
    parent.getByRole("heading", { name: "Подтверждённый прогресс" }),
  ).toHaveCount(0);
  await parent.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    parent.getByRole("button", { name: "Я родитель", exact: true }),
  ).toBeVisible();
  await tutor.close();
  await parent.close();
});
