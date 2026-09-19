import { test, expect } from "@playwright/test";
test.skip(
  !process.env.E2E_MAX_SDK_PATH,
  "Provide an explicitly downloaded official Bridge snapshot",
);
test("official Bridge snapshot emits back/closing events and rejects foreign-origin back", async ({
  page,
}) => {
  await page.route("https://st.max.ru/js/max-web-app.js", (r) =>
    r.fulfill({
      path: process.env.E2E_MAX_SDK_PATH!,
      contentType: "application/javascript",
    }),
  );
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  const raw =
    "query_id=fixture&auth_date=1800000000&user=%7B%22id%22%3A42%7D&hash=synthetic";
  await page.setContent(
    '<iframe src="' +
      origin +
      "/#WebAppData=" +
      encodeURIComponent(raw) +
      '&WebAppPlatform=web" style="width:390px;height:844px"></iframe>',
  );
  await page.evaluate(() => {
    (window as any).received = [];
    window.addEventListener("message", (e) => {
      if (typeof e.data === "string")
        try {
          (window as any).received.push(JSON.parse(e.data));
        } catch {}
    });
  });
  const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: "Я ученик", exact: true }).click();
  await frame
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  const child = page.frames()[1];
  expect(await child.evaluate(() => (window as any).WebApp.initData)).toBe(raw);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).received.some(
          (e: any) => e.type === "WebAppSetupBackButton" && e.isVisible,
        ),
      ),
    )
    .toBe(true);
  await frame.getByLabel("Ответ на задание 1").fill("5");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).received.some(
          (e: any) =>
            e.type === "WebAppSetupClosingBehavior" && e.needConfirmation,
        ),
      ),
    )
    .toBe(true);
  await child.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://foreign.example",
        data: JSON.stringify({ type: "WebAppBackButtonPressed" }),
      }),
    ),
  );
  await expect(frame.getByLabel("Ответ на задание 1")).toHaveValue("5");
  page.once("dialog", (d) => d.dismiss());
  await child.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://web.max.ru",
        data: JSON.stringify({ type: "WebAppBackButtonPressed" }),
      }),
    ),
  );
  await expect(frame.getByLabel("Ответ на задание 1")).toHaveValue("5");
});
