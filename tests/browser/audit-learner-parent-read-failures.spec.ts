import { test, expect } from "./audit-fixtures";
const cases = [
  [
    "progress",
    "/api/relationships/demo-link/progress",
    "Мой прогресс",
    "Карта навыков",
  ],
  [
    "plan",
    "/api/relationships/demo-link/plan",
    "Мой прогресс",
    "Индивидуальная программа",
  ],
  [
    "skills",
    "/api/relationships/demo-link/skill-graph",
    "Мой прогресс",
    "Граф навыков",
  ],
  ["catalog", "/api/catalog", "Репетиторы", "Каталог репетиторов"],
  [
    "notifications",
    "/api/notifications",
    "settings",
    "Напоминания в мессенджере",
  ],
] as const;
for (const mode of ["network", "session"])
  for (const [kind, path, tab, heading] of cases)
    test(`learner ${kind} ${mode}: visible read failure and recovery after login/reload`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Я ученик", exact: true }).click();
      await expect(
        page.getByRole("button", {
          name: /Линейные уравнения: от шага к решению/,
        }),
      ).toBeVisible();
      const open = () =>
        page
          .getByRole("button", {
            name: tab === "settings" ? /Саша • демо/ : tab,
            exact: tab !== "settings",
          })
          .click();
      let blocked = 0;
      const target =
        kind === "catalog" && mode === "session"
          ? "/api/catalog/requests"
          : path;
      const match = (u: URL) => u.pathname === target;
      if (mode === "network")
        await page.route(match, async (r) => {
          blocked++;
          await r.abort("connectionreset");
        });
      else {
        expect(
          await page.evaluate(
            async () =>
              (
                await fetch("/api/logout", {
                  method: "POST",
                  headers: {
                    Authorization:
                      "Bearer " + sessionStorage.getItem("reprep.session"),
                  },
                })
              ).status,
          ),
        ).toBe(200);
        page.on("response", (r) => {
          if (new URL(r.url()).pathname === target && r.status() === 401)
            blocked++;
        });
      }
      await open();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expect.poll(() => blocked).toBeGreaterThan(0);
      await page.unroute(match);
      await page.reload();
      if (mode === "session")
        await page
          .getByRole("button", { name: "Я ученик", exact: true })
          .click();
      const loaded = page.waitForResponse(
        (r) => new URL(r.url()).pathname === path && r.status() === 200,
      );
      await open();
      await (await loaded).finished();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    });
for (const failure of ["links-network", "summary-network", "expired-session"])
  test(`parent ${failure}: polling failure clears the displayed summary and login/reload recovers`, async ({
    page,
    request,
  }) => {
    const owner = await request.post("/api/auth/demo/tutor"),
      headers = { Authorization: "Bearer " + (await owner.json()).token };
    const invite = await request.post(
      "/api/relationships/demo-link/guardians",
      { headers },
    );
    expect(invite.ok()).toBe(true);
    await page.goto("/");
    await page.getByRole("button", { name: "Я родитель", exact: true }).click();
    await page
      .getByLabel("Код приглашения родителю")
      .fill((await invite.json()).token);
    await page
      .getByRole("button", { name: "Принять доступ", exact: true })
      .click();
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    await expect(
      page.getByText("Разбираем уравнения", { exact: true }),
    ).toBeVisible();
    const path =
      failure === "summary-network"
        ? "/api/guardian/links/demo-link"
        : "/api/guardian/links";
    const match = (u: URL) => u.pathname === path;
    let blocked = 0;
    if (failure === "expired-session") {
      expect(
        await page.evaluate(
          async () =>
            (
              await fetch("/api/logout", {
                method: "POST",
                headers: {
                  Authorization:
                    "Bearer " + sessionStorage.getItem("reprep.session"),
                },
              })
            ).status,
        ),
      ).toBe(200);
      page.on("response", (r) => {
        if (new URL(r.url()).pathname === path && r.status() === 401) blocked++;
      });
    } else
      await page.route(match, async (r) => {
        blocked++;
        await r.abort("connectionreset");
      });
    await expect(page.getByRole("alert").first()).toBeVisible({
      timeout: 15000,
    });
    await expect.poll(() => blocked).toBeGreaterThan(0);
    await expect(
      page.getByText("Разбираем уравнения", { exact: true }),
    ).toHaveCount(0);
    await page.unroute(match);
    await page.reload();
    if (failure === "expired-session")
      await page
        .getByRole("button", { name: "Я родитель", exact: true })
        .click();
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    await expect(
      page.getByText("Разбираем уравнения", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
