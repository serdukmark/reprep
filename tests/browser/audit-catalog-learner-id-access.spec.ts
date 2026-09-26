import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";

type Identity = { id: string; alias: string };
type RequestRow = { id: string; message: string; reply: string; learner_alias: string; tutor_alias: string; [key: string]: unknown };

async function login(page: Page, button: string): Promise<Identity> {
  await page.goto("/");
  const authenticated = page.waitForResponse(r => r.request().method() === "POST" &&
    ["/api/auth/demo/tutor", "/api/auth/demo/outsider", "/api/auth/demo/learner", "/__audit__/identity/learner"].includes(new URL(r.url()).pathname));
  await page.getByRole("button", { name: button, exact: true }).click();
  const response = await authenticated;
  expect(response.status()).toBe(200);
  const user = (await response.json()).user;
  return { id: user.id, alias: user.alias };
}

function inbox(page: Page) {
  return page.locator("section.card").filter({ has: page.getByRole("heading", { name: /^(Мои заявки|Заявки учеников)$/ }) });
}

async function openCatalog(page: Page): Promise<RequestRow[]> {
  const incoming = page.waitForResponse(r => new URL(r.url()).pathname === "/api/catalog/requests" && r.request().method() === "GET");
  await page.getByRole("button", { name: "Репетиторы", exact: true }).click();
  const response = await incoming;
  expect(response.status()).toBe(200);
  await expect(inbox(page)).toBeVisible();
  return response.json();
}

async function reloadCatalog(page: Page) {
  await page.reload();
  return openCatalog(page);
}

