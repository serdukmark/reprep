import { test, expect } from "./audit-fixtures";
for (const width of [1440, 390])
  test(`checkbox labels remain adjacent at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    if (width < 700)
      await page
        .getByRole("button", { name: "Открыть меню", exact: true })
        .click();
    await page.getByRole("button", { name: "Репетиторы", exact: true }).click();
    const checkbox = page.getByLabel("Показывать мою анкету в каталоге");
    await expect(checkbox).toBeVisible();
    if (process.env.E2E_MUTATION === "checkbox-layout")
      await page.addStyleTag({
        content:
          'label:has(> input[type="checkbox"]) {display:block !important} input[type="checkbox"] {width:100% !important}',
      });
    const box = await checkbox.boundingBox();
    const label = await checkbox.locator("..").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(24);
    expect(box!.x - label!.x).toBeLessThanOrEqual(5);
    await checkbox.locator("..").click();
    await expect(checkbox).toBeChecked();
    await page.screenshot({
      path: `artifacts/deep-audit/checkbox-${width}.png`,
    });
  });
