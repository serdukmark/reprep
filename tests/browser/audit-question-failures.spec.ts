import { test, expect } from "./audit-fixtures";
test("question validates empty and long text, lost acknowledgement retries once, teacher reply recovers from network failure", async ({
  browser,
}) => {
  const learner = await browser.newPage(),
    tutor = await browser.newPage();
  const open = async (p: typeof learner) =>
    p
      .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
      .click();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await open(learner);
  const field = learner.getByRole("textbox", {
      name: "Вопрос к AI",
      exact: true,
    }),
    send = learner.getByRole("button", { name: "Задать вопрос", exact: true });
  await expect(send).toBeDisabled();
  await field.fill("   ");
  await expect(send).toBeDisabled();
  await field.fill("Я".repeat(3100));
  expect((await field.inputValue()).length).toBe(3000);
  const text = "Почему так? 🧪 <script>это текст</script> & Ё";
  await field.fill(text);
  const path = "**/api/assignments/*/questions";
  await learner.route(path, async (route) => {
    if (route.request().method() === "POST") {
      expect((await route.fetch()).ok()).toBeTruthy();
      await route.abort();
    } else await route.continue();
  });
  await send.click();
  await expect(learner.getByRole("alert").first()).toBeVisible();
  await expect(field).toHaveValue(text);
  await learner.unroute(path);
  await send.dblclick();
  await expect(field).toHaveValue("");
  await expect(learner.getByText(text, { exact: true })).toHaveCount(1);
  await learner.reload();
  await open(learner);
  await expect(learner.getByText(text, { exact: true })).toHaveCount(1);
  await expect(
    learner.getByText("AI не смог ответить. Ответит преподаватель.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await open(tutor);
  const reply = tutor.getByRole("textbox", {
      name: "Ответ преподавателя на вопрос",
      exact: true,
    }),
    confirm = tutor.getByRole("button", {
      name: "Подтвердить и отправить ответ",
      exact: true,
    });
  await reply.fill("");
  await expect(confirm).toBeDisabled();
  await reply.fill("Я".repeat(3100));
  expect((await reply.inputValue()).length).toBe(3000);
  const answer = "Разбор преподавателя 🧪 <без HTML>";
  await reply.fill(answer);
  await tutor.route("**/api/questions/*/review", (route) => route.abort());
  await confirm.click();
  await expect(tutor.getByRole("alert").first()).toBeVisible();
  await expect(reply).toHaveValue(answer);
  await expect(
    learner.getByText("Ответ проверен преподавателем: " + answer, {
      exact: true,
    }),
  ).toHaveCount(0);
  await tutor.unroute("**/api/questions/*/review");
  await confirm.dblclick();
  await expect(
    learner.getByText("Ответ проверен преподавателем: " + answer, {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await learner.close();
  await tutor.close();
});
