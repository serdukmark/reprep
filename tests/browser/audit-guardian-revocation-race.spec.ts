import { test, expect } from "./audit-fixtures";

test("revoked guardian cannot recover a child's summary from an older successful response", async ({
  context,
}) => {
  const tutor = await context.newPage(),
    parent = await context.newPage();
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor.getByRole("button", { name: /Саша • демо/ }).click();
  await tutor
    .getByRole("button", { name: "Создать приглашение родителю", exact: true })
    .click();
  const code = await tutor
    .getByLabel("Код родителя", { exact: true })
    .inputValue();
  await parent.goto("/");
  await parent.getByRole("button", { name: "Я родитель", exact: true }).click();
  await parent.getByLabel("Код приглашения родителю").fill(code);
  await parent
    .getByRole("button", { name: "Принять доступ", exact: true })
    .click();
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve)),
    seen = new Promise<void>((resolve) => (started = resolve));
  let first = true;
  await parent.route("**/api/guardian/links/demo-link", async (r) => {
    if (!first) return r.continue();
    first = false;
    const response = await r.fetch();
    expect(response.status()).toBe(200);
    expect(
      (await response.json()).lessons.some(
        (x: { title: string }) => x.title === "Разбираем уравнения",
      ),
    ).toBe(true);
    started();
    await gate;
    await r.fulfill({ response });
  });
  await parent.getByRole("button", { name: /Саша • демо/ }).click();
  await seen;
  await tutor
    .getByRole("button", { name: "Отозвать доступ родителя", exact: true })
    .click();
  try {
    await expect(parent.getByText(/Открытых доступов нет/)).toBeVisible({
      timeout: 12000,
    });
    await parent.evaluate(() => {
      (window as any).__revokedLeak = false;
      new MutationObserver(() => {
        if (document.body.innerText.includes("Разбираем уравнения"))
          (window as any).__revokedLeak = true;
      }).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
    const arrived = parent.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/guardian/links/demo-link" &&
        r.status() === 200,
    );
    release();
    await (await arrived).finished();
    await parent.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(await parent.evaluate(() => (window as any).__revokedLeak)).toBe(
      false,
    );
    await expect(
      parent.getByText("Разбираем уравнения", { exact: true }),
    ).toHaveCount(0);
    await expect(
      parent.getByRole("heading", {
        name: "Подтверждённый прогресс",
        exact: true,
      }),
    ).toHaveCount(0);
    await parent.reload();
    await expect(parent.getByText(/Открытых доступов нет/)).toBeVisible();
    await expect(
      parent.getByRole("button", { name: /Саша • демо/ }),
    ).toHaveCount(0);
  } finally {
    release();
  }
});
