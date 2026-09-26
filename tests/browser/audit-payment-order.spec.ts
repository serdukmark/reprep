import { test, expect, choose } from "./audit-fixtures";
import type { Page } from "@playwright/test";

type LessonRow = {
  id: string;
  title: string;
  payment_status?: string;
  [key: string]: unknown;
};

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function lessonCard(page: Page, title: string) {
  return page
    .locator(".lesson-row")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

function payment(page: Page, title: string) {
  return lessonCard(page, title).getByRole("combobox", {
    name: "Ваша отметка об оплате",
    exact: true,
  });
}

function status(page: Page, title: string) {
  return lessonCard(page, title).getByRole("combobox", {
    name: "Статус занятия",
    exact: true,
  });
}

type Field = "payment_status" | "status";
type Choice = "paid" | "unpaid" | "completed" | "cancelled";
const labels: Record<Choice, string> = {
  paid: "Оплачено",
  unpaid: "Не оплачено",
  completed: "Проведено",
  cancelled: "Отменено",
};

function control(page: Page, title: string, field: Field) {
  return field === "payment_status"
    ? payment(page, title)
    : status(page, title);
}

async function loginSchedule(page: Page, role: "tutor" | "learner") {
  await page.goto("/");
  const loaded = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/lessons" &&
      r.request().method() === "GET",
  );
  await page
    .getByRole("button", {
      name: role === "tutor" ? "Я преподаватель" : "Я ученик",
      exact: true,
    })
    .click();
  const response = await loaded;
  expect(response.status()).toBe(200);
  await page.getByRole("button", { name: "Расписание", exact: true }).click();
  return (await response.json()) as LessonRow[];
}

async function reloadSchedule(page: Page) {
  const loaded = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/lessons" &&
      r.request().method() === "GET",
  );
  await page.reload();
  const response = await loaded;
  expect(response.status()).toBe(200);
  const rows = (await response.json()) as LessonRow[];
  await page.getByRole("button", { name: "Расписание", exact: true }).click();
  return rows;
}

