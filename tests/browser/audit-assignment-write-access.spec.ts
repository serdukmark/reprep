import { test, expect, choose } from "./audit-fixtures";
for (const mode of ["create", "update", "publish"])
  test(`assignment ${mode}: foreign relationship or work ID is denied without changing its owner data`, async ({
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
      data: { subject: "Чужое назначение" },
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
    const made = await request.post("/api/assignments", {
      headers: th,
      data: {
        relationship_id: link,
        title: "Чужой приватный черновик",
        tasks: [
          {
            id: "one",
            type: "numeric",
            prompt: "2+2?",
            answer: "4",
            skill: "Счёт",
          },
        ],
      },
    });
    expect(made.ok()).toBe(true);
    const fid = (await made.json()).id;
    const before = await (
      await request.get(`/api/assignments/${fid}`, { headers: th })
    ).json();
    const list = async (headers: Record<string, string>) =>
      (await (await request.get("/api/assignments", { headers })).json())
        .map((a: { id: string }) => a.id)
        .sort();
    const beforeForeign = await list(th),
      beforeOwn = await list(own);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Создать задание", exact: true })
      .click();
    const title = "Собственная работа после отказа";
    await page.getByLabel("Название работы").fill(title);
    await choose(
      page.getByRole("combobox", { name: "Ученик", exact: true }),
      "demo-link",
    );
    await page.getByLabel("Условие", { exact: true }).fill("2+3?");
    await page.getByLabel("Эталонный ответ", { exact: true }).fill("5");
    await page.getByLabel("Навык", { exact: true }).fill("Сложение");
    if (mode === "update") {
      await page
        .getByRole("button", { name: "Сохранить черновик", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Редактировать", exact: true })
        .click();
    }
    const note = "Свой неизменённый ввод 🧪";
    await page.getByLabel("Инструкция ученику").fill(note);
    let denied = 0;
    await page.route("**/api/assignments**", async (r) => {
      const path = new URL(r.request().url()).pathname,
        method = r.request().method();
      const match =
        mode === "create"
          ? path === "/api/assignments" && method === "POST"
          : mode === "update"
            ? /^\/api\/assignments\/[^/]+$/.test(path) && method === "PUT"
            : path.endsWith("/publish") && method === "POST";
      if (!match) return r.continue();
      const response = await r.fetch(
        mode === "create"
          ? {
              postData: {
                ...r.request().postDataJSON(),
                relationship_id: link,
              },
            }
          : {
              url: new URL(
                `/api/assignments/${fid}${mode === "publish" ? "/publish" : ""}${new URL(r.request().url()).search}`,
                r.request().url(),
              ).href,
            },
      );
      expect(response.status()).toBe(404);
      denied++;
      await r.fulfill({ response });
    });
    const button = page.getByRole("button", {
      name: mode === "publish" ? /Назначить ученику/ : "Сохранить черновик",
      exact: mode !== "publish",
    });
    await button.click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(denied).toBe(1);
    await expect(page.getByLabel("Инструкция ученику")).toHaveValue(note);
    expect(
      await (
        await request.get(`/api/assignments/${fid}`, { headers: th })
      ).json(),
    ).toEqual(before);
    expect(await list(th)).toEqual(beforeForeign);
    await page.unroute("**/api/assignments**");
    await button.click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    expect((await list(own)).length).toBe(beforeOwn.length + 1);
    expect(await list(th)).toEqual(beforeForeign);
  });
