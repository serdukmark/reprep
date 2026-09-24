import { test, expect, choose } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
test("schedule cancellation, all payment notes and calendar preserve learner privacy after reload", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await tutor.getByRole("button", { name: "Расписание", exact: true }).click();
  await tutor
    .getByRole("button", { name: "Добавить занятие", exact: true })
    .click();
  const title = "Занятие для отмены 🧪";
  await tutor.getByLabel("Название", { exact: true }).fill(title);
  await choose(
    tutor.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  await tutor.getByLabel("Начало (ваш часовой пояс)").fill("2026-12-31T18:00");
  await tutor.getByRole("button", { name: "Сохранить", exact: true }).click();
  const card = tutor
    .locator("section")
    .filter({ has: tutor.getByRole("heading", { name: title, exact: true }) })
    .last();
  await expect(card).toBeVisible();
  for (const [value, label] of [
    ["paid", "Оплачено"],
    ["unpaid", "Не оплачено"],
    ["waived", "Без оплаты"],
    ["unknown", "Не отмечено"],
  ]) {
    await choose(
      card.getByRole("combobox", {
        name: "Ваша отметка об оплате",
        exact: true,
      }),
      value,
    );
    await expect(
      card.getByRole("combobox", {
        name: "Ваша отметка об оплате",
        exact: true,
      }),
    ).toHaveText(label);
  }
  await choose(
    card.getByRole("combobox", { name: "Статус занятия", exact: true }),
    "cancelled",
  );
  await expect(
    card.getByRole("combobox", { name: "Статус занятия", exact: true }),
  ).toHaveText("Отменено");
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner
    .getByRole("button", { name: "Расписание", exact: true })
    .click();
  const shown = learner
    .locator("section")
    .filter({ has: learner.getByRole("heading", { name: title, exact: true }) })
    .last();
  await expect(shown.getByText("Отменено", { exact: true })).toBeVisible();
  await expect(
    learner.getByRole("combobox", {
      name: "Ваша отметка об оплате",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    learner.getByRole("combobox", { name: "Статус занятия", exact: true }),
  ).toHaveCount(0);
  const waiting = learner.waitForEvent("download");
  await learner
    .getByRole("button", { name: "Скачать календарь (.ics)", exact: true })
    .click();
  const file = await waiting;
  const text = await readFile((await file.path())!, "utf8");
  expect(text).not.toContain("payment_status");
  const unfolded = text.replace(/\r\n /g, "");
  const event = unfolded
    .split("BEGIN:VEVENT")
    .find((x) => x.includes("SUMMARY:" + title));
  expect(event).toContain("STATUS:CANCELLED");
  const expectedStart = await learner.evaluate(() =>
    new Date("2026-12-31T18:00")
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(".000", ""),
  );
  expect(event).toContain("DTSTART:" + expectedStart);
  await tutor.reload();
  await tutor.getByRole("button", { name: "Расписание", exact: true }).click();
  await expect(
    card.getByRole("combobox", { name: "Статус занятия", exact: true }),
  ).toHaveText("Отменено");
  await tutor.close();
  await learner.close();
});
test("learner TXT validates type, size, encoding and empty bytes then removes a valid attachment without losing answer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  await page
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await page.getByLabel("Ответ на задание 1").fill("5");
  for (const [name, buffer] of [
    ["bad.exe", Buffer.from("text")],
    ["empty.txt", Buffer.alloc(0)],
    ["big.txt", Buffer.alloc(60001, 65)],
    ["nul.txt", Buffer.from([65, 0, 66])],
    ["encoding.txt", Buffer.from([255, 254, 255])],
  ] as [string, Buffer][]) {
    await page
      .getByLabel("TXT к заданию 1")
      .setInputFiles({ name, mimeType: "text/plain", buffer });
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByText("Файл: " + name, { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("5");
  }
  await page.getByLabel("TXT к заданию 1").setInputFiles({
    name: "valid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Решение 🧪 <script>текст</script>"),
  });
  await page.getByText("Файл: valid.txt", { exact: true }).click();
  await expect(page.locator("pre")).toContainText(
    "Решение 🧪 <script>текст</script>",
  );
  await page.getByRole("button", { name: "Убрать файл", exact: true }).click();
  await expect(page.getByText("Файл: valid.txt", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("5");
  await expect(page.getByRole("status")).toHaveText("Сохранено");
  await page.reload();
  await page
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("5");
  await expect(page.getByText("Файл: valid.txt", { exact: true })).toHaveCount(
    0,
  );
});
