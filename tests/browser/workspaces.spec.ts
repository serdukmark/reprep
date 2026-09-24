import { test, expect, choose } from "./audit-fixtures";

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
  await choose(
    owner.getByRole("combobox", {
      name: "Моя работа для шаблона",
      exact: true,
    }),
    "demo-assignment",
  );
  const foreign = await owner.request.post("/api/assignments", {
    headers: { Authorization: "Bearer " + outsiderSession.token },
    data: {
      relationship_id: "",
      title: "Чужой личный черновик",
      tasks: [
        {
          id: "foreign",
          type: "numeric",
          prompt: "2+3?",
          answer: "5",
          skill: "Сложение",
        },
      ],
    },
  });
  expect(foreign.ok()).toBeTruthy();
  const foreignId = (await foreign.json()).id;
  await owner.route("**/api/workspaces/*/templates", (route) =>
    route.request().method() === "POST"
      ? route.continue({
          postData: JSON.stringify({ assignment_id: foreignId }),
        })
      : route.continue(),
  );
  await owner.getByRole("button", { name: "Поделиться с участниками" }).click();
  await expect(owner.getByRole("alert")).toBeVisible();
  await expect(
    owner.getByText("Чужой личный черновик", { exact: true }),
  ).toHaveCount(0);
  await owner.unroute("**/api/workspaces/*/templates");
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
  await choose(
    colleague.getByRole("combobox", {
      name: "Мой ученик для копии",
      exact: true,
    }),
    { index: 1 },
  );
  await colleague.route("**/api/workspace-templates/*/copy", async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    await route.abort();
  });
  await colleague.getByRole("button", { name: "Создать мой черновик" }).click();
  await expect(colleague.getByRole("alert")).toBeVisible();
  await colleague.unroute("**/api/workspace-templates/*/copy");
  await colleague
    .getByRole("button", { name: "Создать мой черновик" })
    .dblclick();
  const ownWorks = await colleague.request.get("/api/assignments", {
    headers: { Authorization: "Bearer " + outsiderSession.token },
  });
  expect(
    (await ownWorks.json()).filter(
      (item: any) => item.title === "Линейные уравнения: от шага к решению",
    ),
  ).toHaveLength(1);

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
  // The already-open colleague tab must not retain server privileges after removal.
  await choose(
    colleague.getByRole("combobox", {
      name: "Мой ученик для копии",
      exact: true,
    }),
    { index: 1 },
  );
  await colleague
    .getByRole("button", { name: "Создать мой черновик", exact: true })
    .click();
  await expect(colleague.getByRole("alert")).toBeVisible();
  await expect(
    colleague.getByRole("heading", { name: "Редактирование работы" }),
  ).toHaveCount(0);
  await colleague.reload();
  await colleague.getByRole("button", { name: "Ученики", exact: true }).click();
  await expect(
    colleague.getByRole("button", { name: "Создать мой черновик" }),
  ).toHaveCount(0);
  await owner.close();
  await colleague.close();
});
