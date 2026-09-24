import { test, expect } from "./audit-fixtures";
test("public landing does not promise demonstration when demo access is disabled", async ({
  page,
}) => {
  await page.route("**/api/config", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), demo_enabled: false },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Ваше учебное пространство",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Я преподаватель", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Начните с демонстрации или откройте приложение в мессенджере.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(
    page.getByText("Откройте приложение в мессенджере.", { exact: true }),
  ).toBeVisible();
});
