import { test, expect, choose } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
import type { Download, Locator, Page } from "@playwright/test";

// U010/U024/U032: a double click while the actual export response is pending.
// Data is created in UI. Interception delays only delivery, not server output.
const personas = {
  tutor: ["Я преподаватель", "Алекс • демо"],
  learner: ["Я ученик", "Саша • демо"],
  guardian: ["Я родитель", "Родитель • демо"],
  outsider: ["Другой преподаватель · демо", "Другой репетитор • демо"],
} as const;
type Role = keyof typeof personas;
const privateMessage =
  "Приватное сообщение второго ученика 🧪\nТолько его преподавателю.";
const ownSkill = "Свой навык для повторного экспорта 🧪";
const otherSkill = "Навык другого ученика для экспорта 🧪";
const ownWork = "Своя проверенная работа для экспорта 🧪";
const otherWork = "Работа другого ученика для экспорта 🧪";
const privateRubric = "Приватный критерий преподавателя EXPORT-REPEAT 🧪";
const ownLesson = "Своё занятие для повторного ICS 🧪";
const otherLesson = "Занятие другого ученика для ICS 🧪";

async function login(page: Page, role: Role) {
  await page.goto("/");
  await page
    .getByRole("button", { name: personas[role][0], exact: true })
    .click();
}

async function pendingDoubleDownload(
  page: Page,
  button: Locator,
  path: string,
  kind: "account" | "progress" | "calendar",
) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const files: Download[] = [];
  const expectedCopies: string[] = [];
  const receive = (download: Download) => {
    files.push(download);
  };
  let calls = 0;
  page.on("download", receive);
  await page.route(path, async (route) => {
    expect(route.request().method()).toBe("GET");
    calls++;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    const text = await response.text();
    expectedCopies.push(
      kind === "account"
        ? text
        : kind === "calendar"
          ? JSON.parse(text).content
          : JSON.stringify(JSON.parse(text), null, 2),
    );
    await held;
    await route.fulfill({ response });
  });
  try {
    await button.dblclick({ delay: 40 });
    await expect.poll(() => calls).toBeGreaterThan(0);
    // Let both click handlers and their resulting UI state finish before
    // counting dispatched requests. No sleep or synthetic server response.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    if (kind === "progress") {
      expect(calls).toBeGreaterThanOrEqual(1);
      expect(calls).toBeLessThanOrEqual(2);
    } else {
      await expect(button).toBeDisabled();
      expect(calls).toBe(1);
    }
    await expect.poll(() => expectedCopies.length).toBe(calls);
    expect(files).toHaveLength(0);
    release();
    await expect.poll(() => files.length).toBe(calls);
    const contents: string[] = [];
    const fileName =
      kind === "account"
        ? "reprep-my-data.json"
        : kind === "progress"
          ? "reprep-progress.json"
          : "reprep-schedule.ics";
    for (const file of files) {
      expect(file.suggestedFilename()).toBe(fileName);
      expect(await file.failure()).toBeNull();
      const filePath = await file.path();
      expect(filePath).not.toBeNull();
      contents.push(await readFile(filePath!, "utf8"));
    }
    // Compare every byte of every delivered file with its real response,
    // accounting for the client's JSON stringify / ICS content extraction.
    expect(contents.slice().sort()).toEqual(expectedCopies.slice().sort());
    expect(files).toHaveLength(calls);
    if (kind !== "progress") await expect(button).toBeEnabled();
    return contents;
  } finally {
    release();
    await page.unroute(path);
    page.off("download", receive);
  }
}

async function seedDiscussion(tutor: Page) {
  await login(tutor, "tutor");
  await tutor
    .getByRole("button", { name: /Дроби и уравнения: самостоятельная работа/ })
    .click();
  await tutor.getByLabel("Сообщение по заданию").fill(privateMessage);
  await tutor
    .getByRole("button", { name: "Отправить сообщение", exact: true })
    .click();
  await expect(tutor.getByText(privateMessage, { exact: true })).toBeVisible();
}

