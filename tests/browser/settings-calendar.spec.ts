import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("profile, invitation consent, disabled MAX delivery and calendar download", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await tutor
    .getByRole("button", { name: /Алекс • демо|Преподаватель пример/ })
    .click();
  await tutor.getByLabel("Отображаемое имя").fill("Преподаватель пример");
  await tutor
    .getByRole("button", { name: "Сохранить имя", exact: true })
    .click();
  await expect(tutor.getByText("Имя сохранено", { exact: true })).toBeVisible();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor
    .getByRole("button", { name: "Пригласить ученика", exact: true })
    .click();
  const first = await tutor.locator(".invite-box code").innerText();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner.getByRole("button", { name: /Саша • демо/ }).click();
  await expect(learner.getByLabel("О ближайших занятиях")).toBeDisabled();
  await expect(
    learner.getByText(
      "Отправка в MAX сейчас выключена. Напоминания на главном экране доступны.",
    ),
  ).toBeVisible();
  await learner.getByLabel("Код приглашения").fill(first);
  await learner
    .getByRole("button", { name: "Посмотреть приглашение", exact: true })
    .click();
  await expect(
    learner.getByText(/Преподаватель: Преподаватель пример/),
  ).toBeVisible();
  await learner
    .getByRole("button", { name: "Отклонить приглашение", exact: true })
    .click();
  await expect(
    learner.getByText("Приглашение отклонено", { exact: true }),
  ).toBeVisible();
  await tutor
    .getByRole("button", { name: "Пригласить ученика", exact: true })
    .click();
  await expect(tutor.locator(".invite-box code")).not.toHaveText(first);
  const second = await tutor.locator(".invite-box code").innerText();
  await learner.getByLabel("Код приглашения").fill(second);
  await learner
    .getByRole("button", { name: "Посмотреть приглашение", exact: true })
    .click();
  await learner
    .getByRole("button", { name: "Принять приглашение", exact: true })
    .click();
  await expect(
    learner.getByText("Вы подключились к преподавателю", { exact: true }),
  ).toBeVisible();
  await learner
    .getByRole("button", { name: "Расписание", exact: true })
    .click();
  const download = learner.waitForEvent("download");
  await learner
    .getByRole("button", { name: "Скачать календарь (.ics)", exact: true })
    .click();
  const calendar = await readFile((await (await download).path())!, "utf8");
  expect(calendar).toContain("BEGIN:VCALENDAR");
  expect(calendar).toContain("BEGIN:VEVENT");
  expect(calendar).not.toContain("payment_status");
  await tutor.getByRole("button", { name: /Преподаватель пример/ }).click();
  await tutor.getByLabel("Отображаемое имя").fill("Алекс • демо");
  await tutor
    .getByRole("button", { name: "Сохранить имя", exact: true })
    .click();
  await expect(tutor.getByText("Имя сохранено", { exact: true })).toBeVisible();
  await tutor.close();
  await learner.close();
});
