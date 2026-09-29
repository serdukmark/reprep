import { test, expect, choose } from "./audit-fixtures";
import { createHmac, randomInt } from "node:crypto";
import type { Page } from "@playwright/test";

function signedLaunch(id: number) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: "Синтетический" }),
    query_id: "audit-third-workspace-member",
  };
  const key = createHmac("sha256", "WebAppData")
    .update("synthetic-max-test-token")
    .digest();
  const hash = createHmac("sha256", key)
    .update(
      Object.entries(fields)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => key + "=" + value)
        .join("\n"),
    )
    .digest("hex");
  return (
    "/#WebAppData=" +
    encodeURIComponent(new URLSearchParams({ ...fields, hash }).toString())
  );
}

async function registerTutor(page: Page, alias: string) {
  await page.route("https://st.max.ru/js/max-web-app.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.WebApp={initData:""}',
    }),
  );
  await page.route("https://telegram.org/js/telegram-web-app.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}',
    }),
  );
  await page.goto(signedLaunch(randomInt(100_000_000_000, 900_000_000_000)));
  await page.getByLabel("Как к вам обращаться").fill(alias);
  await page
    .locator(".registration-role")
    .filter({ has: page.getByRole("radio", { name: /^Преподаватель/ }) })
    .click();
  const authenticated = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/auth/max" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Войти через MAX", exact: true })
    .click();
  const response = await authenticated;
  expect(response.status()).toBe(200);
  const identity = (await response.json()).user;
  expect(identity.role).toBe("tutor");
  expect(identity.alias).toBe(alias);
  expect(identity.demo).toBeFalsy();
  await expect(
    page.getByRole("button", { name: new RegExp(alias) }),
  ).toBeVisible();
  return identity.id as string;
}

function workspacePanel(page: Page) {
  return page
    .locator("section.card")
    .filter({
      has: page.getByRole("heading", {
        name: "Пространства преподавателей",
        exact: true,
      }),
    });
}

async function openWorkspaces(page: Page) {
  const loaded = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/workspaces" &&
      r.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  const response = await loaded;
  expect(response.status()).toBe(200);
  await expect(workspacePanel(page)).toBeVisible();
  return response.json();
}

async function reloadWorkspaces(page: Page) {
  await page.reload();
  return openWorkspaces(page);
}

async function invite(page: Page) {
  const response = page.waitForResponse(
    (r) =>
      /\/api\/workspaces\/[^/]+\/invite$/.test(new URL(r.url()).pathname) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Пригласить коллегу", exact: true })
    .click();
  expect((await response).status()).toBe(200);
  await expect(page.getByLabel("Код для коллеги")).toBeVisible();
  return page.getByLabel("Код для коллеги").inputValue();
}

async function accept(page: Page, code: string, expectedStatus: number) {
  await page.getByLabel("Код пространства", { exact: true }).fill(code);
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/workspaces/accept" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Вступить в пространство", exact: true })
    .click();
  const received = await response;
  expect(received.status()).toBe(expectedStatus);
  return received.json();
}

async function membership(page: Page, id: string) {
  await page.reload();
  const members = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === `/api/workspaces/${id}/members` &&
      r.request().method() === "GET",
  );
  const templates = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === `/api/workspaces/${id}/templates` &&
      r.request().method() === "GET",
  );
  const spaces = await openWorkspaces(page);
  const [memberResponse, templateResponse] = await Promise.all([
    members,
    templates,
  ]);
  expect(memberResponse.status()).toBe(200);
  expect(templateResponse.status()).toBe(200);
  return {
    spaces,
    members: await memberResponse.json(),
    templates: await templateResponse.json(),
  };
}

