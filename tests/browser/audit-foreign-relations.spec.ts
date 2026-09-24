import { test, expect, choose } from "./audit-fixtures";
test("teacher cannot assign a work or group to a real relationship owned by a colleague", async ({
  page,
  request,
}) => {
  const other = await request.post("/api/auth/demo/outsider"),
    student = await request.post("/api/auth/demo/learner");
  const oh = { Authorization: "Bearer " + (await other.json()).token },
    lh = { Authorization: "Bearer " + (await student.json()).token };
  const inv = await request.post("/api/invitations", {
    headers: oh,
    data: { subject: "Чужая связь" },
  });
  expect(
    (
      await request.post("/api/invitations/accept", {
        headers: lh,
        data: { token: (await inv.json()).token },
      })
    ).ok(),
  ).toBeTruthy();
  const links = await request.get("/api/relationships", { headers: oh });
  const rid = (await links.json())[0].id;
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await page.getByLabel("Название работы").fill("Проверка чужой связи");
  await choose(
    page.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  await page.getByLabel("Условие", { exact: true }).fill("2+3?");
  await page.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await page.getByLabel("Навык", { exact: true }).fill("Сложение");
  await page.route("**/api/assignments", (r) =>
    r.request().method() === "POST"
      ? r.continue({
          postData: JSON.stringify({
            ...r.request().postDataJSON(),
            relationship_id: rid,
          }),
        })
      : r.continue(),
  );
  await page
    .getByRole("button", { name: "Назначить ученику", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Название работы")).toHaveValue(
    "Проверка чужой связи",
  );
  await page.unroute("**/api/assignments");
  await page
    .getByRole("button", { name: "Назначить ученику", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Проверка чужой связи", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByLabel("Название группы").fill("Проверка состава");
  await page.getByRole("checkbox", { name: /Саша • демо/ }).check();
  await page.route("**/api/groups", (r) =>
    r.request().method() === "POST"
      ? r.continue({
          postData: JSON.stringify({
            ...r.request().postDataJSON(),
            relationship_ids: [rid],
          }),
        })
      : r.continue(),
  );
  await page
    .getByRole("button", { name: "Сохранить группу", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Проверка состава", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/groups");
  await page
    .getByRole("button", { name: "Сохранить группу", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Проверка состава", exact: true }),
  ).toBeVisible();
});
