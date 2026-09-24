import { test, expect } from "./audit-fixtures";
for (const kind of ["learner", "guardian", "colleague"])
  test(`${kind}: accepted invitation cannot create a duplicate relationship`, async ({
    browser,
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
      button = "";
    if (kind === "learner") {
      await owner
        .getByRole("button", { name: "Пригласить ученика", exact: true })
        .click();
      code = await owner.locator(".invite-box code").innerText();
      label = "Код приглашения";
      button = "Посмотреть приглашение";
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
      label = "Код приглашения родителю";
      button = "Принять доступ";
    } else {
      await owner
        .getByLabel("Название пространства")
        .fill("Повтор приглашения");
      await owner
        .getByRole("button", { name: "Создать пространство", exact: true })
        .click();
      await owner
        .getByRole("button", { name: "Пригласить коллегу", exact: true })
        .click();
      code = await owner.getByLabel("Код для коллеги").inputValue();
      label = "Код пространства";
      button = "Вступить в пространство";
    }
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
    if (kind === "learner")
      await guest.getByRole("button", { name: /Саша • демо/ }).click();
    if (kind === "colleague")
      await guest.getByRole("button", { name: "Ученики", exact: true }).click();
    await guest.getByLabel(label, { exact: true }).fill(code);
    await guest.getByRole("button", { name: button, exact: true }).click();
    if (kind === "learner") {
      await guest
        .getByRole("button", { name: "Принять приглашение", exact: true })
        .click();
      await expect(
        guest.getByText("Вы подключились к преподавателю", { exact: true }),
      ).toBeVisible();
    } else if (kind === "guardian") {
      await expect(
        guest.getByRole("button", { name: /Саша • демо/ }),
      ).toHaveCount(1);
      const other = await browser.newPage();
      await other.route("**/api/auth/demo/guardian", (r) =>
        r.continue({
          url: new URL("/__audit__/identity/guardian", r.request().url()).href,
        }),
      );
      await other.goto("/");
      await other
        .getByRole("button", { name: "Я родитель", exact: true })
        .click();
      await other.getByLabel(label, { exact: true }).fill(code);
      await other.getByRole("button", { name: button, exact: true }).click();
      await expect(other.getByRole("alert")).toBeVisible();
      await expect(
        other.getByRole("button", { name: /Саша • демо/ }),
      ).toHaveCount(0);
      await other.close();
    } else
      await expect(
        guest.getByRole("combobox", {
          name: "Текущее пространство",
          exact: true,
        }),
      ).toHaveText("Повтор приглашения");
    await guest.getByLabel(label, { exact: true }).fill(code);
    await guest.getByRole("button", { name: button, exact: true }).click();
    if (kind === "learner") {
      await expect(guest.getByRole("alert")).toBeVisible();
      const other = await browser.newPage();
      await other.route("**/api/auth/demo/learner", (r) =>
        r.continue({ url: r.request().url() + "-2" }),
      );
      await other.goto("/");
      await other
        .getByRole("button", { name: "Я ученик", exact: true })
        .click();
      await other.getByRole("button", { name: /Женя • демо/ }).click();
      await other.getByLabel(label, { exact: true }).fill(code);
      await other.getByRole("button", { name: button, exact: true }).click();
      await expect(other.getByRole("alert")).toBeVisible();
      await expect(
        other.getByRole("button", { name: "Принять приглашение", exact: true }),
      ).toHaveCount(0);
      await other.close();
    } else if (kind === "guardian")
      await expect(
        guest.getByRole("button", { name: /Саша • демо/ }),
      ).toHaveCount(1);
    else {
      await expect(guest.getByRole("alert")).toHaveCount(0);
      await guest
        .getByRole("combobox", { name: "Текущее пространство", exact: true })
        .click();
      await expect(
        guest.getByRole("option", { name: "Повтор приглашения", exact: true }),
      ).toHaveCount(1);
      await owner.getByLabel(label, { exact: true }).fill(code);
      await owner.getByRole("button", { name: button, exact: true }).click();
      await expect(owner.getByRole("alert")).toBeVisible();
    }
    await owner.close();
    await guest.close();
  });
