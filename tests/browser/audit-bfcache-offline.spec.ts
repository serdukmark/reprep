import { test, expect } from "./audit-fixtures";
test.use({
  trace: "off",
  launchOptions: {
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ignoreDefaultArgs: ["--disable-back-forward-cache"],
  },
});

const roles = {
  tutor: {
    button: "Я преподаватель",
    alias: "Алекс • демо",
    heading: "Хороший день, чтобы учить.",
  },
  learner: {
    button: "Я ученик",
    alias: "Саша • демо",
    heading: "Ваш следующий шаг.",
  },
  guardian: {
    button: "Я родитель",
    alias: "Родитель • демо",
    heading: "Кабинет родителя",
  },
  outsider: {
    button: "Другой преподаватель · демо",
    alias: "Другой репетитор • демо",
    heading: "Хороший день, чтобы учить.",
  },
};
for (const [source, target] of [["tutor", "learner"]] as const)
  test(`BFCache offline: hides previous account and recovers after reconnect`, async ({
    page,
    request,
    context,
  }) => {
    let restored = 0,
      oldScreenPainted = false;
    page.on("console", (message) => {
      if (message.text() === "AUDIT_OLD_DOCUMENT_RESTORED") restored++;
      if (message.text() === "AUDIT_OLD_ACCOUNT_VISIBLE")
        oldScreenPainted = true;
    });
    await page.addInitScript((oldAlias) => {
      window.addEventListener("pageshow", (event) => {
        if (!event.persisted || location.pathname !== "/" || location.search)
          return;
        console.info("AUDIT_OLD_DOCUMENT_RESTORED");
        requestAnimationFrame(() => {
          if (
            getComputedStyle(document.documentElement).visibility !==
              "hidden" &&
            document.body.innerText.includes(oldAlias)
          )
            console.info("AUDIT_OLD_ACCOUNT_VISIBLE");
        });
      });
    }, roles[source].alias);
    let code = "";
    if (source === "guardian") {
      const tutor = await request.post("/api/auth/demo/tutor");
      const headers = { Authorization: "Bearer " + (await tutor.json()).token };
      const invitation = await request.post(
        "/api/relationships/demo-link/guardians",
        { headers },
      );
      expect(invitation.ok()).toBe(true);
      code = (await invitation.json()).token;
    }
    await page.goto("/");
    await page
      .getByRole("button", { name: roles[source].button, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: roles[source].heading, exact: true }),
    ).toBeVisible();
    if (source === "guardian") {
      await page.getByLabel("Код приглашения родителю").fill(code);
      await page
        .getByRole("button", { name: "Принять доступ", exact: true })
        .click();
      await page.getByRole("button", { name: /Саша • демо/ }).click();
      await expect(
        page.getByRole("heading", { name: "Расписание ученика", exact: true }),
      ).toBeVisible();
    }
    if (source === "learner") {
      await page
        .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
        .click();
      await expect(page.getByLabel("Ответ на задание 1")).toBeVisible();
    }
    await page.waitForLoadState("networkidle");
    await page.goto("/api/health");
    await page.goto("/?audit-second-document=1");
    if (source !== target) {
      if (source !== "guardian")
        await page
          .getByRole("button", { name: new RegExp(roles[source].alias) })
          .click();
      await page.getByRole("button", { name: "Выйти", exact: true }).click();
      await page
        .getByRole("button", { name: roles[target].button, exact: true })
        .click();
    }
    await expect(
      page.getByRole("heading", { name: roles[target].heading, exact: true }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await context.setOffline(true);
    await page.goBack({ waitUntil: "commit", timeout: 5000 });
    await page.goBack({ waitUntil: "commit", timeout: 5000 });
    await expect.poll(() => restored).toBeGreaterThan(0);
    await expect(page.locator("body")).toContainText(
      "ERR_INTERNET_DISCONNECTED",
    );
    await expect(
      page.getByRole("button", { name: /Алекс • демо/ }),
    ).toHaveCount(0);
    await context.setOffline(false);
    await page.reload();

    test.info().annotations.push({
      type: "bfcache-restored",
      description: String(restored),
    });
    await expect(
      page.getByRole("heading", { name: roles[target].heading, exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("visibility", "visible");
    await expect(
      page.getByRole("button", { name: new RegExp(roles[target].alias) }),
    ).toBeVisible();
    if (source !== target)
      await expect(
        page.getByRole("button", { name: new RegExp(roles[source].alias) }),
      ).toHaveCount(0);
    if (target === "learner") {
      await expect(
        page.getByRole("button", { name: "Ученики", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Кабинет родителя", exact: true }),
      ).toHaveCount(0);
    }
    expect(
      oldScreenPainted,
      "Cached account must stay hidden until fresh authentication",
    ).toBe(false);
    await page.screenshot({
      path: `artifacts/deep-audit/bfcache-offline-confirmed.png`,
    });
  });
