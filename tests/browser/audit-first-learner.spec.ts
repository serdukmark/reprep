import { test, expect } from "./audit-fixtures";
test("new learner starts empty, can decline and then accept a fresh invitation", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await learner.route("**/api/auth/demo/learner", (r) =>
    r.continue({
      url: new URL("/__audit__/identity/learner", r.request().url()).href,
    }),
  );
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner.getByRole("button", { name: "Задания", exact: true }).click();
  await expect(learner.locator(".assignment-row")).toHaveCount(0);
  await learner.getByRole("button", { name: /Новый ученик • аудит/ }).click();
  let previousCode = "";
  for (const decision of ["Отклонить приглашение", "Принять приглашение"]) {
    await tutor
      .getByRole("button", { name: "Пригласить ученика", exact: true })
      .click();
    await expect(tutor.locator(".invite-box code")).not.toHaveText(
      previousCode,
    );
    const code = await tutor.locator(".invite-box code").innerText();
    previousCode = code;
    await learner.getByLabel("Код приглашения", { exact: true }).fill(code);
    await learner
      .getByRole("button", { name: "Посмотреть приглашение", exact: true })
      .click();
    await expect(learner.getByText(/Преподаватель: Алекс/)).toBeVisible();
    await learner.getByRole("button", { name: decision, exact: true }).click();
    await expect(
      learner.getByText(
        decision === "Отклонить приглашение"
          ? "Приглашение отклонено"
          : "Вы подключились к преподавателю",
        { exact: true },
      ),
    ).toBeVisible();
  }
  await tutor.reload();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await expect(
    tutor.getByRole("button", { name: /Новый ученик • аудит/ }),
  ).toHaveCount(1);
  await learner.reload();
  await learner.getByRole("button", { name: "Задания", exact: true }).click();
  await expect(learner.locator(".assignment-row")).toHaveCount(0);
  await tutor.close();
  await learner.close();
});
