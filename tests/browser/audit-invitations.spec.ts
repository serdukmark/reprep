import { test, expect } from "./audit-fixtures";
for (const expiry of [false, true])
  for (const kind of ["learner", "guardian", "colleague"]) {
    test(`${kind}: ${expiry ? "expired" : "revoked"} invitation cannot be accepted, including after refresh`, async ({
      browser,
      request,
    }) => {
      const owner = await browser.newPage(),
        guest = await browser.newPage();
      await owner.goto("/");
      await owner
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
      await owner.getByRole("button", { name: "Ученики", exact: true }).click();
      let code = "",
        label = "",
        action = "";
      if (kind === "learner") {
        await owner
          .getByRole("button", { name: "Пригласить ученика", exact: true })
          .click();
        code = await owner.locator(".invite-box code").innerText();
        if (!expiry) {
          await owner
            .getByRole("button", { name: "Отозвать", exact: true })
            .last()
            .click();
          await expect(owner.getByText(/· Отозвано/).last()).toBeVisible();
        }
        label = "Код приглашения";
        action = "Посмотреть приглашение";
      } else if (kind === "guardian") {
        await owner.getByRole("button", { name: /Саша • демо/ }).click();
        await owner
          .getByRole("button", {
            name: "Создать приглашение родителю",
            exact: true,
          })
          .click();
        code = await owner
          .getByLabel("Код родителя", { exact: true })
          .inputValue();
        if (!expiry) {
          await owner
            .getByRole("button", {
              name: "Отозвать доступ родителя",
              exact: true,
            })
            .click();
          await expect(
            owner.getByRole("button", {
              name: "Отозвать доступ родителя",
              exact: true,
            }),
          ).toHaveCount(0);
        }
        label = "Код приглашения родителю";
        action = "Принять доступ";
      } else {
        await owner
          .getByLabel("Название пространства")
          .fill("Проверка приглашений");
        await owner
          .getByRole("button", { name: "Создать пространство", exact: true })
          .click();
        await owner
          .getByRole("button", { name: "Пригласить коллегу", exact: true })
          .click();
        code = await owner.getByLabel("Код для коллеги").inputValue();
        if (!expiry) {
          await owner
            .getByRole("button", {
              name: "Отозвать приглашение коллеги",
              exact: true,
            })
            .click();
          await expect(owner.getByLabel("Код для коллеги")).toHaveCount(0);
        }
        label = "Код пространства";
        action = "Вступить в пространство";
      }
      if (expiry)
        expect(
          (await request.post("/__audit__/expire-invitations")).ok(),
        ).toBeTruthy();
      await guest.goto("/");
      await guest
        .getByRole("button", {
          name:
            kind === "learner"
              ? "Я ученик"
              : kind === "guardian"
                ? "Я родитель"
                : "Другой преподаватель · демо",
          exact: true,
        })
        .click();
      async function screen() {
        if (kind === "learner")
          await guest.getByRole("button", { name: /Саша • демо/ }).click();
        if (kind === "colleague")
          await guest
            .getByRole("button", { name: "Ученики", exact: true })
            .click();
      }
      await screen();
      const field = guest.getByLabel(label, { exact: true });
      await field.fill("Я".repeat(1000));
      if (kind !== "learner")
        expect((await field.inputValue()).length).toBeLessThanOrEqual(200);
      await guest.getByRole("button", { name: action, exact: true }).click();
      await expect(guest.getByRole("alert").first()).toBeVisible();
      await field.fill(code);
      await guest.getByRole("button", { name: action, exact: true }).click();
      await expect(guest.getByRole("alert").first()).toBeVisible();
      await guest.reload();
      await screen();
      await guest.getByLabel(label, { exact: true }).fill(code);
      await guest.getByRole("button", { name: action, exact: true }).click();
      await expect(guest.getByRole("alert").first()).toBeVisible();
      if (kind === "guardian")
        await expect(guest.getByText(/Открытых доступов нет/)).toBeVisible();
      if (kind === "colleague")
        await expect(
          guest.getByRole("combobox", { name: "Текущее пространство" }),
        ).toHaveCount(0);
      await owner.close();
      await guest.close();
    });
  }
