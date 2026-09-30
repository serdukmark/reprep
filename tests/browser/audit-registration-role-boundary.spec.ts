import { test, expect } from "./audit-fixtures";
import { createHmac, randomInt } from "node:crypto";

// U073 / FR-AUTH-001/002. Signed local fixtures, no live messenger launch.
// All eight cases choose the supported learner role in UI. Only body.role is
// corrupted at the request boundary; this is not coverage of every valid role.
function signedLaunch(platform: string, id: number) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: "Синтетический" }),
    query_id: "audit-role-boundary",
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
        .map(([key, value]) => key + "=" + value)
        .join("\n"),
    )
    .digest("hex");
  const raw = new URLSearchParams({ ...fields, hash }).toString();
  return (
    "/#" +
    (platform === "MAX" ? "WebAppData" : "tgWebAppData") +
    "=" +
    encodeURIComponent(raw)
  );
}

const invalidRoles = [
  ["empty", ""],
  ["long", "learner".repeat(150)],
  ["Unicode", "Ученик 🧪 Ё"],
  ["organizer", "organizer"],
] as const;

for (const platform of ["MAX"] as const)
  for (const [kind, invalidRole] of invalidRoles)
    test(`${platform} simulated registration: ${kind} role is rejected and the same learner form recovers`, async ({
      page,
    }) => {
      await page.route("https://st.max.ru/js/max-web-app.js", (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: 'window.WebApp={initData:""}',
        }),
      );
      await page.route("https://telegram.org/js/telegram-web-app.js", (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: 'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}',
        }),
      );
      await page.goto(
        signedLaunch(platform, randomInt(100_000_000_000, 900_000_000_000)),
      );
      const alias = `Ученик ${platform} <>& 🧪`;
      const name = page.getByLabel("Как к вам обращаться");
      const chosenRole = page.getByRole("radio", { name: /^Ученик/ });
      const button = page.getByRole("button", {
        name: "Войти через " + platform,
        exact: true,
      });
      await name.fill(alias);
      await page
        .locator(".registration-role")
        .filter({ has: chosenRole })
        .click();
      await expect(page.getByRole("radio")).toHaveCount(3);
      await expect(
        page.getByRole("radio", { name: /Организатор/ }),
      ).toHaveCount(0);
      await expect(chosenRole).toBeChecked();

      const endpoint = "/api/auth/" + (platform === "MAX" ? "max" : "telegram");
      const path = "**" + endpoint;
      let denied = 0;
      await page.route(path, async (route) => {
        expect(route.request().method()).toBe("POST");
        const body = route.request().postDataJSON();
        expect(body.role).toBe("learner");
        expect(body.alias).toBe(alias);
        const response = await route.fetch({
          postData: { ...body, role: invalidRole },
        });
        expect(response.status()).toBe(422);
        const error = await response.json();
        expect(error.error.code).toBe("VALIDATION");
        expect(error.error.message).toBe("Проверьте заполнение полей: role");
        expect(error).not.toHaveProperty("user");
        expect(error).not.toHaveProperty("token");
        denied++;
        await route.fulfill({ response });
      });
      await button.click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Проверьте заполнение полей: role" }),
      ).toBeVisible();
      expect(denied).toBe(1);
      await expect(name).toHaveValue(alias);
      await expect(chosenRole).toBeChecked();
      await expect(button).toBeEnabled();
      await expect(page.locator(".account")).toHaveCount(0);
      for (const heading of [
        "Хороший день, чтобы учить.",
        "Ваш следующий шаг.",
        "Кабинет родителя",
      ]) {
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toHaveCount(0);
      }
      expect(
        await page.evaluate(() =>
          Boolean(sessionStorage.getItem("reprep.session")),
        ),
      ).toBe(false);
      // These observations prove that the failed response did not log in this
      // browser. They do not assert the absence of a database row.

      await page.unroute(path);
      const authenticated = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === endpoint &&
          response.request().method() === "POST",
      );
      // Read only the requests made by the UI after successful registration.
      // A fresh fixture must not inherit the demo learners' private resources.
      const resources = [
        "relationships",
        "assignments",
        "lessons",
        "materials",
      ].map((resource) =>
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/" + resource &&
            response.request().method() === "GET",
        ),
      );
      await button.click();
      const response = await authenticated;
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON().role).toBe("learner");
      const identity = (await response.json()).user;
      expect(typeof identity.id).toBe("string");
      expect(identity.id.length).toBeGreaterThan(0);
      expect(identity.id).not.toBe("demo-learner");
      expect(identity.role).toBe("learner");
      expect(identity.alias).toBe(alias);
      for (const resource of await Promise.all(resources)) {
        expect(resource.status()).toBe(200);
        expect(await resource.json()).toEqual([]);
      }
      await expect(
        page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: new RegExp(alias) }),
      ).toBeVisible();
      await expect(name).toHaveCount(0);
      await page.getByRole("button", { name: "Задания", exact: true }).click();
      await expect(
        page.getByText("Заданий пока нет", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".assignment-row")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Мой прогресс", exact: true })
        .click();
      await expect(
        page.getByText("Начните со знакомства", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".learner-list button")).toHaveCount(0);

      const restored = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/me" &&
          response.request().method() === "GET",
      );
      await page.reload();
      const restoredResponse = await restored;
      expect(restoredResponse.status()).toBe(200);
      const restoredIdentity = await restoredResponse.json();
      expect(restoredIdentity.id).toBe(identity.id);
      expect(restoredIdentity.role).toBe("learner");
      expect(restoredIdentity.alias).toBe(alias);
      await expect(
        page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: new RegExp(alias) }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.getByRole("button", { name: "Задания", exact: true }).click();
      await expect(
        page.getByText("Заданий пока нет", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".assignment-row")).toHaveCount(0);
    });
