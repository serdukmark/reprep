import { test, expect } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
for (const role of ["tutor", "learner"])
  test(`progress export ${role}: foreign relationship denied without a download, own retry succeeds`, async ({
    page,
    request,
  }) => {
    const auth = async (path: string) => {
      const r = await request.post(path);
      expect(r.ok()).toBe(true);
      return { Authorization: "Bearer " + (await r.json()).token };
    };
    const th = await auth("/api/auth/demo/outsider");
    const lh = await auth("/__audit__/identity/learner");
    const marker = "Приватный предмет другой пары 🧪";
    const inv = await request.post("/api/invitations", {
      headers: th,
      data: { subject: marker },
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
    const links = await (
      await request.get("/api/relationships", { headers: th })
    ).json();
    const foreignId = links[0].id;
    const ownerExport = await request.get(
      `/api/relationships/${foreignId}/export`,
      { headers: th },
    );
    expect(ownerExport.status()).toBe(200);
    expect((await ownerExport.json()).subject).toBe(marker);
    await page.goto("/");
    await page
      .getByRole("button", {
        name: role === "tutor" ? "Я преподаватель" : "Я ученик",
        exact: true,
      })
      .click();
    const openProgress = async () => {
      await page
        .getByRole("button", {
          name: role === "tutor" ? "Ученики" : "Мой прогресс",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: role === "tutor" ? /Саша • демо/ : /Алекс • демо/,
        })
        .click();
    };
    await openProgress();
    let denied = 0,
      downloads = 0;
    page.on("download", () => downloads++);
    const path = "**/api/relationships/demo-link/export";
    await page.route(path, async (r) => {
      const response = await r.fetch({
        url: r.request().url().replace("demo-link", foreignId),
      });
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain(marker);
      denied++;
      await r.fulfill({ response });
    });
    await page
      .getByRole("button", { name: "Экспорт прогресса", exact: true })
      .click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(denied).toBe(1);
    expect(downloads).toBe(0);
    await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
    await page.unroute(path);
    await page.reload();
    await openProgress();
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Экспорт прогресса", exact: true })
      .click();
    const file = await pending;
    expect(file.suggestedFilename()).toBe("reprep-progress.json");
    const text = await readFile((await file.path())!, "utf8");
    expect(JSON.parse(text).subject).toBe("Математика · ЕГЭ");
    expect(text).not.toContain(marker);
    expect(downloads).toBe(1);
  });
