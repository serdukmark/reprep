import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("tutor uploads TXT, learner downloads the original, tutor changes lesson status", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor.getByRole("button", { name: "Материалы", exact: true }).click();
  await tutor.getByRole("button", { name: "Добавить материал" }).click();
  await tutor.getByLabel("Название", { exact: true }).fill("Конспект TXT");
  await tutor
    .getByRole("combobox", { name: "Ученик", exact: true })
    .selectOption("demo-link");
  const text =
    "Чтобы сохранить равенство, выполните одинаковую операцию с обеими частями.";
  await tutor.getByLabel("Или файл TXT").setInputFiles({
    name: "summary.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  await tutor
    .getByRole("combobox", { name: "Задание", exact: true })
    .selectOption("demo-assignment");
  await tutor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    tutor.getByRole("button", { name: "Скачать summary.txt" }),
  ).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner.getByRole("button", { name: "Материалы", exact: true }).click();
  const downloading = learner.waitForEvent("download");
  await learner.getByRole("button", { name: "Скачать summary.txt" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("summary.txt");
  expect(await readFile((await download.path())!, "utf8")).toBe(text);
  await tutor.getByRole("button", { name: "Расписание", exact: true }).click();
  await tutor
    .getByRole("combobox", { name: "Статус занятия" })
    .first()
    .selectOption("completed");
  await expect(
    tutor.getByRole("combobox", { name: "Статус занятия" }).first(),
  ).toHaveValue("completed");
  await learner
    .getByRole("button", { name: "Расписание", exact: true })
    .click();
  await learner.reload();
  await learner
    .getByRole("button", { name: "Расписание", exact: true })
    .click();
  await expect(learner.getByText("Проведено", { exact: true })).toBeVisible();
  await expect(learner.getByText("Ваша отметка об оплате")).toHaveCount(0);
  await tutor.close();
  await learner.close();
});
