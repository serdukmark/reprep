import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";

async function login(page: Page, button: string) {
  await page.goto("/");
  await page.getByRole("button", { name: button, exact: true }).click();
}

async function openCatalog(page: Page) {
  const loaded = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/catalog/profile" &&
      r.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Репетиторы", exact: true }).click();
  const response = await loaded;
  expect(response.status()).toBe(200);
  await expect(page.getByLabel("Заголовок анкеты")).toBeVisible();
  return response.json();
}

async function reloadCatalog(page: Page) {
  await page.reload();
  return openCatalog(page);
}

async function fillCatalog(page: Page, title: string, price: string) {
  await page.getByLabel("Заголовок анкеты").fill(title);
  await page
    .getByRole("textbox", { name: "О занятиях", exact: true })
    .fill(`Синтетическое описание ${title}`);
  await page
    .getByLabel("Предметы анкеты (каждый с новой строки)")
    .fill("Математика");
  await page.getByLabel("Стоимость занятия, руб.", { exact: true }).fill(price);
  await page
    .getByLabel("Длительность занятия, минут", { exact: true })
    .fill("60");
  await page.getByLabel("Показывать мою анкету в каталоге").uncheck();
}

async function saveCatalog(page: Page) {
  await page
    .getByRole("button", { name: "Сохранить анкету", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Анкета сохранена");
}

for (const [role, button, foreignButton, foreignId] of [
  ["tutor", "Я преподаватель", "Другой преподаватель · демо", "demo-outsider"],
  ["outsider", "Другой преподаватель · демо", "Я преподаватель", "demo-tutor"],
] as const)
  test(`catalog profile ${role}: body identity fields are rejected and query identity cannot read or update another profile`, async ({
    page,
    browser,
  }) => {
    const foreign = await browser.newPage(),
      observer = await browser.newPage();
    const ownTitle = `Своя исходная анкета ${role} 🧪`;
    const foreignTitle = `Чужая исходная анкета ${role} 🧪`;
    const updatedTitle = `Моя сохранённая правка ${role} <>& 🧪`;
    try {
      await login(foreign, foreignButton);
      await openCatalog(foreign);
      await fillCatalog(foreign, foreignTitle, "202");
      await saveCatalog(foreign);
      const foreignBefore = await reloadCatalog(foreign);
      await login(page, button);
      await openCatalog(page);
      await fillCatalog(page, ownTitle, "101");
      await saveCatalog(page);
      const ownBefore = await reloadCatalog(page);
      await fillCatalog(page, updatedTitle, "303");
      let rejected = 0;
      await page.route("**/api/catalog/profile", async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        const response = await route.fetch({
          postData: {
            ...route.request().postDataJSON(),
            id: foreignId,
            user_id: foreignId,
            tutor_id: foreignId,
            role: "learner",
          },
        });
        expect(response.status()).toBe(422);
        rejected++;
        await route.fulfill({ response });
      });
      await page
        .getByRole("button", { name: "Сохранить анкету", exact: true })
        .click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      expect(rejected).toBe(1);
      await expect(page.getByLabel("Заголовок анкеты")).toHaveValue(
        updatedTitle,
      );
      await expect(
        page.getByLabel("Стоимость занятия, руб.", { exact: true }),
      ).toHaveValue("303");
      await expect(page.getByRole("status")).toHaveCount(0);
      await login(observer, button);
      expect(await openCatalog(observer)).toEqual(ownBefore);
      await expect(observer.getByLabel("Заголовок анкеты")).toHaveValue(
        ownTitle,
      );
      expect(await reloadCatalog(foreign)).toEqual(foreignBefore);
      await expect(foreign.getByLabel("Заголовок анкеты")).toHaveValue(
        foreignTitle,
      );

      await page.unroute("**/api/catalog/profile");
      let queryReads = 0,
        queryWrites = 0;
      await page.route("**/api/catalog/profile", async (route) => {
        const url = new URL(route.request().url());
        url.searchParams.set("id", foreignId);
        url.searchParams.set("user_id", foreignId);
        url.searchParams.set("tutor_id", foreignId);
        url.searchParams.set("role", "learner");
        const response = await route.fetch({ url: url.href });
        expect(response.status()).toBe(200);
        if (route.request().method() === "GET") {
          expect((await response.json()).offer.headline).toBe(updatedTitle);
          queryReads++;
        } else if (route.request().method() === "PUT") {
          queryWrites++;
        }
        await route.fulfill({ response });
      });
      await saveCatalog(page);
      const ownAfter = await reloadCatalog(page);
      expect(queryWrites).toBe(1);
      expect(queryReads).toBe(1);
      expect(ownAfter.revision).toBe(ownBefore.revision + 1);
      await expect(page.getByLabel("Заголовок анкеты")).toHaveValue(
        updatedTitle,
      );
      await expect(
        page.getByLabel("Стоимость занятия, руб.", { exact: true }),
      ).toHaveValue("303");
      expect(await reloadCatalog(observer)).toEqual(ownAfter);
      await expect(observer.getByLabel("Заголовок анкеты")).toHaveValue(
        updatedTitle,
      );
      expect(await reloadCatalog(foreign)).toEqual(foreignBefore);
      await expect(foreign.getByLabel("Заголовок анкеты")).toHaveValue(
        foreignTitle,
      );
      await expect(
        foreign.getByLabel("Стоимость занятия, руб.", { exact: true }),
      ).toHaveValue("202");
    } finally {
      await foreign.close();
      await observer.close();
    }
  });

async function openNotifications(page: Page, alias: RegExp) {
  const loaded = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/notifications" &&
      r.request().method() === "GET",
  );
  await page.getByRole("button", { name: alias }).click();
  const response = await loaded;
  expect(response.status()).toBe(200);
  await expect(page.getByLabel("О ближайших занятиях")).toBeEnabled();
  const data = await response.json();
  return {
    lessons: data.lessons,
    assignments: data.assignments,
    bot_started: data.bot_started,
  };
}

