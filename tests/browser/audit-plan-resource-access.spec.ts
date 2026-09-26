import { test, expect, choose } from "./audit-fixtures";
import type { Page } from "@playwright/test";

async function login(page: Page, role: string) {
  await page.goto("/");
  await page.getByRole("button", { name: role, exact: true }).click();
}
async function openPlan(page: Page, pupil: RegExp) {
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: pupil }).click();
  await expect(page.getByLabel("Цель программы")).toBeVisible();
}
async function savePlan(page: Page) {
  await page
    .getByRole("button", { name: "Сохранить программу", exact: true })
    .click();
  await expect(
    page.getByText("Программа сохранена", { exact: true }),
  ).toBeVisible();
}

for (const owner of ["other tutor", "same tutor"])
  for (const field of ["assignment_id", "material_id"] as const)
    test(`plan nested ${field}: rejects another pupil of ${owner}, preserves plans and recovers`, async ({
      browser,
      page,
    }) => {
      // The foreign pupil relationship and new resources are created through UI.
      // The own demo-link/work come from reset; identity and malicious ID are intercepted.
      const foreign = await browser.newPage(),
        child = await browser.newPage(),
        inspector = await browser.newPage();
      try {
        await login(
          foreign,
          owner === "other tutor"
            ? "Другой преподаватель · демо"
            : "Я преподаватель",
        );
        await foreign
          .getByRole("button", { name: "Ученики", exact: true })
          .click();
        await foreign
          .getByRole("button", { name: "Пригласить ученика", exact: true })
          .click();
        const code = await foreign.locator(".invite-box code").innerText();
        await child.route("**/api/auth/demo/learner", (r) =>
          r.continue({
            url: new URL("/__audit__/identity/learner", r.request().url()).href,
          }),
        );
        await login(child, "Я ученик");
        await child
          .getByRole("button", { name: /Новый ученик • аудит/ })
          .click();
        await child.getByLabel("Код приглашения", { exact: true }).fill(code);
        await child
          .getByRole("button", { name: "Посмотреть приглашение", exact: true })
          .click();
        await child
          .getByRole("button", { name: "Принять приглашение", exact: true })
          .click();
        await expect(
          child.getByText("Вы подключились к преподавателю", { exact: true }),
        ).toBeVisible();
        await foreign.reload();
        const marker = `Приватный ресурс ${field} 🧪`;
        let resourceId: string;
        if (field === "assignment_id") {
          await foreign
            .getByRole("button", { name: "Создать задание", exact: true })
            .click();
          await foreign.getByLabel("Название работы").fill(marker);
          const pupilSelect = foreign.getByRole("combobox", {
            name: "Ученик",
            exact: true,
          });
          await pupilSelect.click();
          await foreign
            .getByRole("option", { name: /Новый ученик • аудит/ })
            .click();
          await foreign
            .getByLabel("Условие", { exact: true })
            .fill("Сколько будет 2+2?");
          await foreign
            .getByLabel("Эталонный ответ", { exact: true })
            .fill("4");
          await foreign.getByLabel("Навык", { exact: true }).fill("Счёт");
          const created = foreign.waitForResponse(
            (r) =>
              r.url().endsWith("/api/assignments") &&
              r.request().method() === "POST",
          );
          await foreign
            .getByRole("button", { name: "Назначить ученику", exact: true })
            .click();
          const response = await created;
          expect(response.ok()).toBe(true);
          resourceId = (await response.json()).id;
          await expect(
            foreign.getByRole("heading", { name: marker, exact: true }),
          ).toBeVisible();
        } else {
          await foreign
            .getByRole("button", { name: "Материалы", exact: true })
            .click();
          await foreign
            .getByRole("button", { name: "Добавить материал", exact: true })
            .click();
          await foreign.getByLabel("Название", { exact: true }).fill(marker);
          await foreign
            .getByRole("combobox", { name: "Ученик", exact: true })
            .click();
          await foreign
            .getByRole("option", { name: /Новый ученик • аудит/ })
            .click();
          await foreign
            .getByLabel("Ссылка HTTPS")
            .fill("https://example.invalid/private-plan");
          const created = foreign.waitForResponse(
            (r) =>
              r.url().endsWith("/api/materials") &&
              r.request().method() === "POST",
          );
          await foreign
            .getByRole("button", { name: "Сохранить", exact: true })
            .click();
          const response = await created;
          expect(response.ok()).toBe(true);
          resourceId = (await response.json()).id;
          await expect(
            foreign.getByRole("heading", { name: marker, exact: true }),
          ).toBeVisible();
        }
        await openPlan(foreign, /Новый ученик • аудит/);
        await foreign
          .getByLabel("Цель программы")
          .fill("Чужая программа остаётся прежней 🧪");
        await foreign
          .getByRole("button", { name: "Добавить этап", exact: true })
          .click();
        await foreign
          .getByLabel("Этап 1", { exact: true })
          .fill("Приватный этап");
        await foreign.getByLabel("Навык этапа 1", { exact: true }).fill("Счёт");
        const selector =
          field === "assignment_id" ? "Работа этапа 1" : "Материал этапа 1";
        await choose(
          foreign.getByRole("combobox", { name: selector, exact: true }),
          resourceId,
        );
        await savePlan(foreign); // Positive control: this real resource is valid for its owner.

        await login(page, "Я преподаватель");
        if (field === "material_id") {
          await page
            .getByRole("button", { name: "Материалы", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Добавить материал", exact: true })
            .click();
          await page
            .getByLabel("Название", { exact: true })
            .fill("Свой материал 🧪");
          await choose(
            page.getByRole("combobox", { name: "Ученик", exact: true }),
            "demo-link",
          );
          await page
            .getByLabel("Ссылка HTTPS")
            .fill("https://example.invalid/own-plan");
          await page
            .getByRole("button", { name: "Сохранить", exact: true })
            .click();
          await expect(
            page.getByRole("heading", {
              name: "Свой материал 🧪",
              exact: true,
            }),
          ).toBeVisible();
        }
        await openPlan(page, /Саша • демо/);
        await page
          .getByLabel("Цель программы")
          .fill("Своя сохранённая программа");
        await page
          .getByRole("button", { name: "Добавить этап", exact: true })
          .click();
        await page.getByLabel("Этап 1", { exact: true }).fill("Свой этап");
        await page
          .getByLabel("Навык этапа 1", { exact: true })
          .fill("Сложение");
        await choose(
          page.getByRole("combobox", { name: selector, exact: true }),
          { index: 1 },
        );
        const ownSelection = await page
          .getByRole("combobox", { name: selector, exact: true })
          .innerText();
        await savePlan(page);
        await page
          .getByLabel("Цель программы")
          .fill("Правка сохраняется после отказа 🧪");
        let denied = 0;
        await page.route(
          "**/api/relationships/demo-link/plan",
          async (route) => {
            if (route.request().method() !== "PUT") return route.continue();
            const body = route.request().postDataJSON();
            const response = await route.fetch({
              postData: {
                ...body,
                steps: body.steps.map((s: object) => ({
                  ...s,
                  [field]: resourceId,
                })),
              },
            });
            expect(response.status()).toBe(404);
            denied++;
            await route.fulfill({ response });
          },
        );
        await page
          .getByRole("button", { name: "Сохранить программу", exact: true })
          .click();
        await expect(
          page
            .getByRole("alert")
            .filter({
              hasText: "Материал или задание недоступны этому ученику",
            }),
        ).toBeVisible();
        expect(denied).toBe(1);
        await expect(page.getByLabel("Цель программы")).toHaveValue(
          "Правка сохраняется после отказа 🧪",
        );
        await expect(
          page.getByText("Программа сохранена", { exact: true }),
        ).toHaveCount(0);
        await login(inspector, "Я преподаватель");
        await openPlan(inspector, /Саша • демо/);
        await expect(inspector.getByLabel("Цель программы")).toHaveValue(
          "Своя сохранённая программа",
        );
        await expect(
          inspector.getByRole("combobox", { name: selector, exact: true }),
        ).not.toContainText(marker);
        await expect(
          inspector.getByRole("combobox", { name: selector, exact: true }),
        ).toHaveText(ownSelection);
        await foreign.reload();
        await openPlan(foreign, /Новый ученик • аудит/);
        await expect(foreign.getByLabel("Цель программы")).toHaveValue(
          "Чужая программа остаётся прежней 🧪",
        );
        await expect(
          foreign.getByRole("combobox", { name: selector, exact: true }),
        ).toContainText(marker);
        await page.unroute("**/api/relationships/demo-link/plan");
        await savePlan(page);
        await page.reload();
        await openPlan(page, /Саша • демо/);
        await expect(page.getByLabel("Цель программы")).toHaveValue(
          "Правка сохраняется после отказа 🧪",
        );
        await expect(page.getByLabel("Этап 1", { exact: true })).toHaveValue(
          "Свой этап",
        );
        await expect(
          page.getByRole("combobox", { name: selector, exact: true }),
        ).toHaveText(ownSelection);
      } finally {
        await foreign.close();
        await child.close();
        await inspector.close();
      }
    });
