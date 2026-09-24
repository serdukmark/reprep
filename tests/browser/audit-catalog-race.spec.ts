import { test, expect } from "./audit-fixtures";
test("delayed old catalog search cannot replace results for the current query", async ({
  context,
}) => {
  const owner = await context.newPage(),
    learner = await context.newPage();
  await owner.goto("/");
  await owner
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await owner.getByRole("button", { name: "Репетиторы", exact: true }).click();
  await owner
    .getByLabel("Заголовок анкеты")
    .fill("Физика: контроль старого ответа");
  await owner
    .getByLabel("О занятиях", { exact: true })
    .fill("Синтетическая анкета для проверки порядка ответов.");
  await owner
    .getByLabel("Предметы анкеты (каждый с новой строки)")
    .fill("Физика");
  await owner.getByLabel("Показывать мою анкету в каталоге").check();
  await owner
    .getByRole("button", { name: "Сохранить анкету", exact: true })
    .click();
  await expect(owner.getByRole("status")).toHaveText("Анкета сохранена");
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner
    .getByRole("button", { name: "Репетиторы", exact: true })
    .click();
  await expect(
    learner.getByRole("heading", { name: "Физика: контроль старого ответа" }),
  ).toBeVisible();
  let release!: () => void, start!: () => void, delivered!: () => void;
  const held = new Promise<void>((r) => (release = r)),
    seen = new Promise<void>((r) => (start = r)),
    done = new Promise<void>((r) => (delivered = r));
  await learner.route("**/api/catalog?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("q") !== "Физика")
      return route.continue();
    const response = await route.fetch();
    start();
    await held;
    await route.fulfill({ response });
    delivered();
  });
  await learner.getByLabel("Предмет или имя").fill("Физика");
  await seen;
  await learner.getByLabel("Предмет или имя").fill("Нет такого предмета");
  await expect(
    learner.getByText("Подходящих анкет пока нет.", { exact: true }),
  ).toBeVisible();
  await learner.evaluate(() => {
    (window as any).staleCatalog = false;
    new MutationObserver(() => {
      if (
        document
          .querySelector("main")
          ?.textContent?.includes("Физика: контроль старого ответа")
      )
        (window as any).staleCatalog = true;
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  release();
  await done;
  await learner.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await learner.evaluate(() => (window as any).staleCatalog)).toBe(
    false,
  );
  await expect(
    learner.getByRole("heading", { name: "Физика: контроль старого ответа" }),
  ).toHaveCount(0);
  await owner.close();
  await learner.close();
});
