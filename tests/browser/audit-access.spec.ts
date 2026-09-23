import { test, expect } from "./audit-fixtures";

for (const [name, button, paths] of [
  [
    "learner",
    "Я ученик",
    [
      "/api/assignments/demo-assignment-2",
      "/api/relationships/demo-link-2/progress",
      "/api/analytics",
      "/api/groups",
      "/api/workspaces",
      "/api/guardian/links",
    ],
  ],
  [
    "guardian",
    "Я родитель",
    [
      "/api/assignments/demo-assignment",
      "/api/relationships/demo-link/progress",
      "/api/analytics",
      "/api/groups",
      "/api/workspaces",
    ],
  ],
  [
    "colleague",
    "Другой преподаватель · демо",
    [
      "/api/assignments/demo-assignment",
      "/api/relationships/demo-link/progress",
    ],
  ],
] as const) {
  test(`${name}: real browser identity cannot fetch another learner or privileged resources`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(
      page.getByRole("button", { name: button, exact: true }),
    ).toHaveCount(0);
    // API boundary checks use the session established through the visible UI.
    for (const path of paths) {
      const response = await page.evaluate(async (p) => {
        const r = await fetch(p, {
          headers: {
            Authorization: "Bearer " + sessionStorage.getItem("reprep.session"),
          },
        });
        return { status: r.status, body: await r.text() };
      }, path);
      expect([403, 404], path + " " + response.body).toContain(response.status);
      expect(response.body).not.toContain("Сохраняем равенство");
    }
    if (name === "learner") {
      await expect(
        page.getByRole("button", { name: "Создать задание", exact: true }),
      ).toHaveCount(0);
      // A substituted ID reaches the actual server; the visible screen must reject it.
      await page.route("**/api/assignments/demo-assignment", (r) =>
        r.continue({
          url: r
            .request()
            .url()
            .replace("demo-assignment", "demo-assignment-2"),
        }),
      );
      await page
        .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
        .click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page.getByLabel("Ответ на задание 1")).toHaveCount(0);
    }
    if (name === "guardian") {
      await expect(
        page.getByRole("heading", { name: "Кабинет родителя" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Создать задание", exact: true }),
      ).toHaveCount(0);
      await page
        .getByLabel("Код приглашения родителю")
        .fill("чужой 🧪 <script>");
      await page
        .getByRole("button", { name: "Принять доступ", exact: true })
        .click();
      await expect(page.getByRole("alert")).toBeVisible();
    }
  });
}

test("AUD-003 legacy scheduled lesson appears on dashboard and matches schedule", async ({
  page,
}) => {
  await page.route("**/api/lessons", async (route) => {
    const response = await route.fetch();
    const lessons = await response.json();
    for (const lesson of lessons) {
      delete lesson.status;
      lesson.starts_at = "2099-01-01T12:00:00Z";
    }
    await route.fulfill({ response, json: lessons });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  const card = page
    .locator(".today-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Ближайшее занятие",
        exact: true,
      }),
    });
  await expect(card).toContainText("Разбираем уравнения");
  await page.getByRole("button", { name: "Расписание", exact: true }).click();
  await expect(
    page.getByText("Разбираем уравнения", { exact: true }),
  ).toBeVisible();
});
