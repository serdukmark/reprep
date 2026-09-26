import { test, expect } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
import type { Browser, Download, Page } from "@playwright/test";

const personas = {
  tutor: ["Я преподаватель", "Алекс • демо"],
  learner: ["Я ученик", "Саша • демо"],
  guardian: ["Я родитель", "Родитель • демо"],
  outsider: ["Другой преподаватель · демо", "Другой репетитор • демо"],
} as const;
type Persona = keyof typeof personas;
type Export = Record<string, unknown> & {
  schema_version: string;
  exported_at: string;
  account: Record<string, unknown>;
  assignments: {
    id: string;
    relationship_id: string;
    tasks: Record<string, unknown>[];
  }[];
  relationships: { id: string }[];
  lessons: Record<string, unknown>[];
  messages: unknown[];
};

function accountSection(page: Page) {
  return page
    .locator("section.card")
    .filter({
      has: page.getByRole("heading", { name: "Мои данные", exact: true }),
    });
}

async function settings(page: Page, persona: Persona) {
  if (persona !== "guardian")
    await page
      .getByRole("button", { name: new RegExp(personas[persona][1]) })
      .click();
  await expect(accountSection(page)).toBeVisible();
  await expect(
    accountSection(page).getByRole("button", {
      name: "Скачать мои данные",
      exact: true,
    }),
  ).toBeEnabled();
}

async function revokeFromOtherPage(
  page: Page,
  browser: Browser,
  persona: Persona,
) {
  const revoker = await browser.newPage();
  try {
    // Share only this synthetic token with a second headless page. Its real
    // logout UI revokes the session on the server; the value is never logged.
    const token = await page.evaluate(() =>
      sessionStorage.getItem("reprep.session"),
    );
    expect(Boolean(token)).toBe(true);
    await revoker.addInitScript(
      (value) => sessionStorage.setItem("reprep.session", value!),
      token,
    );
    await revoker.goto("/");
    await settings(revoker, persona);
    const revoked = revoker.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/logout" &&
        r.request().method() === "POST",
    );
    await revoker.getByRole("button", { name: "Выйти", exact: true }).click();
    expect((await revoked).status()).toBe(200);
    await expect(
      revoker.getByRole("button", { name: personas[persona][0], exact: true }),
    ).toBeVisible();
  } finally {
    await revoker.close();
  }
}

async function downloadExport(page: Page): Promise<Export> {
  const downloaded = page.waitForEvent("download");
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/account/export" &&
      r.request().method() === "GET",
  );
  await accountSection(page)
    .getByRole("button", { name: "Скачать мои данные", exact: true })
    .click();
  expect((await response).status()).toBe(200);
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("reprep-my-data.json");
  expect(await file.failure()).toBeNull();
  const filePath = await file.path();
  expect(filePath).not.toBeNull();
  const data: Export = JSON.parse(await readFile(filePath!, "utf8"));
  await expect(accountSection(page).getByRole("status")).toHaveText(
    "Файл экспорта передан браузеру",
  );
  await expect(
    accountSection(page).getByRole("button", {
      name: "Скачать мои данные",
      exact: true,
    }),
  ).toBeEnabled();
  return data;
}

