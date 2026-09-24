import { test, expect } from "./audit-fixtures";
for (const phase of ["duplicate", "open"])
  test(`recommendation delayed ${phase} cannot replace schedule chosen meanwhile`, async ({
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
    let release!: () => void, start!: () => void;
    const held = new Promise<void>((r) => (release = r)),
      seen = new Promise<void>((r) => (start = r));
    let url = "";
    let caught = false;
    await page.route("**/api/assignments/**", async (route) => {
      const req = route.request();
      const wanted =
        phase === "duplicate"
          ? req.method() === "POST" && req.url().endsWith("/duplicate")
          : req.method() === "GET" && !req.url().endsWith("/api/assignments");
      if (caught || !wanted) return route.continue();
      caught = true;
      url = req.url();
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      start();
      await held;
      await route.fulfill({ response });
    });
    await card.getByRole("button", { name: "Подготовить тренировку" }).click();
    await seen;
    await page.getByRole("button", { name: "Расписание", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Расписание", exact: true }),
    ).toBeVisible();
    const ack = page.waitForResponse((r) => r.url() === url);
    release();
    await (await ack).finished();
    // Let the delayed response and its follow-up requests settle before checking the screen.
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "Расписание", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Название работы")).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: /^Задания(?: \d+)?$/ }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(title) }),
    ).toHaveCount(2);
  });
