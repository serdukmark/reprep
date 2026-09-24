import { test, expect } from "./audit-fixtures";
for (const kind of ["plan", "skill-graph"] as const)
  test(`teacher ${kind}: another teacher's relationship rejects edits and preserves both documents`, async ({
    page,
    request,
  }) => {
    const other = await request.post("/api/auth/demo/outsider");
    const student = await request.post("/__audit__/identity/learner");
    const oh = { Authorization: "Bearer " + (await other.json()).token };
    const lh = { Authorization: "Bearer " + (await student.json()).token };
    const inv = await request.post("/api/invitations", {
      headers: oh,
      data: { subject: "Чужая программа" },
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
    const links = await request.get("/api/relationships", { headers: oh });
    const rid = (await links.json())[0].id;
    const foreignPath = `/api/relationships/${rid}/${kind}`;
    const original = await request.get(foreignPath, { headers: oh });
    expect(original.ok()).toBe(true);
    const before = await original.json();
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    const label =
      kind === "plan"
        ? "Цель программы"
        : "Навыки графа (каждый с новой строки)";
    const button = kind === "plan" ? "Сохранить программу" : "Сохранить граф";
    const notice = kind === "plan" ? "Программа сохранена" : "Граф сохранён";
    const text = "Только моя программа 🧪";
    await page.getByLabel(label).fill(text);
    let denied = 0;
    const path = `**/api/relationships/demo-link/${kind}`;
    await page.route(path, async (r) => {
      if (r.request().method() !== "PUT") return r.continue();
      const response = await r.fetch({
        url: new URL(foreignPath, r.request().url()).href,
      });
      expect(response.status()).toBe(404);
      denied++;
      await r.fulfill({ response });
    });
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect.poll(() => denied).toBe(1);
    await expect(page.getByLabel(label)).toHaveValue(text);
    await expect(page.getByText(notice, { exact: true })).toHaveCount(0);
    const after = await request.get(foreignPath, { headers: oh });
    expect(after.ok()).toBe(true);
    expect(await after.json()).toEqual(before);
    await page.unroute(path);
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByText(notice, { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    await expect(page.getByLabel(label)).toHaveValue(text);
  });
