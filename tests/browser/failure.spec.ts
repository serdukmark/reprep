import { test, expect, choose } from "./audit-fixtures";

test("provider outage and lost polling recover to visible manual review", async ({
  browser,
}) => {
  test.skip(
    process.env.E2E_FAULT_SIM !== "true",
    "Requires isolated tests.fault_server",
  );
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  const errors: string[] = [];
  for (const page of [tutor, learner])
    page.on("pageerror", (e) => errors.push(e.message));
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor.getByRole("button", { name: "Создать задание" }).click();
  const title = "Отказ AI " + Date.now();
  await tutor.getByLabel("Название работы").fill(title);
  await choose(tutor.getByLabel("Ученик", { exact: true }), "demo-link");
  await tutor.getByLabel("Условие", { exact: true }).fill("Решите 3x + 7 = 22");
  await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await tutor.getByLabel("Навык", { exact: true }).fill("Уравнения");
  if (process.env.E2E_AUDIT === "1")
    await tutor.getByLabel("Инструкция ученику").fill("AUD_AI_UNAVAILABLE");
  await tutor.getByRole("button", { name: "Назначить ученику" }).click();
  await expect(tutor.getByRole("heading", { name: title })).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await learner.getByLabel("Ответ на задание 1").fill("5");
  let release: (() => void) | undefined;
  await learner.route("**/api/assignments/*/draft", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.abort().catch(() => {});
  });
  await learner.getByRole("button", { name: "Сохранить ответы" }).click();
  await expect(learner.locator(".save-error")).toContainText(
    "Сервер не ответил вовремя",
    { timeout: 20000 },
  );
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue("5");
  release?.();
  await learner.unroute("**/api/assignments/*/draft");
  learner.once("dialog", (d) => d.accept());
  await learner.getByRole("button", { name: "Отправить работу" }).click();
  await expect(learner.locator(".work-task .original p")).toHaveText("5");
  await tutor.reload();
  await tutor.getByRole("button", { name: new RegExp(title) }).click();
  // Interrupt a browser status request while the provider fails independently.
  await tutor.route("**/api/assignments/*", (route) => route.abort());
  await expect(tutor.getByRole("alert")).toContainText(
    "Не удалось связаться с сервером",
    { timeout: 12000 },
  );
  await expect(tutor.locator(".work-task .original p")).toHaveText("5");
  await tutor.unroute("**/api/assignments/*");
  await expect(
    tutor.getByText(/AI не смог подготовить надёжный разбор/),
  ).toBeVisible({ timeout: 12000 });
  await expect(
    tutor.getByRole("button", { name: "Подтвердить разбор", exact: true }),
  ).toHaveCount(0);
  await choose(
    tutor.getByRole("combobox", { name: "Результат", exact: true }),
    "correct",
  );
  await tutor
    .getByLabel("Обратная связь ученику")
    .fill("Ответ проверен преподавателем: верно.");
  await tutor.getByRole("button", { name: "Сохранить мою проверку" }).click();
  await expect(
    learner.getByText("Ответ проверен преподавателем: верно.", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(learner.locator(".work-task .original p")).toHaveText("5");
  expect(errors).toEqual([]);
  await tutor.screenshot({
    path: "artifacts/ui-manual-after-outage.png",
    fullPage: true,
  });
  await tutor.close();
  await learner.close();
});
