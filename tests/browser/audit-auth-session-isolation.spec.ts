import { test, expect } from "./audit-fixtures";
import { createHmac, randomInt } from "node:crypto";
import type { Page } from "@playwright/test";

// Local signed-launch fixtures only. Both public bridge scripts are intercepted;
// no live MAX/Telegram, actual bot tokens, messaging or external AI is used.
function launch(platform: string, id: number) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: "Синтетический" }),
    query_id: "audit-isolation",
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
  return (
    "/#" +
    (platform === "MAX" ? "WebAppData" : "tgWebAppData") +
    "=" +
    encodeURIComponent(new URLSearchParams({ ...fields, hash }).toString())
  );
}
async function register(
  page: Page,
  platform: string,
  id: number,
  role: string,
  alias: string,
) {
  await page.route("https://st.max.ru/js/max-web-app.js", (r) =>
    r.fulfill({ body: 'window.WebApp={initData:""}' }),
  );
  await page.route("https://telegram.org/js/telegram-web-app.js", (r) =>
    r.fulfill({
      body: 'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}',
    }),
  );
  // A messenger launch is a new document; changing only a hash in an already
  // mounted SPA would not represent another launch after logout.
  await page.goto("about:blank");
  await page.goto(launch(platform, id));
  await page.getByLabel("Как к вам обращаться").fill(alias);
  await page
    .locator(".registration-role")
    .filter({ has: page.getByRole("radio", { name: new RegExp("^" + role) }) })
    .click();
  const authenticated = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/" + (platform === "MAX" ? "max" : "telegram")),
  );
  await page
    .getByRole("button", { name: "Войти через " + platform, exact: true })
    .click();
  const response = await authenticated;
  expect(response.status()).toBe(200);
  const identity = (await response.json()).user;
  expect(identity.alias).toBe(alias);
  await current(page, role, alias);
  return identity.id as string;
}
async function current(page: Page, role: string, alias: string) {
  await expect(
    page.getByRole("heading", {
      name:
        role === "Родитель"
          ? "Кабинет родителя"
          : role === "Ученик"
            ? "Ваш следующий шаг."
            : "Хороший день, чтобы учить.",
      exact: true,
    }),
  ).toBeVisible();
  if (role === "Родитель")
    await expect(page.locator(".page-heading")).toContainText(alias);
  else
    await expect(
      page.getByRole("button", { name: new RegExp(alias) }),
    ).toBeVisible();
}
async function logout(page: Page, role: string, alias: string) {
  if (role !== "Родитель")
    await page.getByRole("button", { name: new RegExp(alias) }).click();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Я преподаватель", exact: true }),
  ).toBeVisible();
}

for (const platform of ["MAX", "Telegram"])
  for (const role of ["Преподаватель", "Ученик", "Родитель"])
    test(`${platform} simulated ${role}: independent signed sessions survive another account logout without mixed identity`, async ({
      page,
      browser,
    }) => {
      const other = await browser.newPage();
      const alias = "Первый участник 🧪",
        otherAlias = "Второй участник 🧪";
      const external = randomInt(1_000_000_000, 9_000_000_000);
      try {
        const firstId = await register(page, platform, external, role, alias);
        const secondId = await register(
          other,
          platform,
          external + 1,
          role,
          otherAlias,
        );
        expect(firstId).not.toBe(secondId);
        await page.reload();
        await current(page, role, alias);
        await other.reload();
        await current(other, role, otherAlias);
        await expect(page.getByText(otherAlias, { exact: true })).toHaveCount(
          0,
        );
        await logout(page, role, alias);
        await other.reload();
        await current(other, role, otherAlias);
        await page.reload();
        await expect(
          page.getByRole("button", { name: "Я преподаватель", exact: true }),
        ).toBeVisible();
        await expect(page.getByText(otherAlias, { exact: true })).toHaveCount(
          0,
        );
        await logout(other, role, otherAlias);
      } finally {
        await other.close();
      }
    });

for (const role of ["Преподаватель", "Ученик", "Родитель"])
  test(`same numeric platform ID ${role}: MAX and Telegram keep separate accounts and revocations`, async ({
    page,
    browser,
  }) => {
    const other = await browser.newPage();
    const external = randomInt(10_000_000_000, 90_000_000_000);
    const maxAlias = "Участник MAX 🧪",
      tgAlias = "Участник Telegram 🧪";
    try {
      const maxId = await register(page, "MAX", external, role, maxAlias);
      const tgId = await register(other, "Telegram", external, role, tgAlias);
      expect(tgId).not.toBe(maxId);
      await page.reload();
      await current(page, role, maxAlias);
      await other.reload();
      await current(other, role, tgAlias);
      await logout(page, role, maxAlias);
      await other.reload();
      await current(other, role, tgAlias);
      // A new launch of the registered MAX identity opens it without the questionnaire.
      const relaunched = page.waitForResponse((r) => r.url().endsWith("/api/auth/max"));
      await page.goto("about:blank");
      await page.goto(launch("MAX", external));
      const sameMax = (await (await relaunched).json()).user.id;
      expect(sameMax).toBe(maxId);
      await current(page, role, maxAlias);
      await expect(page.getByLabel("Как к вам обращаться")).toHaveCount(0);
      await logout(other, role, tgAlias);
      await page.reload();
      await current(page, role, maxAlias);
    } finally {
      await other.close();
    }
  });
