import { test, expect } from "@playwright/test";

test("colleagues share template, create own draft and lose library access after removal", async ({
  browser,
}) => {
  const owner = await browser.newPage(),
    colleague = await browser.newPage();
  const outsiderSession = await (
    await owner.request.post("/api/auth/demo/outsider")
  ).json();
  const invitation = await (
    await owner.request.post("/api/invitations", {
      headers: { Authorization: "Bearer " + outsiderSession.token },
      data: { subject: "Математика коллеги" },
    })
  ).json();
  const learnerSession = await (
    await owner.request.post("/api/auth/demo/learner")
  ).json();
  expect(
    (
      await owner.request.post("/api/invitations/accept", {
        headers: { Authorization: "Bearer " + learnerSession.token },
        data: { token: invitation.token },
      })
    ).ok(),
  ).toBeTruthy();
  await owner.goto("/");
  await owner.getByRole("button", { name: "Я преподаватель" }).click();
  await owner.getByRole("button", { name: "Ученики", exact: true }).click();
  await owner.getByLabel("Название пространства").fill("Методическая команда");
  await owner
    .getByRole("button", { name: "Создать пространство", exact: true })
    .click();
  await owner
    .getByRole("button", { name: "Пригласить коллегу", exact: true })
    .click();
  const code = await owner.getByLabel("Код для коллеги").inputValue();
  await owner
    .getByRole("combobox", { name: "Моя работа для шаблона", exact: true })
    .selectOption("demo-assignment");
  await owner.getByRole("button", { name: "Поделиться с участниками" }).click();
  await colleague.goto("/");
  await colleague
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await colleague.getByRole("button", { name: "Ученики", exact: true }).click();
  await colleague.getByLabel("Код пространства", { exact: true }).fill(code);
  await colleague
    .getByRole("button", { name: "Вступить в пространство" })
    .click();
  await expect(
    colleague.getByRole("button", { name: "Создать мой черновик" }),
  ).toBeVisible();
  await colleague
    .getByRole("combobox", { name: "Мой ученик для копии", exact: true })
    .selectOption({ index: 1 });
  await colleague.getByRole("button", { name: "Создать мой черновик" }).click();
  await expect(
    colleague.getByRole("heading", { name: "Редактирование работы" }),
  ).toBeVisible();
  await expect(
    colleague
      .getByRole("textbox", { name: "Эталонный ответ", exact: true })
      .first(),
  ).toHaveValue("5");
  await colleague.getByRole("button", { name: "Ученики", exact: true }).click();
  await owner.reload();
  await owner.getByRole("button", { name: "Ученики", exact: true }).click();
  await owner
    .getByRole("button", { name: /Исключить Другой репетитор/ })
    .click();
  await colleague.reload();
  await colleague.getByRole("button", { name: "Ученики", exact: true }).click();
  await expect(
    colleague.getByRole("button", { name: "Создать мой черновик" }),
  ).toHaveCount(0);
  await owner.close();
  await colleague.close();
});
