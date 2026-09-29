import { test, expect } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";

// U047/U050, FR-SUB-002/004: only synthetic demo work on the isolated audit
// server. Browser actions create all answers and files; routes inject faults.
test.skip(
  process.env.E2E_AUDIT !== "1" ||
    !/^http:\/\/127\.0\.0\.1:8017\/?$/.test(process.env.E2E_URL || ""),
  "Attachment fault scenarios require the isolated localhost:8017 audit server",
);

const title = "Линейные уравнения: от шага к решению";
const draftPath = "/api/assignments/demo-assignment/draft";
const draftRoute = "**" + draftPath;
const explanation = "Одинаковое вычитание сохраняет равенство. Ё <текст> & 🧪\nОбе стороны равны.";
const fileA = {
  name: "Этап A — решение Ё 🧪.txt",
  content: "  Синтетический файл A: 3x = 15\nx = 5\nСохранённая версия Ё 🧪  \n",
};
const fileB = {
  name: "Этап B — ответ е\u0308 🧪.txt",
  content: "  Синтетический файл B: 3x = 15\nx = 5\nЗамена: Ё, е\u0308, <текст> & 🧪\n  Конец B  \n",
};
type AnswerFile = typeof fileA;

async function openWork(page: Page) {
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

async function attach(page: Page, file: AnswerFile) {
  await page.getByLabel("TXT к заданию 1", { exact: true }).setInputFiles({
    name: file.name,
    mimeType: "text/plain",
    buffer: Buffer.from(file.content, "utf8"),
  });
  await expect(page.locator(".work-task").first().locator("summary")).toHaveText("Файл: " + file.name);
}

async function assertAttachment(container: Locator, file: AnswerFile) {
  const attachment = container.locator("details.original");
  await expect(attachment).toHaveCount(1);
  await expect(attachment.locator("summary")).toHaveText("Файл: " + file.name);
  if ((await attachment.getAttribute("open")) === null)
    await attachment.locator("summary").click();
  // textContent preserves whitespace, line breaks and combining characters.
  await expect(attachment.locator("pre")).toHaveJSProperty("textContent", file.content);
  return attachment;
}

async function downloadAttachment(page: Page, container: Locator, file: AnswerFile) {
  const attachment = await assertAttachment(container, file);
  const pending = page.waitForEvent("download");
  await attachment.getByRole("button", { name: "Скачать TXT", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(file.name);
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(await readFile(path!)).toEqual(Buffer.from(file.content, "utf8"));
}

async function save(page: Page) {
  const pending = page.waitForResponse(r =>
    new URL(r.url()).pathname === draftPath && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Сохранить ответы", exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  await expect(page.getByRole("status")).toHaveText("Сохранено");
  return (await response.json()).revision as number;
}

async function assertOtherAnswers(page: Page) {
  await expect(page.getByLabel("Ответ на задание 1", { exact: true })).toHaveValue("");
  await expect(page.getByRole("radio", { name: "0,75", exact: true })).toBeChecked();
  await expect(page.getByLabel("Ответ на задание 3", { exact: true })).toHaveValue(explanation);
}

async function revokeThroughUI(page: Page, revoker: Page) {
  const token = await page.evaluate(() => sessionStorage.getItem("reprep.session"));
  expect(Boolean(token)).toBe(true);
  await revoker.addInitScript(value => sessionStorage.setItem("reprep.session", value!), token);
  await revoker.goto("/");
  await revoker.getByRole("button", { name: /Саша • демо/ }).click();
  const pending = revoker.waitForResponse(r =>
    new URL(r.url()).pathname === "/api/logout" && r.request().method() === "POST",
  );
  await revoker.getByRole("button", { name: "Выйти", exact: true }).click();
  expect((await pending).status()).toBe(200);
  await expect(revoker.getByRole("button", { name: "Я ученик", exact: true })).toBeVisible();
}

async function refuseBrowserBack(page: Page) {
  const address = page.url();
  const pendingDialog = page.waitForEvent("dialog");
  const navigation = page.goBack({ waitUntil: "commit", timeout: 5000 }).catch(error => {
    // Chromium may report the deliberately cancelled document navigation.
    expect(String(error)).toMatch(/net::ERR_ABORTED|NS_BINDING_ABORTED/);
    return null;
  });
  const dialog = await pendingDialog;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await navigation;
  await expect(page).toHaveURL(address);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

async function confirmedReload(page: Page, expired: boolean) {
  const pendingDialog = page.waitForEvent("dialog");
  const session = page.waitForResponse(r => new URL(r.url()).pathname === "/api/me");
  const reload = page.reload();
  const dialog = await pendingDialog;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.accept();
  await reload;
  expect((await session).status()).toBe(expired ? 401 : 200);
  if (expired)
    await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  await openWork(page);
}

async function assertOneOriginal(page: Page) {
  await page.getByRole("button", { name: "История попыток", exact: true }).click();
  const history = page.locator(".attempt-history");
  await expect(history.locator(".assignment-row")).toHaveCount(1);
  await history.getByRole("button", { name: /^Попытка 1 / }).click();
  const detail = history.locator(".attempt-detail");
  await expect(detail.locator("details.original")).toHaveCount(1);
  await downloadAttachment(page, detail, fileB);
  await expect(detail.locator(".work-task .original p").nth(1)).toHaveJSProperty("textContent", "0,75");
  await expect(detail.locator(".work-task .original p").nth(2)).toHaveJSProperty("textContent", explanation);
}

for (const mode of ["before delivery", "lost acknowledgement", "expired session"] as const)
  test(`learner TXT replacement: ${mode} preserves local B, restores the actual server draft and submits one exact original`, async ({ page, browser }) => {
    const tutor = await browser.newPage();
    const revoker = mode === "expired session" ? await browser.newPage() : null;
    const committed = mode === "lost acknowledgement";
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let attempts = 0;
    let serverCommits = 0;
    try {
      // Two real document entries make Back a browser-history operation.
      // No pushState, window-owner input or in-app "К заданиям" substitute.
      await page.goto("/?audit-attachment-previous=1");
      await page.goto("/?audit-attachment-current=" + encodeURIComponent(mode));
      await page.getByRole("button", { name: "Я ученик", exact: true }).click();
      await openWork(page);
      await page.getByRole("radio", { name: "0,75", exact: true }).check();
      await page.getByLabel("Ответ на задание 3", { exact: true }).fill(explanation);
      await attach(page, fileA);
      const baselineRevision = await save(page);
      await assertAttachment(page.locator(".work-task").first(), fileA);
      await assertOtherAnswers(page);

      if (revoker) await revokeThroughUI(page, revoker);
      await page.route(draftRoute, async route => {
        expect(route.request().method()).toBe("PUT");
        attempts++;
        const body = route.request().postDataJSON();
        expect(body.revision).toBe(baselineRevision);
        expect(body.attachments).toEqual({ linear: { file_name: fileB.name, content: fileB.content } });
        await gate;
        if (revoker) {
          // Deliver the ordinary UI request unchanged to the genuinely revoked session.
          await route.continue();
        } else {
          if (committed && serverCommits === 0) {
            const response = await route.fetch();
            expect(response.status()).toBe(200);
            expect((await response.json()).revision).toBe(baselineRevision + 1);
            serverCommits++;
          }
          await route.abort("connectionreset");
        }
      });
      await attach(page, fileB);
      const rejected = revoker ? page.waitForResponse(r =>
        new URL(r.url()).pathname === draftPath && r.request().method() === "PUT",
      ) : null;
      const saveButton = page.getByRole("button", { name: "Сохранить ответы", exact: true });
      await saveButton.dblclick({ delay: 40 });
      await expect.poll(() => attempts).toBe(1);
      await expect(saveButton).toBeDisabled();
      await expect(page.getByLabel("TXT к заданию 1", { exact: true })).toBeDisabled();
      await expect(page.getByRole("status")).toHaveText("Сохраняем…");
      release();
      if (rejected) expect((await rejected).status()).toBe(401);
      await expect(page.locator(".save-error")).toContainText(
        revoker ? "Сессия завершилась. Войдите снова" : "Не удалось связаться с сервером",
      );
      expect(attempts).toBe(1);
      expect(serverCommits).toBe(committed ? 1 : 0);
      await expect(page.getByRole("status")).toContainText("Есть несохранённые ответы");
      await expect(saveButton).toBeEnabled();
      await expect(page.getByRole("button", { name: /^История попыток/ })).toHaveCount(0);
      await downloadAttachment(page, page.locator(".work-task").first(), fileB);
      await assertOtherAnswers(page);

      await refuseBrowserBack(page);
      await assertAttachment(page.locator(".work-task").first(), fileB);
      await assertOtherAnswers(page);
      // Keep the PUT fault installed through reload and the server-state
      // oracle. Removing it earlier could allow autosave to persist B itself.
      await confirmedReload(page, Boolean(revoker));
      await assertAttachment(page.locator(".work-task").first(), committed ? fileB : fileA);
      await assertOtherAnswers(page);
      await expect(page.getByRole("button", { name: /^История попыток/ })).toHaveCount(0);
      expect(attempts).toBe(1);
      await page.unroute(draftRoute);

      if (!committed) {
        // Reload intentionally discards unsaved B. The learner selects it again.
        await attach(page, fileB);
        await save(page);
      }
      await assertAttachment(page.locator(".work-task").first(), fileB);
      const submitted = page.waitForResponse(r =>
        new URL(r.url()).pathname === "/api/assignments/demo-assignment/submit" && r.request().method() === "POST",
      );
      page.once("dialog", async dialog => {
        expect(dialog.type()).toBe("confirm");
        expect(dialog.message()).toBe("Отправить работу преподавателю? Сохранённые ответы останутся в истории.");
        await dialog.accept();
      });
      await page.getByRole("button", { name: "Отправить работу", exact: true }).click();
      expect((await submitted).status()).toBe(200);
      await expect(page.getByRole("button", { name: "Отправить работу", exact: true })).toHaveCount(0);
      await page.reload();
      await openWork(page);
      await assertOneOriginal(page);

      await tutor.goto("/");
      await tutor.getByRole("button", { name: "Я преподаватель", exact: true }).click();
      await openWork(tutor);
      await assertOneOriginal(tutor);
    } finally {
      release();
      await page.unroute(draftRoute);
      await revoker?.close();
      await tutor.close();
    }
  });