test("used workspace invitation refuses a third nonmember; a fresh invitation grants exactly one shared library", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.E2E_AUDIT !== "1",
    "Requires the isolated local audit server and synthetic signing key",
  );
  const owner = await browser.newPage(),
    colleague = await browser.newPage();
  const ownerAlias = "Владелец библиотеки аудит";
  const colleagueAlias = "Первый коллега аудит";
  const thirdAlias = "Третий преподаватель аудит";
  const title = "Закрытая методическая библиотека 🧪";
  const templateTitle = "Приватный шаблон для участников 🧪";
  try {
    // All three identities use locally signed registration and have matching
    // demo=false scope. No real people, live MAX, external scripts, API setup
    // writes or AI calls are involved. Using one real-mode identity with a demo
    // owner would test the demo-scope guard instead of consumed-invitation ownership.
    const ownerId = await registerTutor(owner, ownerAlias);
    const colleagueId = await registerTutor(colleague, colleagueAlias);
    const thirdId = await registerTutor(page, thirdAlias);
    expect(new Set([ownerId, colleagueId, thirdId]).size).toBe(3);
    await owner
      .getByRole("button", { name: "Создать задание", exact: true })
      .click();
    await owner.getByLabel("Название работы").fill(templateTitle);
    await owner
      .getByLabel("Условие", { exact: true })
      .fill("Приватное условие шаблона: сколько будет 2+3?");
    await owner.getByLabel("Эталонный ответ", { exact: true }).fill("5");
    await owner.getByLabel("Навык", { exact: true }).fill("Сложение");
    const draft = owner.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/assignments" &&
        r.request().method() === "POST",
    );
    await owner
      .getByRole("button", { name: "Сохранить черновик", exact: true })
      .click();
    const draftResponse = await draft;
    expect(draftResponse.ok()).toBe(true);
    const assignmentId = (await draftResponse.json()).id as string;
    await expect(
      owner.getByRole("heading", { name: templateTitle, exact: true }),
    ).toBeVisible();
    expect(await openWorkspaces(owner)).toEqual([]);
    await owner.getByLabel("Название пространства").fill(title);
    const created = owner.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/workspaces" &&
        r.request().method() === "POST",
    );
    await owner
      .getByRole("button", { name: "Создать пространство", exact: true })
      .click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(201);
    const workspaceId = (await createdResponse.json()).id as string;
    await choose(
      owner.getByRole("combobox", {
        name: "Моя работа для шаблона",
        exact: true,
      }),
      assignmentId,
    );
    await owner
      .getByRole("button", { name: "Поделиться с участниками", exact: true })
      .click();
    await expect(
      workspacePanel(owner)
        .locator(".form-actions strong")
        .filter({ hasText: templateTitle }),
    ).toHaveCount(1);
    const usedCode = await invite(owner);
    expect(await openWorkspaces(colleague)).toEqual([]);
    expect((await accept(colleague, usedCode, 200)).id).toBe(workspaceId);
    await expect(
      colleague.getByRole("combobox", {
        name: "Текущее пространство",
        exact: true,
      }),
    ).toHaveText(title);
    await expect(
      workspacePanel(colleague)
        .locator(".form-actions strong")
        .filter({ hasText: templateTitle }),
    ).toHaveCount(1);
    const before = await membership(owner, workspaceId);
    expect(
      before.members.map((item: { id: string }) => item.id).sort(),
    ).toEqual([ownerId, colleagueId].sort());
    expect(before.templates).toHaveLength(1);
    expect(before.templates[0].title).toBe(templateTitle);
    expect(await openWorkspaces(page)).toEqual([]);

    const denial = await accept(page, usedCode, 409);
    expect(denial.error.code).toBe("INVITE");
    await expect(workspacePanel(page).getByRole("alert")).toContainText(
      "Приглашение уже принято",
    );
    await expect(
      page.getByLabel("Код пространства", { exact: true }),
    ).toHaveValue(usedCode);
    await expect(
      page.getByRole("combobox", { name: "Текущее пространство", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(templateTitle, { exact: true })).toHaveCount(0);
    await expect(
      workspacePanel(page).getByText(ownerAlias, { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Создать мой черновик", exact: true }),
    ).toHaveCount(0);
    expect(await reloadWorkspaces(page)).toEqual([]);
    await expect(page.getByText(templateTitle, { exact: true })).toHaveCount(0);
    expect(await membership(owner, workspaceId)).toEqual(before);
    await expect(
      owner.getByRole("button", {
        name: "Исключить " + thirdAlias,
        exact: true,
      }),
    ).toHaveCount(0);

    const freshCode = await invite(owner);
    expect(freshCode).not.toBe(usedCode);
    expect((await accept(page, freshCode, 200)).id).toBe(workspaceId);
    await expect(
      page.getByRole("combobox", { name: "Текущее пространство", exact: true }),
    ).toHaveText(title);
    await expect(
      workspacePanel(page)
        .locator(".form-actions strong")
        .filter({ hasText: templateTitle }),
    ).toHaveCount(1);
    // Repeat the new invitation as its legitimate recipient, then reload.
    // The old invitation still belongs to the first colleague.
    expect((await accept(page, freshCode, 200)).id).toBe(workspaceId);
    const after = await membership(page, workspaceId);
    expect(after.spaces).toEqual([
      { id: workspaceId, title, owner_id: ownerId },
    ]);
    expect(after.members.map((item: { id: string }) => item.id).sort()).toEqual(
      [ownerId, colleagueId, thirdId].sort(),
    );
    expect(after.templates).toEqual(before.templates);
    await expect(
      workspacePanel(page)
        .locator(".form-actions strong")
        .filter({ hasText: templateTitle }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Создать мой черновик", exact: true }),
    ).toHaveCount(1);
    await expect(
      workspacePanel(page).getByText(ownerAlias, { exact: true }),
    ).toHaveCount(1);
    await expect(
      workspacePanel(page).getByText(colleagueAlias, { exact: true }),
    ).toHaveCount(1);
    const ownerAfter = await membership(owner, workspaceId);
    expect(
      ownerAfter.members.map((item: { id: string }) => item.id).sort(),
    ).toEqual([ownerId, colleagueId, thirdId].sort());
    await expect(
      owner.getByRole("button", {
        name: "Исключить " + thirdAlias,
        exact: true,
      }),
    ).toHaveCount(1);
    expect((await membership(colleague, workspaceId)).templates).toEqual(
      before.templates,
    );
  } finally {
    await owner.close();
    await colleague.close();
  }
});
