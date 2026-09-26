import { test, expect, choose } from "./audit-fixtures";
for (const field of ["relationship_id", "assignment_id", "lesson_id"])
  test(`material creation rejects foreign ${field}, retains form, and only creates own record on retry`, async ({
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
    const inv = await request.post("/api/invitations", {
      headers: th,
      data: { subject: "Чужие материалы" },
    });
    expect(inv.ok()).toBe(true);
    expect(
      (
        await request.post("/api/invitations/accept", {
          headers: lh,
          data: { token: (await inv.json()).token },
        })
      ).ok(),
    ).toBe(true);
    const link = (
      await (await request.get("/api/relationships", { headers: th })).json()
    )[0].id;
    let id = link;
    if (field !== "relationship_id") {
      const made = await request.post(
        field === "assignment_id" ? "/api/assignments" : "/api/lessons",
        {
          headers: th,
          data:
            field === "assignment_id"
              ? {
                  relationship_id: link,
                  title: "Приватная работа",
                  tasks: [
                    {
                      id: "one",
                      type: "numeric",
                      prompt: "2+2?",
                      answer: "4",
                      skill: "Счёт",
                    },
                  ],
                }
              : {
                  relationship_id: link,
                  title: "Приватное занятие",
                  starts_at: "2026-12-31T15:00:00Z",
                },
        },
      );
      expect(made.ok()).toBe(true);
      id = (await made.json()).id;
    }
    const list = async (headers: Record<string, string>) =>
      (await (await request.get("/api/materials", { headers })).json())
        .map((m: { id: string }) => m.id)
        .sort();
    const beforeOwn = await list(own),
      beforeForeign = await list(th);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await page.getByRole("button", { name: "Материалы", exact: true }).click();
    await page
      .getByRole("button", { name: "Добавить материал", exact: true })
      .click();
    const title = "Свой материал после отказа 🧪";
    await page.getByLabel("Название", { exact: true }).fill(title);
    await choose(
      page.getByRole("combobox", { name: "Ученик", exact: true }),
      "demo-link",
    );
    await page.getByLabel("Ссылка HTTPS").fill("https://example.invalid/own");
    let denied = 0;
    await page.route("**/api/materials", async (r) => {
      if (r.request().method() !== "POST") return r.continue();
      const response = await r.fetch({
        postData: { ...r.request().postDataJSON(), [field]: id },
      });
      expect(response.status()).toBe(field === "lesson_id" ? 422 : 404);
      denied++;
      await r.fulfill({ response });
    });
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(denied).toBe(1);
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue(
      title,
    );
    expect(await list(own)).toEqual(beforeOwn);
    expect(await list(th)).toEqual(beforeForeign);
    await page.unroute("**/api/materials");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Материалы", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(1);
    expect((await list(own)).length).toBe(beforeOwn.length + 1);
    expect(await list(th)).toEqual(beforeForeign);
  });
