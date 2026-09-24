import { test, expect } from "./audit-fixtures";
for (const mode of ["offline", "lost-ack"])
  test(`recommendation ${mode} retries without another private draft`, async ({
    page,
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

    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    const card = page.locator(".recommendations .work-task").filter({
      has: page.getByRole("heading", {
        name: "Навык рекомендации",
        exact: true,
      }),
    });

    let first = true,
      posts = 0;
    await page.route("**/api/assignments/*/duplicate", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts++;
      if (first) {
        first = false;
        if (mode === "lost-ack") {
          const response = await route.fetch();
          expect(response.ok()).toBe(true);
        }
        await route.abort("connectionreset");
      } else await route.continue();
    });
    await card
      .getByRole("button", { name: "Подготовить тренировку", exact: true })
      .click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await card
      .getByRole("button", { name: "Подготовить тренировку", exact: true })
      .dblclick();
    await expect(
      page.getByRole("heading", { name: "Редактирование работы", exact: true }),
    ).toBeVisible();
    expect(posts).toBe(2);
    await page.reload();
    await page.getByRole("button", { name: /^Задания(?: \d+)?$/ }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(title) }),
    ).toHaveCount(2);
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    await card
      .getByRole("button", { name: "Подготовить тренировку", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Редактирование работы", exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /^Задания(?: \d+)?$/ }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(title) }),
    ).toHaveCount(3);
    await page.screenshot({path: `artifacts/deep-audit/practice-${mode}-confirmed.png`,fullPage:true});
  });
