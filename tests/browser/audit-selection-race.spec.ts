import { test, expect } from "./audit-fixtures";
for (const role of ["tutor", "guardian"])
  test(`${role}: delayed previous learner response cannot replace current learner summary`, async ({
    context,
  }) => {
    const page = await context.newPage();
    if (role === "guardian") {
      const tutor = await context.newPage();
      await tutor.goto("/");
      await tutor
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
      await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
      await page.goto("/");
      await page
        .getByRole("button", { name: "Я родитель", exact: true })
        .click();
      for (const name of ["Саша", "Женя"]) {
        await tutor
          .getByRole("button", { name: new RegExp(name + " • демо") })
          .click();
        await tutor
          .getByRole("button", {
            name: "Создать приглашение родителю",
            exact: true,
          })
          .click();
        const code = await tutor
          .getByLabel("Код родителя", { exact: true })
          .inputValue();
        await page.getByLabel("Код приглашения родителю").fill(code);
        await page
          .getByRole("button", { name: "Принять доступ", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: new RegExp(name + " • демо") }),
        ).toBeVisible();
      }
      await tutor.close();
    } else {
      await page.goto("/");
      await page
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
      await page.getByRole("button", { name: "Ученики", exact: true }).click();
      await page.getByRole("button", { name: /Женя • демо/ }).click();
    }
    let release!: () => void, started!: () => void;
    const held = new Promise<void>((r) => (release = r)),
      seen = new Promise<void>((r) => (started = r));
    const path =
      role === "tutor"
        ? "**/api/relationships/*/progress"
        : "**/api/guardian/links/*";
    let oldDelivered!: () => void;
    const delivered = new Promise<void>((r) => (oldDelivered = r));
    await page.route(path, async (route) => {
      const old =
        role === "tutor"
          ? route.request().url().includes("/demo-link/")
          : route.request().url().endsWith("/demo-link");
      const progress = [
        {
          skill: old ? "Навык Саши" : "Навык Жени",
          correct: 1,
          total: 1,
          latest: "correct",
          evidence: [],
        },
      ];
      if (old) {
        started();
        await held;
      }
      await route.fulfill({
        json:
          role === "tutor"
            ? progress
            : {
                progress,
                lessons: [],
                note: "Синтетический ответ для проверки порядка сети",
              },
      });
      if (old) oldDelivered();
    });
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    await seen;
    await page.getByRole("button", { name: /Женя • демо/ }).click();
    await expect(page.getByText("Навык Жени", { exact: true })).toBeVisible();
    await page.evaluate(() => {
      (window as any).staleSummarySeen = false;
      new MutationObserver(() => {
        if (document.body.textContent?.includes("Навык Саши"))
          (window as any).staleSummarySeen = true;
      }).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
    const oldResponse = page.waitForResponse((r) =>
      role === "tutor"
        ? r.url().includes("/demo-link/progress")
        : r.url().endsWith("/guardian/links/demo-link"),
    );
    release();
    await delivered;
    await (await oldResponse).finished();
    // Wait for the held response to be processed and the UI to paint; no arbitrary sleep.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(await page.evaluate(() => (window as any).staleSummarySeen)).toBe(
      false,
    );
    expect(await page.getByText("Навык Саши", { exact: true }).count()).toBe(0);
    await expect(page.getByText("Навык Жени", { exact: true })).toBeVisible();
    await page.close();
  });
