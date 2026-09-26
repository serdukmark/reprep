import { test, expect } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
for (const role of ["learner", "tutor"])
  test(`material download ${role}: foreign file refused, own TXT survives retry`, async ({
    page,
    request,
  }) => {
    const auth = async (path: string) => {
      const r = await request.post(path);
      expect(r.ok()).toBe(true);
      return { Authorization: "Bearer " + (await r.json()).token };
    };
    const own = await auth("/api/auth/demo/tutor"),
      other = await auth("/api/auth/demo/outsider"),
      child = await auth("/__audit__/identity/learner");
    const inv = await request.post("/api/invitations", {
      headers: other,
      data: { subject: "Приватный предмет" },
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
    const links = await (
      await request.get("/api/relationships", { headers: other })
    ).json();
    const make = async (
      headers: Record<string, string>,
      link: string,
      title: string,
      content: string,
    ) => {
      const r = await request.post("/api/materials", {
        headers,
        data: {
          relationship_id: link,
          title,
          file_name: "material.txt",
          content,
        },
      });
      expect(r.ok()).toBe(true);
      return (await r.json()).id;
    };
    const marker = "Приватное содержимое чужого TXT 🧪";
    const fid = await make(other, links[0].id, "Чужой материал", marker);
    const content = "Свой материал: 2 + 3 = 5 🧪\nВторая строка";
    const oid = await make(own, "demo-link", "Проверка скачивания", content);
    await page.goto("/");
    await page
      .getByRole("button", {
        name: role === "tutor" ? "Я преподаватель" : "Я ученик",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Материалы", exact: true }).click();
    const button = page.getByRole("button", {
      name: "Скачать material.txt",
      exact: true,
    });
    let downloads = 0,
      denied = 0;
    page.on("download", () => downloads++);
    const path = `**/api/materials/${oid}/file`;
    await page.route(path, async (r) => {
      const response = await r.fetch({
        url: r.request().url().replace(oid, fid),
      });
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain(marker);
      denied++;
      await r.fulfill({ response });
    });
    await button.click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(denied).toBe(1);
    expect(downloads).toBe(0);
    await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
    await page.unroute(path);
    await page.reload();
    await page.getByRole("button", { name: "Материалы", exact: true }).click();
    const pending = page.waitForEvent("download");
    await button.click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("material.txt");
    expect(await readFile((await download.path())!, "utf8")).toBe(content);
    expect(downloads).toBe(1);
  });