for (const role of ["tutor", "learner", "guardian", "outsider"] as const)
  test(`account export ${role}: pending double click downloads one complete private snapshot`, async ({
    page,
    browser,
  }) => {
    const tutor = await browser.newPage();
    try {
      await seedDiscussion(tutor);
      await login(page, role);
      if (role !== "guardian")
        await page
          .getByRole("button", { name: new RegExp(personas[role][1]) })
          .click();
      const contents = await pendingDoubleDownload(
        page,
        page.getByRole("button", { name: "Скачать мои данные", exact: true }),
        "**/api/account/export",
        "account",
      );
      expect(contents).toHaveLength(1);
      for (const text of contents) {
        const data = JSON.parse(text);
        expect(data.account.id).toBe("demo-" + role);
        expect(data.account.role).toBe(role === "outsider" ? "tutor" : role);
        expect(data.account.alias).toBe(personas[role][1]);
        const serialized = JSON.stringify(data);
        expect(serialized).not.toMatch(
          /token_hash|init_data|bot_token|OPENROUTER_API_KEY/,
        );
        // Tutor owns both demo relationships; this message is private from
        // the first learner, unlinked guardian and unrelated tutor.
        if (role === "tutor") {
          expect(
            data.messages.some(
              (message: { text: string }) => message.text === privateMessage,
            ),
          ).toBe(true);
        } else {
          expect(serialized).not.toContain(privateMessage.split("\n")[0]);
          expect(
            data.assignments.some(
              (assignment: { id: string }) =>
                assignment.id === "demo-assignment-2",
            ),
          ).toBe(false);
        }
        if (role === "learner") {
          expect(
            data.relationships.map(
              (relationship: { id: string }) => relationship.id,
            ),
          ).toEqual(["demo-link"]);
          expect(data.assignments.length).toBeGreaterThan(0);
          for (const assignment of data.assignments) {
            for (const task of assignment.tasks) {
              expect(task).not.toHaveProperty("answer");
              expect(task).not.toHaveProperty("rubric");
            }
          }
        }
        if (role === "guardian" || role === "outsider") {
          expect(data.relationships).toEqual([]);
          expect(data.assignments).toEqual([]);
          expect(data.messages).toEqual([]);
        }
      }
      await expect(
        page.getByText("Файл экспорта передан браузеру", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    } finally {
      await tutor.close();
    }
  });

async function reviewedWork(
  tutor: Page,
  learner: Page,
  relationship: string,
  title: string,
  skill: string,
) {
  await tutor
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await tutor.getByLabel("Название работы").fill(title);
  await choose(
    tutor.getByRole("combobox", { name: "Ученик", exact: true }),
    relationship,
  );
  await tutor
    .getByLabel("Условие", { exact: true })
    .fill("Сколько будет 2 + 3?");
  await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await tutor
    .getByLabel("Критерии проверки", { exact: true })
    .fill(privateRubric);
  await tutor.getByLabel("Навык", { exact: true }).fill(skill);
  await tutor
    .getByRole("button", { name: "Назначить ученику", exact: true })
    .click();
  await expect(
    tutor.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await learner.reload();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await learner.getByLabel("Ответ на задание 1").fill("5");
  await learner
    .getByRole("button", { name: "Сохранить ответы", exact: true })
    .click();
  await expect(learner.getByRole("status")).toHaveText("Сохранено");
  learner.once("dialog", (dialog) => dialog.accept());
  await learner
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(learner.locator(".work-task .original p")).toHaveText("5");
  await tutor.reload();
  await tutor.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    tutor.getByRole("button", { name: "Подтвердить разбор", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await tutor
    .getByRole("button", { name: "Подтвердить разбор", exact: true })
    .click();
  await expect(
    tutor.getByText("Проверено преподавателем", { exact: true }),
  ).toBeVisible();
}

for (const role of ["tutor", "learner"] as const)
  test(`progress export ${role}: pending double click delivers only the selected pupil's complete evidence`, async ({
    page,
    browser,
  }) => {
    const tutor = await browser.newPage();
    const learner = await browser.newPage();
    const other = await browser.newPage();
    try {
      await login(tutor, "tutor");
      await login(learner, "learner");
      await other.route("**/api/auth/demo/learner", (route) =>
        route.continue({ url: route.request().url() + "-2" }),
      );
      await login(other, "learner");
      await reviewedWork(tutor, learner, "demo-link", ownWork, ownSkill);
      await tutor.getByRole("button", { name: /^Задания(?: \d+)?$/ }).click();
      await reviewedWork(tutor, other, "demo-link-2", otherWork, otherSkill);
      // Positive control for the other relationship's real confirmed marker.
      await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
      await tutor.getByRole("button", { name: /Женя • демо/ }).click();
      await expect(
        tutor.locator(".progress-panel").getByText(otherSkill, { exact: true }),
      ).toBeVisible();

      await login(page, role);
      await page
        .getByRole("button", {
          name: role === "tutor" ? "Ученики" : "Мой прогресс",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: role === "tutor" ? /Саша • демо/ : /Алекс • демо/,
        })
        .click();
      await expect(
        page.locator(".progress-panel").getByText(ownSkill, { exact: true }),
      ).toBeVisible();
      const contents = await pendingDoubleDownload(
        page,
        page.getByRole("button", { name: "Экспорт прогресса", exact: true }),
        "**/api/relationships/demo-link/export",
        "progress",
      );
      expect(contents.length).toBeGreaterThanOrEqual(1);
      expect(contents.length).toBeLessThanOrEqual(2);
      for (const text of contents) {
        const data = JSON.parse(text);
        expect(Object.keys(data).sort()).toEqual([
          "exported_at",
          "progress",
          "subject",
        ]);
        expect(data.subject).toBe("Математика · ЕГЭ");
        expect(data.progress).toHaveLength(1);
        expect(data.progress[0].skill).toBe(ownSkill);
        expect(data.progress[0].total).toBe(1);
        expect(data.progress[0].correct).toBe(1);
        expect(data.progress[0].evidence).toHaveLength(1);
        expect(data.progress[0].evidence[0].assignment_title).toBe(ownWork);
        expect(text).not.toContain(otherSkill);
        expect(text).not.toContain(otherWork);
        expect(text).not.toContain(privateRubric);
        expect(text).not.toMatch(
          /token_hash|init_data|bot_token|payment_status/,
        );
      }
      await expect(page.getByRole("alert")).toHaveCount(0);
    } finally {
      await tutor.close();
      await learner.close();
      await other.close();
    }
  });

async function lesson(tutor: Page, relationship: string, title: string) {
  await tutor
    .getByRole("button", { name: "Добавить занятие", exact: true })
    .click();
  await tutor.getByLabel("Название", { exact: true }).fill(title);
  await choose(
    tutor.getByRole("combobox", { name: "Ученик", exact: true }),
    relationship,
  );
  await tutor.getByLabel("Начало (ваш часовой пояс)").fill("2026-10-01T15:00");
  await tutor.getByLabel("Длительность, минут").fill("45");
  await tutor.getByRole("button", { name: "Сохранить", exact: true }).click();
  const row = tutor
    .locator(".lesson-row")
    .filter({ has: tutor.getByRole("heading", { name: title, exact: true }) });
  await expect(row).toBeVisible();
  await choose(
    row.getByRole("combobox", { name: "Ваша отметка об оплате", exact: true }),
    "paid",
  );
  await expect(
    row.getByRole("combobox", { name: "Ваша отметка об оплате", exact: true }),
  ).toHaveText("Оплачено");
}

for (const role of ["tutor", "learner"] as const)
  test(`calendar export ${role}: pending double click downloads one complete ICS with authorized lessons and no payment`, async ({
    page,
    browser,
  }) => {
    const tutor = await browser.newPage();
    try {
      await login(tutor, "tutor");
      await tutor
        .getByRole("button", { name: "Расписание", exact: true })
        .click();
      await lesson(tutor, "demo-link", ownLesson);
      await lesson(tutor, "demo-link-2", otherLesson);
      await login(page, role);
      await page
        .getByRole("button", { name: "Расписание", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: ownLesson, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: otherLesson, exact: true }),
      ).toHaveCount(role === "tutor" ? 1 : 0);
      // Include the existing synthetic demo lesson as well as the two UI-created
      // lessons, using the caller's actual visible list as the count control.
      const expectedEvents = await page.locator(".lesson-row").count();
      const contents = await pendingDoubleDownload(
        page,
        page.getByRole("button", {
          name: "Скачать календарь (.ics)",
          exact: true,
        }),
        "**/api/calendar",
        "calendar",
      );
      expect(contents).toHaveLength(1);
      for (const text of contents) {
        expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
        expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
        const unfolded = text.replace(/\r\n[ \t]/g, "");
        expect(unfolded).toContain("SUMMARY:" + ownLesson);
        if (role === "tutor")
          expect(unfolded).toContain("SUMMARY:" + otherLesson);
        else expect(unfolded).not.toContain(otherLesson);
        expect(unfolded).not.toMatch(
          /payment_status|unpaid|paid|Оплачено|Не оплачено|token_hash|init_data/,
        );
        expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(expectedEvents);
      }
      await expect(page.getByRole("alert")).toHaveCount(0);
    } finally {
      await tutor.close();
    }
  });
