import { test, expect, choose } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
test("learner cannot download another learner material by substituted file id", async ({
  page,
  request,
}) => {
  const login = await request.post("/api/auth/demo/tutor");
  const headers = { Authorization: "Bearer " + (await login.json()).token };
  const ids: string[] = [];
  for (const [relationship_id, file_name, content] of [
    ["demo-link", "own.txt", "Мой конспект"],
    ["demo-link-2", "foreign.txt", "Приватный конспект другого ученика"],
  ]) {
    const r = await request.post("/api/materials", {
      headers,
      data: { relationship_id, title: file_name, file_name, content },
    });
    expect(r.ok()).toBeTruthy();
    ids.push((await r.json()).id);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  await page.getByRole("button", { name: "Материалы", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Скачать foreign.txt", exact: true }),
  ).toHaveCount(0);
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.route("**/api/materials/" + ids[0] + "/file", (route) =>
    route.continue({ url: route.request().url().replace(ids[0], ids[1]) }),
  );
  await page
    .getByRole("button", { name: "Скачать own.txt", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(downloads).toBe(0);
  await expect(
    page.getByText("Приватный конспект другого ученика", { exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/materials/" + ids[0] + "/file");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Скачать own.txt", exact: true })
    .click();
  const file = await download;
  expect(await readFile((await file.path())!, "utf8")).toBe("Мой конспект");
});
test("colleague sees shared templates but substituted private workspace is rejected visibly", async ({
  page,
  request,
}) => {
  const login = await request.post("/api/auth/demo/tutor"),
    colleague = await request.post("/api/auth/demo/outsider");
  const headers = { Authorization: "Bearer " + (await login.json()).token },
    other = { Authorization: "Bearer " + (await colleague.json()).token };
  const spaces: string[] = [],
    templates: string[] = [];
  for (const title of ["Приватная библиотека", "Общая библиотека"]) {
    const w = await request.post("/api/workspaces", {
      headers,
      data: { title },
    });
    expect(w.ok()).toBeTruthy();
    const wid = (await w.json()).id;
    spaces.push(wid);
    const assignment = await request.post("/api/assignments", {
      headers,
      data: {
        relationship_id: "demo-link",
        title,
        tasks: [
          {
            id: "x",
            type: "numeric",
            prompt: "2+3?",
            answer: "5",
            skill: "Сложение",
          },
        ],
      },
    });
    expect(assignment.ok()).toBeTruthy();
    const shared = await request.post("/api/workspaces/" + wid + "/templates", {
      headers,
      data: { assignment_id: (await assignment.json()).id },
    });
    expect(shared.ok()).toBeTruthy();
    templates.push((await shared.json()).id);
  }
  const invite = await request.post(
    "/api/workspaces/" + spaces[1] + "/invite",
    { headers },
  );
  expect(
    (
      await request.post("/api/workspaces/accept", {
        headers: other,
        data: { token: (await invite.json()).token },
      })
    ).ok(),
  ).toBeTruthy();
  const learner = await request.post("/api/auth/demo/learner");
  const learnerHeaders = {
    Authorization: "Bearer " + (await learner.json()).token,
  };
  const invitation = await request.post("/api/invitations", {
    headers: other,
    data: { subject: "Занятия коллеги" },
  });
  expect(
    (
      await request.post("/api/invitations/accept", {
        headers: learnerHeaders,
        data: { token: (await invitation.json()).token },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await expect(
    page
      .locator(".form-actions strong")
      .filter({ hasText: "Общая библиотека" }),
  ).toBeVisible();
  await expect(
    page.getByText("Приватная библиотека", { exact: true }),
  ).toHaveCount(0);
  await choose(
    page.getByRole("combobox", { name: "Мой ученик для копии", exact: true }),
    { index: 1 },
  );
  await page.route(
    "**/api/workspace-templates/" + templates[1] + "/copy",
    (route) =>
      route.continue({
        url: route.request().url().replace(templates[1], templates[0]),
      }),
  );
  await page
    .getByRole("button", { name: "Создать мой черновик", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Редактирование работы", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/workspace-templates/" + templates[1] + "/copy");
  await page.route("**/api/workspaces/" + spaces[1] + "/templates", (route) =>
    route.continue({
      url: route.request().url().replace(spaces[1], spaces[0]),
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(
    page.getByText("Приватная библиотека", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".form-actions strong")
      .filter({ hasText: "Общая библиотека" }),
  ).toHaveCount(0);
});

test("linked parent cannot open child work or material, see payment notes or change lessons", async ({
  page,
  request,
}) => {
  const login = await request.post("/api/auth/demo/tutor");
  const headers = { Authorization: "Bearer " + (await login.json()).token };
  const file = await request.post("/api/materials", {
    headers,
    data: {
      relationship_id: "demo-link",
      title: "Приватный материал",
      file_name: "private.txt",
      content: "Приватный текст ребёнка",
    },
  });
  expect(file.ok()).toBeTruthy();
  const mid = (await file.json()).id;
  const invite = await request.post("/api/relationships/demo-link/guardians", {
    headers,
  });
  expect(invite.ok()).toBeTruthy();
  const lesson = {
    relationship_id: "demo-link",
    title: "Занятие ребёнка",
    starts_at: "2026-12-31T15:00:00Z",
    payment_status: "paid",
  };
  expect(
    (await request.post("/api/lessons", { headers, data: lesson })).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await page.getByRole("button", { name: "Я родитель", exact: true }).click();
  await page
    .getByLabel("Код приглашения родителю")
    .fill((await invite.json()).token);
  await page
    .getByRole("button", { name: "Принять доступ", exact: true })
    .click();
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  await expect(
    page.getByRole("heading", { name: "Расписание ученика", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Оплачено", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Материалы", exact: true }),
  ).toHaveCount(0);
  const result = await page.evaluate(
    async ({ mid, lesson }) => {
      const headers = {
        Authorization: "Bearer " + sessionStorage.getItem("reprep.session"),
        "Content-Type": "application/json",
      };
      const work = await fetch("/api/assignments/demo-assignment", { headers }),
        file = await fetch("/api/materials/" + mid + "/file", { headers }),
        write = await fetch("/api/lessons", {
          headers,
          method: "POST",
          body: JSON.stringify(lesson),
        }),
        summary = await fetch("/api/guardian/links/demo-link", { headers });
      return {
        work: work.status,
        file: file.status,
        write: write.status,
        summary: await summary.json(),
      };
    },
    { mid, lesson },
  );
  expect(result.work).toBe(404);
  expect(result.file).toBe(404);
  expect(result.write).toBe(403);
  expect(JSON.stringify(result.summary)).not.toContain("payment_status");
  expect(JSON.stringify(result.summary)).not.toContain(
    "Приватный текст ребёнка",
  );
});