async function publishOffer(page: Page, title: string, subject: string) {
  await openCatalog(page);
  await page.getByLabel("Заголовок анкеты").fill(title);
  await page.getByLabel("О занятиях", { exact: true }).fill("Синтетическая анкета для проверки приватности личных заявок.");
  await page.getByLabel("Предметы анкеты (каждый с новой строки)").fill(subject);
  await page.getByLabel("Стоимость занятия, руб.", { exact: true }).fill("500");
  await page.getByLabel("Длительность занятия, минут", { exact: true }).fill("60");
  await page.getByLabel("Показывать мою анкету в каталоге").check();
  await page.getByRole("button", { name: "Сохранить анкету", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Анкета сохранена");
}

async function fillRequest(page: Page, offerTitle: string, message: string) {
  const offer = page.locator("article.card").filter({ has: page.getByRole("heading", { name: offerTitle, exact: true }) });
  await expect(offer).toHaveCount(1);
  await offer.getByRole("button", { name: "Оставить заявку", exact: true }).click();
  await offer.getByLabel("Что хотите изучать").fill(message);
}

async function sendRequest(page: Page, tutorId: string) {
  const created = page.waitForResponse(r => new URL(r.url()).pathname === `/api/catalog/${tutorId}/requests` && r.request().method() === "POST");
  await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  await expect(page.getByText("Заявка сохранена. Решение преподавателя появится здесь.", { exact: true })).toBeVisible();
  return (await response.json()).id as string;
}

function foreignQuery(url: URL, requestId: string, learnerId: string, tutorId: string) {
  for (const [key, value] of Object.entries({
    id: requestId, request_id: requestId, user_id: learnerId, learner_id: learnerId, tutor_id: tutorId, role: "tutor",
  })) url.searchParams.set(key, value);
  return url.href;
}

for (const mode of ["read", "write"] as const)
  test(`learner catalog ${mode}: forged identities cannot expose another request or submit on its author's behalf`, async ({ page, browser }) => {
    const tutor = await browser.newPage(), foreignTutor = await browser.newPage(), foreignLearner = await browser.newPage(), observer = await browser.newPage();
    const ownOffer = "Свой преподаватель для заявки 🧪";
    const foreignOffer = "Другой преподаватель для заявки 🧪";
    const ownMessage = "Моя личная заявка: дроби и уравнения <>& 🧪";
    const privateMessage = "Чужая личная заявка: приватный план обучения 🧪";
    const privateReply = "Приватный ответ другому ученику 🧪";
    try {
      // All offers, requests and replies are created through UI. Only the fresh
      // synthetic login and the malicious identity fields are intercepted.
      const owner = await login(tutor, "Я преподаватель");
      await publishOffer(tutor, ownOffer, "Своя математика");
      const otherTutor = await login(foreignTutor, "Другой преподаватель · демо");
      await publishOffer(foreignTutor, foreignOffer, "Другая физика");
      await foreignLearner.route("**/api/auth/demo/learner", route => route.continue({
        url: new URL("/__audit__/identity/learner", route.request().url()).href,
      }));
      const otherLearner = await login(foreignLearner, "Я ученик");
      expect(otherLearner.id).not.toBe("demo-learner");
      await openCatalog(foreignLearner);
      await fillRequest(foreignLearner, foreignOffer, privateMessage);
      const foreignId = await sendRequest(foreignLearner, otherTutor.id);
      await reloadCatalog(foreignTutor);
      await inbox(foreignTutor).getByLabel("Ответ на заявку").fill(privateReply);
      await inbox(foreignTutor).getByRole("button", { name: "Отклонить заявку", exact: true }).click();
      await expect(inbox(foreignTutor).getByText("Преподаватель отклонил заявку.", { exact: true })).toBeVisible();
      const foreignBefore = await reloadCatalog(foreignLearner);
      expect(foreignBefore).toHaveLength(1);
      expect(foreignBefore[0]).toMatchObject({ id: foreignId, message: privateMessage, reply: privateReply, status: "declined" });
      await expect(inbox(foreignLearner).getByText(privateMessage, { exact: true })).toBeVisible();
      await expect(inbox(foreignLearner).getByText("Ответ преподавателя: " + privateReply, { exact: true })).toBeVisible();
      const foreignTutorBefore = await reloadCatalog(foreignTutor);

      const ownLearner = await login(page, "Я ученик");
      expect(await openCatalog(page)).toEqual([]);
      await fillRequest(page, ownOffer, ownMessage);
      let ownId: string;
      if (mode === "read") {
        ownId = await sendRequest(page, owner.id);
        const ownBefore = await reloadCatalog(page);
        expect(ownBefore).toHaveLength(1);
        let reads = 0;
        await page.route("**/api/catalog/requests", async route => {
          const response = await route.fetch({ url: foreignQuery(new URL(route.request().url()), foreignId, otherLearner.id, otherTutor.id) });
          expect(response.status()).toBe(200);
          expect(await response.json()).toEqual(ownBefore);
          reads++;
          await route.fulfill({ response });
        });
        expect(await reloadCatalog(page)).toEqual(ownBefore);
        expect(reads).toBeGreaterThanOrEqual(1);
        await expect(inbox(page).getByText(ownMessage, { exact: true })).toHaveCount(1);
        await expect(page.getByText(privateMessage, { exact: true })).toHaveCount(0);
        await expect(page.getByText("Ответ преподавателя: " + privateReply, { exact: true })).toHaveCount(0);
        await page.unroute("**/api/catalog/requests");
        expect(await reloadCatalog(page)).toEqual(ownBefore);
      } else {
        const path = `**/api/catalog/${owner.id}/requests`;
        let rejected = 0;
        await page.route(path, async route => {
          const response = await route.fetch({ postData: {
            ...route.request().postDataJSON(), learner_id: otherLearner.id, user_id: otherLearner.id, role: "tutor",
          } });
          expect(response.status()).toBe(422);
          rejected++;
          await route.fulfill({ response });
        });
        await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
        await expect(page.getByRole("alert").first()).toBeVisible();
        expect(rejected).toBe(1);
        await expect(page.getByLabel("Что хотите изучать")).toHaveValue(ownMessage);
        await expect(inbox(page).getByText("Заявок пока нет.", { exact: true })).toBeVisible();
        await expect(page.getByText("Заявка сохранена. Решение преподавателя появится здесь.", { exact: true })).toHaveCount(0);
        await login(observer, "Я ученик");
        expect(await openCatalog(observer)).toEqual([]);
        await expect(inbox(observer).getByText("Заявок пока нет.", { exact: true })).toBeVisible();
        expect(await reloadCatalog(tutor)).toEqual([]);
        expect(await reloadCatalog(foreignLearner)).toEqual(foreignBefore);
        expect(await reloadCatalog(foreignTutor)).toEqual(foreignTutorBefore);
        await page.unroute(path);
        let writes = 0;
        await page.route(path, async route => {
          const response = await route.fetch({ url: foreignQuery(new URL(route.request().url()), foreignId, otherLearner.id, otherTutor.id) });
          expect(response.status()).toBe(201);
          writes++;
          await route.fulfill({ response });
        });
        ownId = await sendRequest(page, owner.id);
        expect(writes).toBe(1);
        await page.unroute(path);
      }
      expect(ownId).not.toBe(foreignId);
      const ownAfter = await reloadCatalog(page);
      expect(ownAfter).toHaveLength(1);
      expect(ownAfter[0]).toMatchObject({ id: ownId, message: ownMessage, learner_alias: ownLearner.alias, tutor_alias: owner.alias, status: "pending", reply: "" });
      await expect(inbox(page).getByText(ownMessage, { exact: true })).toHaveCount(1);
      await expect(page.getByText(privateMessage, { exact: true })).toHaveCount(0);
      await expect(page.getByText("Ответ преподавателя: " + privateReply, { exact: true })).toHaveCount(0);
      const ownIncoming = await reloadCatalog(tutor);
      expect(ownIncoming).toHaveLength(1);
      expect(ownIncoming[0]).toMatchObject({ id: ownId, message: ownMessage, learner_alias: ownLearner.alias, status: "pending" });
      await expect(inbox(tutor).getByText(ownMessage, { exact: true })).toHaveCount(1);
      await expect(inbox(tutor).getByRole("heading", { name: "Своя математика · " + ownLearner.alias, exact: true })).toBeVisible();
      expect(await reloadCatalog(foreignLearner)).toEqual(foreignBefore);
      expect(await reloadCatalog(foreignTutor)).toEqual(foreignTutorBefore);
      await expect(inbox(foreignLearner).getByText(ownMessage, { exact: true })).toHaveCount(0);
      await expect(inbox(foreignTutor).getByText(ownMessage, { exact: true })).toHaveCount(0);
    } finally {
      await tutor.close();
      await foreignTutor.close();
      await foreignLearner.close();
      await observer.close();
    }
  });
