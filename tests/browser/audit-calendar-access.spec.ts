import { test, expect } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
test("learner calendar ignores injected teacher and foreign relationship IDs", async ({
  page,
  request,
}) => {
  const login = await request.post("/api/auth/demo/tutor");
  expect(login.ok()).toBe(true);
  const headers = { Authorization: "Bearer " + (await login.json()).token };
  for (const [relationship_id, title] of [
    ["demo-link", "Своё занятие"],
    ["demo-link-2", "Чужое приватное занятие"],
  ]) {
    const created = await request.post("/api/lessons", {
      headers,
      data: {
        relationship_id,
        title,
        starts_at: "2026-10-01T15:00:00+03:00",
        duration: 45,
        payment_status: "unpaid",
      },
    });
    expect(created.ok()).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  await page.getByRole("button", { name: "Расписание", exact: true }).click();
  let calls = 0;
  await page.route("**/api/calendar", async (r) => {
    const url = new URL(r.request().url());
    url.searchParams.set("user_id", "demo-tutor");
    url.searchParams.set("role", "tutor");
    url.searchParams.set("relationship_id", "demo-link-2");
    const response = await r.fetch({ url: url.href });
    expect(response.status()).toBe(200);
    calls++;
    await r.fulfill({ response });
  });
  for (let i = 0; i < 2; i++) {
    if (i) {
      await page.reload();
      await page
        .getByRole("button", { name: "Расписание", exact: true })
        .click();
    }
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Скачать календарь (.ics)", exact: true })
      .click();
    const file = await pending;
    expect(file.suggestedFilename()).toBe("reprep-schedule.ics");
    const text = (await readFile((await file.path())!, "utf8")).replace(
      /\r?\n[ \t]/g,
      "",
    );
    expect(text).toContain("Своё занятие");
    expect(text).not.toContain("Чужое приватное занятие");
    expect(text).not.toMatch(/payment_status|unpaid|paid|Оплачено|Не оплачено/);
  }
  expect(calls).toBe(2);
});
