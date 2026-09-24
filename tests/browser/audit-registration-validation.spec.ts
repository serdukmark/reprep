import { test, expect } from "./audit-fixtures";
import { createHmac } from "node:crypto";
function signed(platform: string, id: number, expired = false) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000) - (expired ? 86400 : 0)),
    user: JSON.stringify({ id, first_name: "Синтетический" }),
    query_id: "audit",
  };
  const key = createHmac("sha256", "WebAppData")
    .update(
      platform === "MAX"
        ? "synthetic-max-test-token"
        : "synthetic-tg-test-token",
    )
    .digest();
  const hash = createHmac("sha256", key)
    .update(
      Object.entries(fields)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => k + "=" + v)
        .join("\n"),
    )
    .digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

for (const platform of ["MAX", "Telegram"])
  for (const [role, title] of [
    ["Преподаватель", "Хороший день, чтобы учить."],
    ["Ученик", "Ваш следующий шаг."],
    ["Родитель", "Кабинет родителя"],
  ])
    for (const mode of ["empty", "validated"])
      test(`${platform} ${role} registration ${mode}: validation and durable identity`, async ({
        page,
      }) => {
        const raw = signed(platform, Date.now());
        await page.route("https://st.max.ru/js/max-web-app.js", (r) =>
          r.fulfill({ body: 'window.WebApp={initData:""}' }),
        );
        await page.route("https://telegram.org/js/telegram-web-app.js", (r) =>
          r.fulfill({
            body: 'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}',
          }),
        );
        await page.goto(
          "/#" +
            (platform === "MAX" ? "WebAppData" : "tgWebAppData") +
            "=" +
            encodeURIComponent(raw),
        );
        const name = page.getByLabel("Как к вам обращаться"),
          submit = page.getByRole("button", {
            name: "Войти через " + platform,
            exact: true,
          });
        await page
          .locator(".registration-role")
          .filter({
            has: page.getByRole("radio", { name: new RegExp("^" + role) }),
          })
          .click();
        let alias = "Участник";
        if (mode === "validated") {
          await name.fill("   ");
          await submit.click();
          await expect(page.getByRole("alert")).toBeVisible();
          await expect(name).toHaveValue("   ");
          await name.fill("Я".repeat(200));
          expect((await name.inputValue()).length).toBe(60);
          alias = "Аудит <>& 🧪";
          await name.fill(alias);
        }
        const path = "/api/auth/" + (platform === "MAX" ? "max" : "telegram");
        let posts = 0,
          release!: () => void,
          start!: () => void;
        const held = new Promise<void>((r) => (release = r)),
          seen = new Promise<void>((r) => (start = r));
        await page.route("**" + path, async (route) => {
          posts++;
          const response = await route.fetch();
          expect(response.ok()).toBe(true);
          const data = await response.json();
          expect(data.user.alias).toBe(alias);
          start();
          await held;
          await route.fulfill({ response });
        });
        await submit.dblclick();
        await seen;
        await expect(submit).toBeDisabled();
        expect(posts).toBe(1);
        release();
        await expect(
          page.getByRole("heading", { name: title, exact: true }),
        ).toBeVisible();
        await page.reload();
        await expect(
          page.getByRole("heading", { name: title, exact: true }),
        ).toBeVisible();
        if (role === "Родитель")
          await expect(page.getByText(alias, { exact: true })).toBeVisible();
        else
          await expect(
            page.getByRole("button", { name: new RegExp(alias) }),
          ).toBeVisible();
      });
