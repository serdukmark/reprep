import { test, expect, choose } from "./audit-fixtures";
test("switching workspaces cannot show delayed templates from previous workspace", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  const ids: string[] = [];
  for (const title of ["Первое пространство", "Второе пространство"]) {
    await page.getByLabel("Название пространства").fill(title);
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/workspaces") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Создать пространство", exact: true })
      .click();
    ids.push((await (await response).json()).id);
    await expect(
      page.getByRole("combobox", { name: "Текущее пространство", exact: true }),
    ).toHaveText(title);
  }
  let release!: () => void, seen!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    started = new Promise<void>((r) => (seen = r));
  await page.route("**/api/workspaces/*/templates", async (route) => {
    const old = route.request().url().includes(ids[0]);
    if (old) {
      seen();
      await gate;
    }
    await route.fulfill({
      json: [
        {
          id: old ? "old-template" : "new-template",
          title: old ? "Шаблон первого" : "Шаблон второго",
          author_alias: "Синтетический автор",
          tasks_count: 1,
        },
      ],
    });
  });
  await choose(
    page.getByRole("combobox", { name: "Текущее пространство", exact: true }),
    ids[0],
  );
  await started;
  await choose(
    page.getByRole("combobox", { name: "Текущее пространство", exact: true }),
    ids[1],
  );
  await expect(page.getByText("Шаблон второго", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    (window as any).staleTemplateSeen = false;
    new MutationObserver(() => {
      if (document.body.textContent?.includes("Шаблон первого"))
        (window as any).staleTemplateSeen = true;
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  const response = page.waitForResponse((r) =>
    r.url().includes(ids[0] + "/templates"),
  );
  release();
  await (await response).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await page.evaluate(() => (window as any).staleTemplateSeen)).toBe(
    false,
  );
  await expect(page.getByText("Шаблон второго", { exact: true })).toBeVisible();
});
