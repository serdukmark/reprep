import { test, expect } from "./audit-fixtures";
const roles = {
  tutor: ["Я преподаватель", "Алекс • демо"],
  learner: ["Я ученик", "Саша • демо"],
  guardian: ["Я родитель", "Родитель • демо"],
  outsider: ["Другой преподаватель · демо", "Другой репетитор • демо"],
};
for (const pair of [
  ["tutor", "learner"],
  ["guardian", "outsider"],
] as const)
  test(`deletion ${pair.join("/")}: simultaneous requests and forged cancellation keep accounts isolated`, async ({
    context,
  }) => {
    const pages = await Promise.all(pair.map(() => context.newPage()));
    for (const [i, page] of pages.entries()) {
      const [button, alias] = roles[pair[i]];
      await page.goto("/");
      await page.getByRole("button", { name: button, exact: true }).click();
      if (pair[i] !== "guardian")
        await page.getByRole("button", { name: new RegExp(alias) }).click();
      await page.getByLabel("Имя для запроса удаления").fill(alias);
    }
    const requests = pages.map((p) =>
      p.waitForResponse(
        (r) =>
          r.url().endsWith("/api/account/deletion") &&
          r.request().method() === "POST",
      ),
    );
    await Promise.all(
      pages.map((p) =>
        p
          .getByRole("button", {
            name: "Запросить удаление аккаунта",
            exact: true,
          })
          .click(),
      ),
    );
    const responses = await Promise.all(requests);
    expect(responses.every((r) => r.status() === 201)).toBe(true);
    const ids = await Promise.all(
      responses.map(async (r) => (await r.json()).id),
    );
    expect(ids[0]).not.toBe(ids[1]);
    for (const p of pages)
      await expect(
        p.getByText("Запрос на удаление ожидает обработки владельцем.", {
          exact: true,
        }),
      ).toBeVisible();
    await pages[0].route("**/api/account/deletion/cancel", async (r) => {
      const url = new URL(r.request().url());
      url.searchParams.set("id", ids[1]);
      url.searchParams.set("user_id", "demo-" + pair[1]);
      const response = await r.fetch({
        url: url.href,
        postData: { id: ids[1], user_id: "demo-" + pair[1] },
      });
      expect(response.status()).toBe(200);
      await r.fulfill({ response });
    });
    await pages[0]
      .getByRole("button", { name: "Отменить запрос на удаление", exact: true })
      .click();
    await expect(
      pages[0].getByText("Запрос отменён", { exact: true }),
    ).toBeVisible();
    for (const [i, p] of pages.entries()) {
      await p.reload();
      if (pair[i] !== "guardian")
        await p
          .getByRole("button", { name: new RegExp(roles[pair[i]][1]) })
          .click();
      if (i === 0)
        await expect(
          p.getByRole("button", {
            name: "Запросить удаление аккаунта",
            exact: true,
          }),
        ).toBeVisible();
      else
        await expect(
          p.getByText("Запрос на удаление ожидает обработки владельцем.", {
            exact: true,
          }),
        ).toBeVisible();
    }
    await pages[1]
      .getByRole("button", { name: "Отменить запрос на удаление", exact: true })
      .click();
    await expect(
      pages[1].getByText("Запрос отменён", { exact: true }),
    ).toBeVisible();
  });
