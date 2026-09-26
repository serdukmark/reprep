import { test, expect } from "./audit-fixtures";

for (const [
  role,
  loginButton,
  alias,
  foreignButton,
  foreignAlias,
  foreignId,
] of [
  [
    "tutor",
    "Я преподаватель",
    "Алекс • демо",
    "Я ученик",
    "Саша • демо",
    "demo-learner",
  ],
  [
    "learner",
    "Я ученик",
    "Саша • демо",
    "Я преподаватель",
    "Алекс • демо",
    "demo-tutor",
  ],
  [
    "outsider",
    "Другой преподаватель · демо",
    "Другой репетитор • демо",
    "Я преподаватель",
    "Алекс • демо",
    "demo-tutor",
  ],
])
  test(`profile ${role}: body IDs rejected and query IDs cannot choose the updated account`, async ({
    page,
    browser,
  }) => {
    const observer = await browser.newPage(),
      ownObserver = await browser.newPage();
    try {
      await observer.goto("/");
      await observer
        .getByRole("button", { name: foreignButton, exact: true })
        .click();
      await observer
        .getByRole("button", { name: new RegExp(foreignAlias) })
        .click();
      await expect(observer.getByLabel("Отображаемое имя")).toHaveValue(
        foreignAlias,
      );
      await page.goto("/");
      await page
        .getByRole("button", { name: loginButton, exact: true })
        .click();
      await page.getByRole("button", { name: new RegExp(alias) }).click();
      const name = "Своя учётная запись <>& 🧪";
      await page.getByLabel("Отображаемое имя").fill(name);
      await page.route("**/api/profile", async (route) => {
        const response = await route.fetch({
          postData: {
            ...route.request().postDataJSON(),
            id: foreignId,
            user_id: foreignId,
            role: "tutor",
          },
        });
        expect(response.status()).toBe(422);
        await route.fulfill({ response });
      });
      await page
        .getByRole("button", { name: "Сохранить имя", exact: true })
        .click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expect(page.getByLabel("Отображаемое имя")).toHaveValue(name);
      await expect(
        page.getByRole("button", { name: new RegExp(alias) }),
      ).toBeVisible();
      await ownObserver.goto("/");
      await ownObserver
        .getByRole("button", { name: loginButton, exact: true })
        .click();
      await ownObserver
        .getByRole("button", { name: new RegExp(alias) })
        .click();
      await expect(ownObserver.getByLabel("Отображаемое имя")).toHaveValue(
        alias,
      );
      await page.unroute("**/api/profile");
      await page.route("**/api/profile", async (route) => {
        const url = new URL(route.request().url());
        url.searchParams.set("id", foreignId);
        url.searchParams.set("user_id", foreignId);
        url.searchParams.set("role", "tutor");
        const response = await route.fetch({ url: url.href });
        expect(response.status()).toBe(200);
        expect((await response.json()).id).toBe("demo-" + role);
        await route.fulfill({ response });
      });
      await page
        .getByRole("button", { name: "Сохранить имя", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: /Своя учётная запись/ }),
      ).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: /Своя учётная запись/ }).click();
      await expect(page.getByLabel("Отображаемое имя")).toHaveValue(name);
      await observer.reload();
      await observer
        .getByRole("button", { name: new RegExp(foreignAlias) })
        .click();
      await expect(observer.getByLabel("Отображаемое имя")).toHaveValue(
        foreignAlias,
      );
    } finally {
      await observer.close();
      await ownObserver.close();
    }
  });
