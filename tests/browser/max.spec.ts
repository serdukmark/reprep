import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
test.skip(
  process.env.E2E_MAX_SIM !== "true",
  "Requires isolated server with synthetic MAX token",
);

test("embedded storage denial does not prevent login", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  await page.goto("/#WebAppData=synthetic-storage-test");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ваш следующий шаг." }),
  ).toBeVisible();
});

test("MAX URL authentication and iframe Bridge lifecycle (simulated client)", async ({
  page,
}) => {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 333777, first_name: "Синтетика" }),
    query_id: "max-browser",
  };
  const signing = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => k + "=" + v)
    .join("\n");
  const key = createHmac("sha256", "WebAppData")
    .update("synthetic-max-test-token")
    .digest();
  const hash = createHmac("sha256", key).update(signing).digest("hex");
  const raw = new URLSearchParams({ ...fields, hash }).toString();
  await page.route("https://st.max.ru/js/max-web-app.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.bridgeEvents=[];window.WebApp={initData:'',BackButton:{show(){bridgeEvents.push('show')},hide(){bridgeEvents.push('hide')},onClick(f){window.maxBack=f},offClick(){window.maxBack=null}},enableClosingConfirmation(){bridgeEvents.push('dirty')},disableClosingConfirmation(){bridgeEvents.push('clean')}};`,
    }),
  );
  await page.goto("/#WebAppData=" + encodeURIComponent(raw));
  await page.getByLabel("Как к вам обращаться").fill("MAX проверка");
  await page
    .getByRole("button", { name: "Войти через MAX", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Хороший день, чтобы учить." }),
  ).toBeVisible();
  await expect(page.locator(".account")).toContainText("Аккаунт MAX");
  await page.getByRole("button", { name: "Материалы", exact: true }).click();
  await page.evaluate(() => {
    (window as any).maxBack();
  });
  await expect(
    page.getByRole("heading", { name: "Хороший день, чтобы учить." }),
  ).toBeVisible();
  // A corrupted identity must not authenticate even inside a plausible MAX wrapper.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("about:blank");
  await page.goto(
    "/#WebAppData=" + encodeURIComponent(raw.replace("333777", "999777")),
  );
  await page
    .getByRole("button", { name: "Войти через MAX", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Откройте приложение заново из MAX",
  );
  // Local iframe proves headers/assets allow embedding, not that MAX production works.
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  await page.setContent(
    '<iframe title="MAX simulation" src="' +
      origin +
      "/#WebAppData=" +
      encodeURIComponent(raw) +
      '" style="width:390px;height:844px"></iframe>',
  );
  const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: "Я ученик", exact: true }).click();
  await frame
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await frame.getByLabel("Ответ на задание 1").fill("5");
  const child = page.frames()[1];
  expect(
    await child.evaluate(() => (window as any).bridgeEvents.includes("dirty")),
  ).toBe(true);
  page.once("dialog", (d) => d.dismiss());
  await child.evaluate(() => (window as any).maxBack());
  await expect(frame.getByLabel("Ответ на задание 1")).toHaveValue("5");
  expect(
    await child.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
