import { test, expect } from "./audit-fixtures";
import type { Browser, BrowserContext } from "@playwright/test";
import { createHmac, randomInt } from "node:crypto";

// A messenger identity registers once. Every later launch — another device,
// a fresh mini-app session, or signing in again after logout — must open the
// stored profile without asking for the name or role again.
function signedLaunch(platform: string, id: number) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: "Синтетический" }),
    query_id: "registration-once-" + randomInt(1_000_000),
  };
  const key = createHmac("sha256", "WebAppData")
    .update(platform === "MAX" ? "synthetic-max-test-token" : "synthetic-tg-test-token")
    .digest();
  const hash = createHmac("sha256", key)
    .update(
      Object.entries(fields)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => k + "=" + v)
        .join("\n"),
    )
    .digest("hex");
  const raw = new URLSearchParams({ ...fields, hash }).toString();
  return "/#" + (platform === "MAX" ? "WebAppData" : "tgWebAppData") + "=" + encodeURIComponent(raw);
}

async function device(browser: Browser): Promise<BrowserContext> {
  // A new context has empty sessionStorage, like a new phone or a reopened mini app.
  const context = await browser.newContext();
  await context.route("https://st.max.ru/js/max-web-app.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: 'window.WebApp={initData:""}' }),
  );
  await context.route("https://telegram.org/js/telegram-web-app.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}',
    }),
  );
  return context;
}

for (const platform of ["MAX"] as const)
  test(`${platform}: name and role are asked once, later launches open the stored profile`, async ({ browser }) => {
    const id = randomInt(100_000_000_000, 900_000_000_000);
    const alias = `Ученик ${platform} ${id % 10000}`;
    const endpoint = "/api/auth/" + (platform === "MAX" ? "max" : "telegram");
    const home = "Ваш следующий шаг.";

    const first = await device(browser);
    const page = await first.newPage();
    await page.goto(signedLaunch(platform, id));
    await page.getByLabel("Как к вам обращаться").fill(alias);
    await page
      .locator(".registration-role")
      .filter({ has: page.getByRole("radio", { name: /^Ученик/ }) })
      .click();
    await page.getByRole("button", { name: "Войти через " + platform, exact: true }).click();
    await expect(page.getByRole("heading", { name: home, exact: true })).toBeVisible();
    await first.close();

    const second = await device(browser);
    const again = await second.newPage();
    const bodies: Record<string, unknown>[] = [];
    again.on("request", (r) => {
      if (new URL(r.url()).pathname === endpoint && r.method() === "POST") bodies.push(r.postDataJSON());
    });
    await again.goto(signedLaunch(platform, id));
    await expect(again.getByRole("heading", { name: home, exact: true })).toBeVisible();
    await expect(again.getByRole("button", { name: new RegExp(alias) })).toBeVisible();
    await expect(again.getByLabel("Как к вам обращаться")).toHaveCount(0);
    await expect(again.getByRole("radio")).toHaveCount(0);
    expect(bodies.length).toBe(1);
    expect(bodies[0]).not.toHaveProperty("role");

    // Signing in again after logout must not bring the questionnaire back either.
    await again.getByRole("button", { name: new RegExp(alias) }).click();
    await again.getByRole("button", { name: "Выйти", exact: true }).click();
    const signIn = again.getByRole("button", { name: "Войти через " + platform, exact: true });
    await expect(signIn).toBeVisible();
    await expect(again.getByLabel("Как к вам обращаться")).toHaveCount(0);
    await signIn.click();
    await expect(again.getByRole("heading", { name: home, exact: true })).toBeVisible();
    await expect(again.getByRole("button", { name: new RegExp(alias) })).toBeVisible();
    await second.close();
  });
