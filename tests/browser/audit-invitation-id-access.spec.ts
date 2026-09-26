import { test, expect } from "./audit-fixtures";

test("learner invitations: foreign tutor fields and revoke ID cannot create, list or revoke for another tutor", async ({
  page,
  browser,
}) => {
  const foreign = await browser.newPage(),
    pupil = await browser.newPage();
  try {
    await foreign.goto("/");
    await foreign
      .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
      .click();
    await foreign.getByRole("button", { name: "Ученики", exact: true }).click();
    const foreignCreated = foreign.waitForResponse(
      (r) =>
        r.url().endsWith("/api/invitations") && r.request().method() === "POST",
    );
    await foreign
      .getByRole("button", { name: "Пригласить ученика", exact: true })
      .click();
    const foreignResponse = await foreignCreated;
    expect(foreignResponse.ok()).toBe(true);
    const foreignId = (await foreignResponse.json()).id;
    const foreignCode = await foreign.locator(".invite-box code").innerText();
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await page.route("**/api/invitations", async (route) => {
      if (route.request().method() === "POST") {
        const response = await route.fetch({
          postData: {
            ...route.request().postDataJSON(),
            tutor_id: "demo-outsider",
            user_id: "demo-outsider",
          },
        });
        expect(response.status()).toBe(422);
        return route.fulfill({ response });
      }
      return route.continue();
    });
    await page
      .getByRole("button", { name: "Пригласить ученика", exact: true })
      .click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.locator(".invite-box code")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Отозвать", exact: true }),
    ).toHaveCount(0);
    await page.unroute("**/api/invitations");
    await page.route("**/api/invitations", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const url = new URL(route.request().url());
      url.searchParams.set("tutor_id", "demo-outsider");
      url.searchParams.set("id", foreignId);
      const response = await route.fetch({ url: url.href });
      expect(response.status()).toBe(200);
      expect(
        (await response.json()).some((x: { id: string }) => x.id === foreignId),
      ).toBe(false);
      await route.fulfill({ response });
    });
    await page
      .getByRole("button", { name: "Пригласить ученика", exact: true })
      .click();
    const ownCode = await page.locator(".invite-box code").innerText();
    await expect(
      page.getByRole("button", { name: "Отозвать", exact: true }),
    ).toHaveCount(1);
    await page.route("**/api/invitations/*/revoke", async (route) => {
      const response = await route.fetch({
        url: new URL(
          `/api/invitations/${foreignId}/revoke`,
          route.request().url(),
        ).href,
      });
      expect(response.status()).toBe(409);
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "Отозвать", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Отозвать", exact: true }),
    ).toHaveCount(1);
    await foreign.reload();
    await foreign.getByRole("button", { name: "Ученики", exact: true }).click();
    await expect(
      foreign.getByRole("button", { name: "Отозвать", exact: true }),
    ).toHaveCount(1);
    await pupil.goto("/");
    await pupil.getByRole("button", { name: "Я ученик", exact: true }).click();
    await pupil.getByRole("button", { name: /Саша • демо/ }).click();
    const preview = async (code: string, tutor: RegExp) => {
      await pupil.getByLabel("Код приглашения", { exact: true }).fill(code);
      await pupil
        .getByRole("button", { name: "Посмотреть приглашение", exact: true })
        .click();
      await expect(pupil.getByText(tutor)).toBeVisible();
    };
    await preview(ownCode, /Преподаватель: Алекс/);
    await preview(foreignCode, /Преподаватель: Другой репетитор/);
    await page.unroute("**/api/invitations/*/revoke");
    await page.getByRole("button", { name: "Отозвать", exact: true }).click();
    await expect(page.getByText(/· Отозвано/)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    await expect(page.getByText(/· Отозвано/)).toBeVisible();
    await pupil.getByLabel("Код приглашения", { exact: true }).fill(ownCode);
    await pupil
      .getByRole("button", { name: "Посмотреть приглашение", exact: true })
      .click();
    await expect(pupil.getByRole("alert").first()).toBeVisible();
    await preview(foreignCode, /Преподаватель: Другой репетитор/);
  } finally {
    await foreign.close();
    await pupil.close();
  }
});