async function reloadNotifications(page: Page, alias: RegExp) {
  await page.reload();
  return openNotifications(page, alias);
}

async function saveNotifications(page: Page) {
  await page
    .getByRole("button", { name: "Сохранить напоминания", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Настройки напоминаний сохранены",
  );
}

for (const [role, button, alias, foreignButton, foreignAlias, foreignId] of [
  [
    "tutor",
    "Я преподаватель",
    /Алекс • демо/,
    "Я ученик",
    /Саша • демо/,
    "demo-learner",
  ],
  [
    "learner",
    "Я ученик",
    /Саша • демо/,
    "Я преподаватель",
    /Алекс • демо/,
    "demo-tutor",
  ],
] as const)
  test(`notifications ${role}: body identity fields are rejected and query identity cannot select another account`, async ({
    page,
    browser,
    request,
  }) => {
    test.skip(
      process.env.E2E_AUDIT !== "1",
      "Requires isolated audit server with blocked outbound transport",
    );
    // Explicit synthetic prerequisite: contacts are seeded by the existing audit fixture.
    // Actual bot connection, MAX and message delivery are not exercised. All preference
    // reads/changes/retries below come from UI actions in independent browser sessions.
    const contacts = await request.post("/__audit__/notification-contacts");
    expect(contacts.status()).toBe(200);
    expect((await contacts.json()).delivery).toBe("blocked_test_transport");
    const foreign = await browser.newPage(),
      observer = await browser.newPage();
    try {
      await login(foreign, foreignButton);
      await openNotifications(foreign, foreignAlias);
      if (role === "tutor") {
        await foreign.getByLabel("О ближайших занятиях").check();
        await foreign.getByLabel("О сроках заданий").check();
        await saveNotifications(foreign);
      }
      const foreignBefore = await reloadNotifications(foreign, foreignAlias);
      await login(page, button);
      await openNotifications(page, alias);
      if (role === "learner") {
        await page.getByLabel("О сроках заданий").check();
        await saveNotifications(page);
      } else {
        await expect(page.getByLabel("О сроках заданий")).toHaveCount(0);
      }
      const ownBefore = await reloadNotifications(page, alias);
      expect(ownBefore.lessons).toBe(false);
      expect(ownBefore.assignments).toBe(role === "learner");
      await page.getByLabel("О ближайших занятиях").check();
      let rejected = 0;
      await page.route("**/api/notifications", async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        const response = await route.fetch({
          postData: {
            ...route.request().postDataJSON(),
            id: foreignId,
            user_id: foreignId,
            role: role === "tutor" ? "learner" : "tutor",
          },
        });
        expect(response.status()).toBe(422);
        rejected++;
        await route.fulfill({ response });
      });
      await page
        .getByRole("button", { name: "Сохранить напоминания", exact: true })
        .click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      expect(rejected).toBe(1);
      await expect(page.getByLabel("О ближайших занятиях")).toBeChecked();
      await expect(page.getByRole("status")).toHaveCount(0);
      await login(observer, button);
      expect(await openNotifications(observer, alias)).toEqual(ownBefore);
      await expect(
        observer.getByLabel("О ближайших занятиях"),
      ).not.toBeChecked();
      expect(await reloadNotifications(foreign, foreignAlias)).toEqual(
        foreignBefore,
      );

      await page.unroute("**/api/notifications");
      let queryReads = 0,
        queryWrites = 0;
      await page.route("**/api/notifications", async (route) => {
        const url = new URL(route.request().url());
        url.searchParams.set("id", foreignId);
        url.searchParams.set("user_id", foreignId);
        url.searchParams.set("role", role === "tutor" ? "learner" : "tutor");
        const response = await route.fetch({ url: url.href });
        expect(response.status()).toBe(200);
        if (route.request().method() === "GET") {
          const data = await response.json();
          expect(data.lessons).toBe(true);
          expect(data.assignments).toBe(role === "learner");
          queryReads++;
        } else if (route.request().method() === "PATCH") {
          queryWrites++;
        }
        await route.fulfill({ response });
      });
      await saveNotifications(page);
      const ownAfter = await reloadNotifications(page, alias);
      expect(queryWrites).toBe(1);
      expect(queryReads).toBe(2);
      expect(ownAfter).toEqual({ ...ownBefore, lessons: true });
      await expect(page.getByLabel("О ближайших занятиях")).toBeChecked();
      if (role === "learner")
        await expect(page.getByLabel("О сроках заданий")).toBeChecked();
      expect(await reloadNotifications(observer, alias)).toEqual(ownAfter);
      await expect(observer.getByLabel("О ближайших занятиях")).toBeChecked();
      expect(await reloadNotifications(foreign, foreignAlias)).toEqual(
        foreignBefore,
      );
      if (foreignBefore.lessons)
        await expect(foreign.getByLabel("О ближайших занятиях")).toBeChecked();
      else
        await expect(
          foreign.getByLabel("О ближайших занятиях"),
        ).not.toBeChecked();
      if (role === "tutor")
        await expect(foreign.getByLabel("О сроках заданий")).toBeChecked();
    } finally {
      await foreign.close();
      await observer.close();
    }
  });