async function createLesson(page: Page, title: string, time: string) {
  await page
    .getByRole("button", { name: "Добавить занятие", exact: true })
    .click();
  await page.getByLabel("Название", { exact: true }).fill(title);
  await choose(
    page.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  await page.getByLabel("Начало (ваш часовой пояс)").fill(time);
  await page.getByLabel("Длительность, минут", { exact: true }).fill("60");
  const created = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/lessons" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const id: string = (await response.json()).id;
  await expect(lessonCard(page, title)).toHaveCount(1);
  await expect(payment(page, title)).toHaveText("Не отмечено");
  return id;
}

function sorted(rows: LessonRow[]) {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

async function expectFinalState(
  page: Page,
  observer: Page,
  learner: Page,
  before: LessonRow[],
  learnerBefore: LessonRow[],
  id: string,
  title: string,
  otherTitle: string,
  field: Field,
  final: Choice,
) {
  const expected = before.map((item) =>
    item.id === id ? { ...item, [field]: final } : item,
  );
  for (const ownerPage of [page, observer]) {
    expect(sorted(await reloadSchedule(ownerPage))).toEqual(sorted(expected));
    await expect(control(ownerPage, title, field)).toHaveText(labels[final]);
    await expect(payment(ownerPage, otherTitle)).toHaveText("Не отмечено");
    await expect(status(ownerPage, otherTitle)).toHaveText("Запланировано");
    await expect(lessonCard(ownerPage, title)).toHaveCount(1);
    await expect(lessonCard(ownerPage, otherTitle)).toHaveCount(1);
    await expect(ownerPage.getByRole("alert")).toHaveCount(0);
  }
  const learnerAfter = await reloadSchedule(learner);
  const learnerExpected = learnerBefore.map((item) =>
    field === "status" && item.id === id ? { ...item, status: final } : item,
  );
  expect(sorted(learnerAfter)).toEqual(sorted(learnerExpected));
  for (const lesson of learnerAfter)
    expect(lesson).not.toHaveProperty("payment_status");
  await expect(lessonCard(learner, title)).toHaveCount(1);
  await expect(lessonCard(learner, otherTitle)).toHaveCount(1);
  if (field === "status")
    await expect(
      lessonCard(learner, title).getByText(labels[final], { exact: true }),
    ).toBeVisible();
  await expect(
    learner.getByRole("combobox", {
      name: "Ваша отметка об оплате",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    learner.getByRole("combobox", { name: "Статус занятия", exact: true }),
  ).toHaveCount(0);
  await expect(
    learner.getByText(/^(Оплачено|Не оплачено|Без оплаты)$/),
  ).toHaveCount(0);
}

for (const [field, firstChoice, choices] of [
  ["payment_status", "paid", ["unpaid", "paid"]],
  ["status", "completed", ["cancelled", "completed"]],
] as const)
  for (const secondChoice of choices)
    test(`${field === "payment_status" ? "manual payment" : "lesson status"} pending ${secondChoice !== firstChoice ? "opposite choices preserve last choice" : "same choice remains idempotent"}`, async ({
      page,
      browser,
    }) => {
      const observer = await browser.newPage(),
        learner = await browser.newPage();
      const releaseFirst = signal(),
        firstStarted = signal(),
        firstFinished = signal(),
        secondFinished = signal();
      const title =
        field === "payment_status"
          ? "Порядок отметок оплаты 🧪"
          : "Порядок статусов занятия 🧪";
      const otherTitle = "Другое занятие без изменения 🧪";
      let started = 0;
      try {
        await loginSchedule(page, "tutor");
        const id = await createLesson(page, title, "2099-01-10T12:00");
        await createLesson(page, otherTitle, "2099-01-11T12:00");
        const before = await loginSchedule(observer, "tutor");
        const learnerBefore = await loginSchedule(learner, "learner");
        const initial = field === "payment_status" ? "unknown" : "scheduled";
        const initialLabel =
          field === "payment_status" ? "Не отмечено" : "Запланировано";
        expect(before.find((item) => item.id === id)?.[field]).toBe(initial);
        const path = `**/api/lessons/${id}`;
        await page.route(path, async (route) => {
          if (route.request().method() !== "PATCH") return route.continue();
          const sequence = ++started;
          const body = route.request().postDataJSON();
          expect(body).toEqual({
            [field]: sequence === 1 ? firstChoice : secondChoice,
          });
          if (sequence === 1) {
            firstStarted.resolve();
            // Delay the real first write, not a fabricated response. The second
            // visible choice may reach the server first if the UI remains enabled.
            await releaseFirst.promise;
          }
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          // Wait for the refresh caused by this particular delivered write.
          // A reload must not capture that old GET as its new-page oracle.
          const refreshed = page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === "/api/lessons" &&
              r.request().method() === "GET",
          );
          await route.fulfill({ response });
          await (await refreshed).body();
          if (sequence === 1) firstFinished.resolve();
          else secondFinished.resolve();
        });
        await choose(control(page, title, field), firstChoice);
        await firstStarted.promise;
        // An independent session must still show the committed baseline while
        // the first write is held. This also proves that the gate was exercised.
        expect(sorted(await reloadSchedule(observer))).toEqual(sorted(before));
        await expect(control(observer, title, field)).toHaveText(initialLabel);
        const blocked = await control(page, title, field).isDisabled();
        if (blocked) {
          // Both fields update the same lesson. Locking only the active field
          // would still allow a concurrent change through its neighbouring control.
          await expect(payment(page, title)).toBeDisabled();
          await expect(status(page, title)).toBeDisabled();
          expect(started).toBe(1);
          releaseFirst.resolve();
          await firstFinished.promise;
          await expect(control(page, title, field)).toHaveText(
            labels[firstChoice],
          );
          await expect(payment(page, title)).toBeEnabled();
          await expect(status(page, title)).toBeEnabled();
          if (secondChoice !== firstChoice) {
            await choose(control(page, title, field), secondChoice);
            await secondFinished.promise;
          }
          // A disabled selector safely prevents the duplicate in the same-choice case.
        } else {
          await choose(control(page, title, field), secondChoice);
          await secondFinished.promise;
          expect(started).toBe(2);
          await expect(control(page, title, field)).toHaveText(
            labels[secondChoice],
          );
          const intermediate = await reloadSchedule(observer);
          expect(intermediate.find((item) => item.id === id)?.[field]).toBe(
            secondChoice,
          );
          // Deliver the older operation last. The final oracle is the latest
          // user's accepted choice, including after an independent reload.
          releaseFirst.resolve();
          await firstFinished.promise;
        }
        await expectFinalState(
          page,
          observer,
          learner,
          before,
          learnerBefore,
          id,
          title,
          otherTitle,
          field,
          secondChoice,
        );
        expect(started).toBe(blocked && secondChoice === firstChoice ? 1 : 2);
      } finally {
        releaseFirst.resolve();
        await observer.close();
        await learner.close();
      }
    });
