import { test, expect } from "./audit-fixtures";
const actions = {
  confirmed: "Подтвердить разбор",
  corrected: "Сохранить мою проверку",
  returned: "Вернуть на доработку",
  rejected: "Отклонить без прогресса",
};
for (const [action, button] of Object.entries(actions))
  test(`review ${action}: substituted foreign submission cannot be changed and own decision recovers`, async ({
    page,
    request,
  }) => {
    const auth = async (path: string) => {
      const r = await request.post(path);
      expect(r.ok()).toBe(true);
      return { Authorization: "Bearer " + (await r.json()).token };
    };
    const own = await auth("/api/auth/demo/tutor"),
      th = await auth("/api/auth/demo/outsider"),
      lh = await auth("/__audit__/identity/learner");
    const invitation = await request.post("/api/invitations", {
      headers: th,
      data: { subject: "Чужая проверка" },
    });
    expect(invitation.ok()).toBe(true);
    expect(
      (
        await request.post("/api/invitations/accept", {
          headers: lh,
          data: { token: (await invitation.json()).token },
        })
      ).ok(),
    ).toBe(true);
    const link = (
      await (await request.get("/api/relationships", { headers: th })).json()
    )[0].id;
    const original = await (
      await request.get("/api/assignments/demo-assignment", { headers: own })
    ).json();
    const made = await request.post("/api/assignments", {
      headers: th,
      data: {
        relationship_id: link,
        title: "Чужая работа для проверки доступа",
        tasks: original.tasks,
      },
    });
    expect(made.ok()).toBe(true);
    const aid = (await made.json()).id;
    expect(
      (
        await request.post(`/api/assignments/${aid}/publish`, { headers: th })
      ).ok(),
    ).toBe(true);
    const answers = {
      linear: "5",
      fraction: "0,75",
      reason: "Сохраняем равенство",
    };
    const sent = await request.post(`/api/assignments/${aid}/submit`, {
      headers: lh,
      data: { revision: 0, answers },
    });
    expect(sent.ok()).toBe(true);
    const sid = (await sent.json()).id;
    await expect
      .poll(
        async () =>
          (
            await (
              await request.get(`/api/submissions/${sid}`, { headers: th })
            ).json()
          ).status,
      )
      .toBe("awaiting_review");
    await page.goto("/");
    await page.getByRole("button", { name: "Я ученик", exact: true }).click();
    const title = /Линейные уравнения: от шага к решению/;
    await page.getByRole("button", { name: title }).click();
    await page.getByLabel("Ответ на задание 1").fill(answers.linear);
    await page
      .getByRole("radio", { name: answers.fraction, exact: true })
      .check();
    await page.getByLabel("Ответ на задание 3").fill(answers.reason);
    await expect(page.getByRole("status")).toHaveText("Сохранено");
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Отправить работу", exact: true })
      .click();
    await expect(page.locator(".work-task .original p").first()).toHaveText(
      "5",
    );
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await page.getByRole("button", { name: title }).click();
    await expect(
      page.getByRole("button", { name: "Подтвердить разбор", exact: true }),
    ).toBeVisible();
    const note = "Решение относится только к моей работе 🧪";
    await page.getByLabel("Комментарий к работе").fill(note);
    let denied = 0;
    await page.route("**/api/submissions/*/review", async (r) => {
      const url = new URL(`/api/submissions/${sid}/review`, r.request().url())
        .href;
      const response = await r.fetch({ url });
      expect(response.status()).toBe(404);
      denied++;
      await r.fulfill({ response });
    });
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(denied).toBe(1);
    await expect(page.getByLabel("Комментарий к работе")).toHaveValue(note);
    const foreign = await (
      await request.get(`/api/submissions/${sid}`, { headers: th })
    ).json();
    expect(foreign.review).toBeNull();
    expect(foreign.status).toBe("awaiting_review");
    expect(foreign.answers).toEqual(answers);
    expect(
      (
        await (
          await request.get(`/api/relationships/${link}/export`, {
            headers: th,
          })
        ).json()
      ).progress,
    ).toEqual([]);
    await page.unroute("**/api/submissions/*/review");
    const ack = page.waitForResponse((r) =>
      /\/submissions\/[^/]+\/review$/.test(new URL(r.url()).pathname),
    );
    await page.getByRole("button", { name: button, exact: true }).click();
    expect((await ack).status()).toBe(200);
    await page.reload();
    await page.getByRole("button", { name: title }).click();
    const saved = await (
      await request.get("/api/assignments/demo-assignment", { headers: own })
    ).json();
    expect(saved.submission.review.action).toBe(action);
    expect(saved.submission.review.note).toBe(note);
    await page
      .getByRole("button", { name: "История попыток", exact: true })
      .click();
    await page
      .locator(".attempt-history")
      .getByRole("button", { name: /Попытка 1/ })
      .click();
    await expect(page.locator(".attempt-detail")).toContainText(note);
  });
