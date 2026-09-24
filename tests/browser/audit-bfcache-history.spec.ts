import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";
test.use({
  trace: "off",
  launchOptions: {
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ignoreDefaultArgs: ["--disable-back-forward-cache"],
  },
});
async function observe(page: Page) {
  const state = { restored: 0, painted: false };
  page.on("console", (m) => {
    if (m.text() === "AUDIT_HISTORY_RESTORED") state.restored++;
    if (m.text() === "AUDIT_CACHED_ACCOUNT_VISIBLE") state.painted = true;
  });
  await page.addInitScript(() => {
    addEventListener("pageshow", (e) => {
      if (!e.persisted || location.pathname !== "/") return;
      console.info("AUDIT_HISTORY_RESTORED");
      requestAnimationFrame(() => {
        if (
          document.querySelector(".shell,.guardian-portal") &&
          getComputedStyle(document.documentElement).visibility !== "hidden"
        )
          console.info("AUDIT_CACHED_ACCOUNT_VISIBLE");
      });
    });
  });
  return state;
}
async function enter(page: Page, button: string) {
  await page.getByRole("button", { name: button, exact: true }).click();
}
async function leave(page: Page, alias: string) {
  await page.getByRole("button", { name: new RegExp(alias) }).click();
  await enter(page, "Выйти");
}
const navigation = { waitUntil: "commit" as const, timeout: 5000 };
test("two back then two forward transitions revalidate each cached account document", async ({
  page,
}) => {
  const state = await observe(page);
  await page.goto("/");
  await enter(page, "Я преподаватель");
  await expect(
    page.getByRole("heading", {
      name: "Хороший день, чтобы учить.",
      exact: true,
    }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.goto("/api/health");
  await page.goto("/?audit-history-second=1");
  await leave(page, "Алекс • демо");
  await enter(page, "Я ученик");
  await expect(
    page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.goBack(navigation);
  await page.goBack(navigation);
  await expect.poll(() => state.restored).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true }),
  ).toBeVisible();
  await leave(page, "Саша • демо");
  await enter(page, "Другой преподаватель · демо");
  await expect(
    page.getByRole("button", { name: /Другой репетитор • демо/ }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.goForward(navigation);
  await page.goForward(navigation);
  await expect.poll(() => state.restored).toBe(2);
  await expect(
    page.getByRole("button", { name: /Другой репетитор • демо/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Саша • демо|Алекс • демо/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Линейные уравнения: от шага к решению/ }),
  ).toHaveCount(0);
  expect(state.painted).toBe(false);
  test
    .info()
    .annotations.push({
      type: "bfcache-restored",
      description: String(state.restored),
    });
});
test("logout of a copied session in another tab invalidates a cached document on return", async ({
  page,
  context,
}) => {
  const state = await observe(page);
  await page.goto("/");
  await enter(page, "Я преподаватель");
  await expect(
    page.getByRole("heading", {
      name: "Хороший день, чтобы учить.",
      exact: true,
    }),
  ).toBeVisible();
  const token = await page.evaluate(() =>
    sessionStorage.getItem("reprep.session"),
  );
  await page.waitForLoadState("networkidle");
  await page.goto("/api/health");
  // Model a second window opened with the same sessionStorage token, not another login.
  const second = await context.newPage();
  await second.addInitScript(
    (t) => sessionStorage.setItem("reprep.session", t!),
    token,
  );
  await second.goto("/");
  await expect(
    second.getByRole("button", { name: /Алекс • демо/ }),
  ).toBeVisible();
  await leave(second, "Алекс • демо");
  await expect(
    second.getByRole("button", { name: "Я преподаватель", exact: true }),
  ).toBeVisible();
  await page.goBack(navigation);
  await expect.poll(() => state.restored).toBe(1);
  await expect(
    page.getByRole("button", { name: "Я преподаватель", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ученики", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Алекс • демо/ })).toHaveCount(
    0,
  );
  expect(state.painted).toBe(false);
  await enter(page, "Я ученик");
  await expect(
    page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true }),
  ).toBeVisible();
  test
    .info()
    .annotations.push({
      type: "bfcache-restored",
      description: String(state.restored),
    });
  await second.close();
});
