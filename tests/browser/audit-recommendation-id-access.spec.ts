import { test, expect } from "./audit-fixtures";
for (const mode of ["read", "copy"])
  test(`recommendation ${mode}: foreign learner history or source work stays private`, async ({
    page,
    request,
  }) => {
    const auth = async (path: string) => {
      const r = await request.post(path);
      expect(r.ok()).toBe(true);
      return { Authorization: "Bearer " + (await r.json()).token };
    };
    const own = await auth("/api/auth/demo/tutor"),
      learner = await auth("/api/auth/demo/learner"),
      foreign = await auth("/api/auth/demo/outsider"),
      child = await auth("/__audit__/identity/learner");
    const inv = await request.post("/api/invitations", {
      headers: foreign,
      data: { subject: "Чужая рекомендация" },
    });
    expect(inv.ok()).toBe(true);
    expect(
      (
        await request.post("/api/invitations/accept", {
          headers: child,
          data: { token: (await inv.json()).token },
        })
      ).ok(),
    ).toBe(true);
    const foreignLink = (
      await (
        await request.get("/api/relationships", { headers: foreign })
      ).json()
    )[0].id;
    const seed = async (
      th: Record<string, string>,
      lh: Record<string, string>,
      link: string,
      skill: string,
    ) => {
      const made = await request.post("/api/assignments", {
        headers: th,
        data: {
          relationship_id: link,
          title: skill,
          tasks: [
            { id: "one", type: "numeric", prompt: "2+2?", answer: "4", skill },
          ],
        },
      });
      expect(made.ok()).toBe(true);
      const aid = (await made.json()).id;
      expect(
        (
          await request.post(`/api/assignments/${aid}/publish`, { headers: th })
        ).ok(),
      ).toBe(true);
      const sent = await request.post(`/api/assignments/${aid}/submit`, {
        headers: lh,
        data: { revision: 0, answers: { one: "5" } },
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
      expect(
        (
          await request.post(`/api/submissions/${sid}/review`, {
            headers: th,
            data: {
              action: "corrected",
              tasks: [
                {
                  task_id: "one",
                  correctness: "incorrect",
                  feedback: "Пересчитайте",
                },
              ],
            },
          })
        ).ok(),
      ).toBe(true);
      return aid;
    };
    const ownSkill = "Свой подтверждённый навык",
      marker = "Чужой приватный навык 🧪";
    const ownId = await seed(own, learner, "demo-link", ownSkill),
      foreignId = await seed(foreign, child, foreignLink, marker);
    const expectedForeign = await (
      await request.get(`/api/relationships/${foreignLink}/recommendations`, {
        headers: foreign,
      })
    ).json();
    expect(expectedForeign[0].skill).toBe(marker);
    const list = async (headers: Record<string, string>) =>
      (await (await request.get("/api/assignments", { headers })).json())
        .map((a: { id: string }) => a.id)
        .sort();
    const beforeOwn = await list(own),
      beforeForeign = await list(foreign);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    const path =
      mode === "read"
        ? "**/api/relationships/demo-link/recommendations"
        : `**/api/assignments/${ownId}/duplicate`;
    let denied = 0;
    await page.route(path, async (r) => {
      const url =
        mode === "read"
          ? r.request().url().replace("demo-link", foreignLink)
          : r.request().url().replace(ownId, foreignId);
      const response = await r.fetch({ url });
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain(marker);
      denied++;
      await r.fulfill({ response });
    });
    const open = async () => {
      await page.getByRole("button", { name: "Ученики", exact: true }).click();
      await page.getByRole("button", { name: /Саша • демо/ }).click();
    };
    await open();
    if (mode === "copy")
      await page
        .getByRole("button", { name: "Подготовить тренировку", exact: true })
        .click();
    await expect(
      page.locator(".recommendations").getByRole("alert"),
    ).toBeVisible();
    expect(denied).toBe(1);
    await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
    expect(await list(own)).toEqual(beforeOwn);
    expect(await list(foreign)).toEqual(beforeForeign);
    await page.unroute(path);
    await page.reload();
    await open();
    await expect(
      page.getByRole("heading", { name: ownSkill, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Подготовить тренировку", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Редактирование работы", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Название работы")).toHaveValue(
      new RegExp(ownSkill),
    );
    expect((await list(own)).length).toBe(beforeOwn.length + 1);
    expect(await list(foreign)).toEqual(beforeForeign);
  });