function verifyPrivacy(data: Export, persona: Persona) {
  expect(data.schema_version).toBe("1");
  expect(typeof data.exported_at).toBe("string");
  expect(Number.isFinite(Date.parse(data.exported_at))).toBe(true);
  expect(Object.keys(data.account).sort()).toEqual([
    "alias",
    "demo",
    "external_id",
    "id",
    "role",
  ]);
  expect(data.account.id).toBe("demo-" + persona);
  expect(data.account.role).toBe(persona === "outsider" ? "tutor" : persona);
  expect(data.account.alias).toBe(personas[persona][1]);
  expect(data.account.demo).toBe(1);
  expect(data.account.external_id).toBeNull();
  const topLevelFields = [
    "schema_version",
    "exported_at",
    "account",
    "relationships",
    "assignments",
    "submissions",
    "materials",
    "lessons",
    "plans",
    "progress",
    "skill_graphs",
    "messages",
    "questions",
    "invitations",
    "guardian_access",
    "groups",
    "generation_requests",
    "catalog_profile",
    "catalog_requests",
    "workspace_memberships",
    "shared_templates",
    "reports",
    "audit",
    "notification_settings",
    "reminder_deliveries",
    "deletion_requests",
    ...(persona === "learner" ? ["drafts"] : []),
  ];
  expect(Object.keys(data).sort()).toEqual(topLevelFields.sort());
  const checkKeys = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(checkKeys);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      expect(key.toLowerCase()).not.toMatch(
        /^(token|token_hash|init_data|authorization|bot_token|api_key|openrouter_api_key)$/,
      );
      checkKeys(child);
    }
  };
  checkKeys(data);
  if (persona === "learner") {
    expect(data.relationships.map((relation) => relation.id)).toEqual([
      "demo-link",
    ]);
    expect(data.assignments.map((work) => work.id)).toEqual([
      "demo-assignment",
    ]);
    for (const work of data.assignments) {
      expect(work.relationship_id).toBe("demo-link");
      expect(work.tasks.length).toBeGreaterThan(0);
      for (const task of work.tasks)
        expect(Object.keys(task).sort()).toEqual([
          "id",
          "options",
          "prompt",
          "skill",
          "type",
        ]);
    }
    for (const lesson of data.lessons)
      expect(lesson).not.toHaveProperty("payment_status");
  } else if (persona === "tutor") {
    expect(data.assignments.map((work) => work.id).sort()).toEqual([
      "demo-assignment",
      "demo-assignment-2",
    ]);
    expect(data.relationships.map((relation) => relation.id).sort()).toEqual([
      "demo-link",
      "demo-link-2",
    ]);
    const allowed = new Set([
      "id",
      "type",
      "prompt",
      "options",
      "skill",
      "answer",
      "rubric",
      "hint",
    ]);
    for (const work of data.assignments)
      for (const task of work.tasks) {
        for (const key of Object.keys(task))
          expect(allowed.has(key)).toBe(true);
      }
    expect(
      data.assignments.some((work) =>
        work.tasks.some(
          (task) => typeof task.answer === "string" && task.answer.length > 0,
        ),
      ),
    ).toBe(true);
  } else {
    // These synthetic accounts have no study relationships. A valid recovery
    // must not substitute the main tutor's or a learner's exported data.
    expect(data.relationships).toEqual([]);
    expect(data.assignments).toEqual([]);
    expect(data.lessons).toEqual([]);
    expect(data.messages).toEqual([]);
  }
}

function withoutExportTime(data: Export) {
  const { exported_at: _exportedAt, ...snapshot } = data;
  return snapshot;
}

for (const persona of ["tutor", "learner", "guardian", "outsider"] as const)
  test(`account export ${persona}: revoked session downloads nothing, fresh login exports unchanged authorized data`, async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: personas[persona][0], exact: true })
      .click();
    await settings(page, persona);
    const before = await downloadExport(page);
    verifyPrivacy(before, persona);
    const files: Download[] = [];
    const received = (file: Download) => {
      files.push(file);
    };
    page.on("download", received);
    try {
      await revokeFromOtherPage(page, browser, persona);
      const denied = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/account/export" &&
          r.request().method() === "GET",
      );
      await accountSection(page)
        .getByRole("button", { name: "Скачать мои данные", exact: true })
        .click();
      expect((await denied).status()).toBe(401);
      // A real 401 needs a recovery instruction about signing in again,
      // rather than a misleading suggestion to retry the same expired token.
      await expect(accountSection(page).getByRole("alert")).toContainText(
        "Сессия завершилась. Войдите снова",
      );
      await expect(
        accountSection(page).getByRole("button", {
          name: "Скачать мои данные",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(
        accountSection(page).getByText("Файл экспорта передан браузеру", {
          exact: true,
        }),
      ).toHaveCount(0);
      expect(files).toHaveLength(0);
      await page.reload();
      await expect(
        page.getByRole("button", { name: personas[persona][0], exact: true }),
      ).toBeVisible();
      expect(files).toHaveLength(0);
      await page
        .getByRole("button", { name: personas[persona][0], exact: true })
        .click();
      await settings(page, persona);
      const after = await downloadExport(page);
      expect(files).toHaveLength(1);
      verifyPrivacy(after, persona);
      // Logout/login changes sessions, which are intentionally not exported.
      // Every exported domain record and field must remain identical.
      expect(withoutExportTime(after)).toEqual(withoutExportTime(before));
      await page.reload();
      await settings(page, persona);
      await expect(accountSection(page)).toContainText(personas[persona][1]);
      await expect(accountSection(page).getByRole("alert")).toHaveCount(0);
      expect(files).toHaveLength(1);
    } finally {
      page.off("download", received);
    }
  });
