import { test, expect } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
for (const pair of [
  ["tutor", "learner"],
  ["guardian", "outsider"],
])
  test(`parallel exports ${pair.join("/")}: injected account IDs never override each tab's authenticated identity`, async ({
    context,
    request,
  }) => {
    const session = await request.post("/api/auth/demo/tutor");
    const headers = { Authorization: "Bearer " + (await session.json()).token };
    const marker = "Приватная переписка второго ученика 🧪";
    expect(
      (
        await request.post("/api/assignments/demo-assignment-2/messages", {
          headers,
          data: { text: marker, client_id: crypto.randomUUID() },
        })
      ).ok(),
    ).toBe(true);
    const roles: Record<string, [string, string]> = {
      tutor: ["Я преподаватель", "Алекс • демо"],
      learner: ["Я ученик", "Саша • демо"],
      guardian: ["Я родитель", "Родитель • демо"],
      outsider: ["Другой преподаватель · демо", "Другой репетитор • демо"],
    };
    const pages = await Promise.all(pair.map(() => context.newPage()));
    for (const [i, page] of pages.entries()) {
      const role = pair[i];
      await page.goto("/");
      await page
        .getByRole("button", { name: roles[role][0], exact: true })
        .click();
      if (role !== "guardian")
        await page
          .getByRole("button", { name: new RegExp(roles[role][1]) })
          .click();
      await page.route("**/api/account/export", async (r) => {
        const url = new URL(r.request().url());
        url.searchParams.set("user_id", "demo-tutor");
        url.searchParams.set("account_id", "demo-tutor");
        url.searchParams.set("role", "tutor");
        const response = await r.fetch({ url: url.href });
        expect(response.status()).toBe(200);
        await r.fulfill({ response });
      });
    }
    const downloads = pages.map((page) => page.waitForEvent("download"));
    await Promise.all(
      pages.map((page) =>
        page
          .getByRole("button", { name: "Скачать мои данные", exact: true })
          .click(),
      ),
    );
    for (const [i, download] of (await Promise.all(downloads)).entries()) {
      const role = pair[i];
      const data = JSON.parse(await readFile((await download.path())!, "utf8"));
      expect(data.account.id).toBe("demo-" + role);
      expect(data.account.role).toBe(role === "outsider" ? "tutor" : role);
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain("token_hash");
      if (role === "tutor") expect(serialized).toContain(marker);
      else {
        expect(serialized).not.toContain(marker);
        expect(
          data.assignments.some(
            (a: { id: string }) => a.id === "demo-assignment-2",
          ),
        ).toBe(false);
      }
      if (["guardian", "outsider"].includes(role)) {
        expect(data.assignments).toEqual([]);
        expect(data.messages).toEqual([]);
        expect(data.relationships).toEqual([]);
      }
      await expect(
        pages[i].getByText("Файл экспорта передан браузеру", { exact: true }),
      ).toBeVisible();
      await pages[i].reload();
      if (role === "guardian")
        await expect(
          pages[i].getByRole("heading", {
            name: "Кабинет родителя",
            exact: true,
          }),
        ).toBeVisible();
      else
        await expect(
          pages[i].getByRole("button", { name: new RegExp(roles[role][1]) }),
        ).toBeVisible();
    }
  });
