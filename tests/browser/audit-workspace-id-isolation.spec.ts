import { test, expect } from "./audit-fixtures";
for (const resource of ["members", "templates", "invitations"])
  test(`workspace ${resource}: replacing visible workspace ID cannot expose a colleague's private library`, async ({
    page,
    request,
  }) => {
    const owner = await request.post("/api/auth/demo/tutor"),
      foreign = await request.post("/api/auth/demo/outsider");
    const ownHeaders = {
        Authorization: "Bearer " + (await owner.json()).token,
      },
      otherHeaders = {
        Authorization: "Bearer " + (await foreign.json()).token,
      };
    const own = await request.post("/api/workspaces", {
      headers: ownHeaders,
      data: { title: "Моя библиотека" },
    });
    const other = await request.post("/api/workspaces", {
      headers: otherHeaders,
      data: { title: "Приватная библиотека коллеги 🧪" },
    });
    expect(own.ok()).toBe(true);
    expect(other.ok()).toBe(true);
    const ownId = (await own.json()).id,
      otherId = (await other.json()).id;
    const title = "Приватный шаблон коллеги 🧪";
    const assignment = await request.post("/api/assignments", {
      headers: otherHeaders,
      data: {
        title,
        relationship_id: "",
        tasks: [
          {
            id: "one",
            type: "numeric",
            prompt: "2+3?",
            answer: "5",
            skill: "Сложение",
          },
        ],
      },
    });
    expect(assignment.ok()).toBe(true);
    expect(
      (
        await request.post(`/api/workspaces/${otherId}/templates`, {
          headers: otherHeaders,
          data: { assignment_id: (await assignment.json()).id },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await request.post(`/api/workspaces/${otherId}/invite`, {
          headers: otherHeaders,
        })
      ).ok(),
    ).toBe(true);
    const original = await request.get(
      `/api/workspaces/${otherId}/${resource}`,
      { headers: otherHeaders },
    );
    expect(original.ok()).toBe(true);
    expect((await original.json()).length).toBeGreaterThan(0);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    const path = `**/api/workspaces/${ownId}/${resource}`;
    let denied = 0;
    await page.route(path, async (r) => {
      const response = await r.fetch({
        url: r.request().url().replace(ownId, otherId),
      });
      expect(response.status()).toBe(404);
      denied++;
      await r.fulfill({ response });
    });
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect.poll(() => denied).toBe(1);
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Приватная библиотека коллеги 🧪", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Другой репетитор • демо", { exact: true }),
    ).toHaveCount(0);
    await page.unroute(path);
    await page.reload();
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Создать мой черновик", exact: true }),
    ).toHaveCount(0);
  });
