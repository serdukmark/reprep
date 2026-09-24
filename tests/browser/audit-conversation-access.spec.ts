import { test, expect } from "./audit-fixtures";
import type { APIRequestContext } from "@playwright/test";
async function login(request: APIRequestContext, role: string) {
  const r = await request.post("/api/auth/demo/" + role);
  expect(r.ok()).toBe(true);
  return { Authorization: "Bearer " + (await r.json()).token };
}
async function foreignConversation(request: APIRequestContext) {
  const th = await login(request, "outsider");
  const l = await request.post("/__audit__/identity/learner");
  expect(l.ok()).toBe(true);
  const lh = { Authorization: "Bearer " + (await l.json()).token };
  const inv = await request.post("/api/invitations", {
    headers: th,
    data: { subject: "Синтетический чужой предмет" },
  });
  expect(inv.ok()).toBe(true);
  expect(
    (
      await request.post("/api/invitations/accept", {
        headers: lh,
        data: { token: (await inv.json()).token },
      })
    ).ok(),
  ).toBe(true);
  const links = await request.get("/api/relationships", { headers: th });
  const link = (await links.json())[0].id;
  const work = await request.post("/api/assignments", {
    headers: th,
    data: {
      relationship_id: link,
      title: "Чужая синтетическая работа",
      tasks: [
        {
          id: "linear",
          type: "numeric",
          prompt: "Сколько будет 2+3?",
          answer: "5",
          skill: "Сложение",
        },
      ],
    },
  });
  expect(work.ok()).toBe(true);
  const aid = (await work.json()).id;
  expect(
    (
      await request.post("/api/assignments/" + aid + "/publish", {
        headers: th,
      })
    ).ok(),
  ).toBe(true);
  const marker = "Приватная переписка другого ученика 🧪";
  expect(
    (
      await request.post(`/api/assignments/${aid}/messages`, {
        headers: th,
        data: { client_id: crypto.randomUUID(), text: marker },
      })
    ).ok(),
  ).toBe(true);
  const question = await request.post(`/api/assignments/${aid}/questions`, {
    headers: lh,
    data: { client_id: crypto.randomUUID(), task_id: "linear", text: marker },
  });
  expect(question.ok()).toBe(true);
  return { aid, qid: (await question.json()).id, headers: th, marker };
}
const roles = { learner: "Я ученик", tutor: "Я преподаватель" };
for (const role of ["learner", "tutor"] as const)
  for (const resource of ["messages", "questions"])
    test(`${role} cannot read foreign ${resource} through the visible work`, async ({
      page,
      request,
    }) => {
      const foreign = await foreignConversation(request);
      await page.goto("/");
      await page
        .getByRole("button", { name: roles[role], exact: true })
        .click();
      const path = `**/api/assignments/demo-assignment/${resource}`;
      let denied = 0;
      await page.route(path, async (r) => {
        const response = await r.fetch({
          url: r
            .request()
            .url()
            .replace("/demo-assignment/", `/${foreign.aid}/`),
        });
        expect(response.status()).toBe(404);
        denied++;
        await r.fulfill({ response });
      });
      await page
        .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
        .click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expect.poll(() => denied).toBeGreaterThan(0);
      await expect(page.getByText(foreign.marker, { exact: true })).toHaveCount(
        0,
      );
      await page.unroute(path);
      await page.reload();
      await page
        .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
        .click();
      await expect(
        page.getByText(
          resource === "messages"
            ? "Сообщений пока нет."
            : "Вопросов пока нет.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(page.getByText(foreign.marker, { exact: true })).toHaveCount(
        0,
      );
    });
for (const [role, kind] of [
  ["learner", "messages"],
  ["tutor", "messages"],
  ["learner", "questions"],
  ["tutor", "review"],
] as const)
  for (const mode of ["foreign", "session"])
    test(`${role} ${kind} ${mode}: visible refusal, retained input and authorized recovery`, async ({
      page,
      request,
    }) => {
      const foreign =
        mode === "foreign" ? await foreignConversation(request) : null;
      const owner = await login(request, "tutor");
      let ownQ = "";
      if (kind === "review") {
        const learner = await login(request, "learner");
        const q = await request.post(
          "/api/assignments/demo-assignment/questions",
          {
            headers: learner,
            data: {
              task_id: "linear",
              text: "Мой вопрос для проверки",
              client_id: crypto.randomUUID(),
            },
          },
        );
        expect(q.ok()).toBe(true);
        ownQ = (await q.json()).id;
      }
      await page.goto("/");
      await page
        .getByRole("button", { name: roles[role], exact: true })
        .click();
      const open = () =>
        page
          .getByRole("button", {
            name: /Линейные уравнения: от шага к решению/,
          })
          .click();
      await open();
      const field = page.getByRole("textbox", {
        name:
          kind === "messages"
            ? "Сообщение по заданию"
            : kind === "questions"
              ? "Вопрос к AI"
              : "Ответ преподавателя на вопрос",
        exact: true,
      });
      const send = page.getByRole("button", {
        name:
          kind === "messages"
            ? "Отправить сообщение"
            : kind === "questions"
              ? "Задать вопрос"
              : "Подтвердить и отправить ответ",
        exact: true,
      });
      const text = "Только моя переписка <>& 🧪";
      await field.fill(text);
      const path =
        kind === "review"
          ? `**/api/questions/${ownQ}/review`
          : `**/api/assignments/demo-assignment/${kind}`;
      let denied = 0;
      if (foreign)
        await page.route(path, async (r) => {
          if (r.request().method() !== "POST") return r.continue();
          const url =
            kind === "review"
              ? r.request().url().replace(ownQ, foreign.qid)
              : r
                  .request()
                  .url()
                  .replace("/demo-assignment/", `/${foreign.aid}/`);
          const response = await r.fetch({ url });
          expect(response.status()).toBe(404);
          denied++;
          await r.fulfill({ response });
        });
      else {
        expect(
          await page.evaluate(
            async () =>
              (
                await fetch("/api/logout", {
                  method: "POST",
                  headers: {
                    Authorization:
                      "Bearer " + sessionStorage.getItem("reprep.session"),
                  },
                })
              ).status,
          ),
        ).toBe(200);
        page.on("response", (r) => {
          if (r.request().method() === "POST" && r.status() === 401) denied++;
        });
      }
      await send.click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expect.poll(() => denied).toBeGreaterThan(0);
      await expect(field).toHaveValue(text);
      if (foreign) {
        const resource = kind === "messages" ? "messages" : "questions";
        const result = await request.get(
          `/api/assignments/${foreign.aid}/${resource}`,
          { headers: foreign.headers },
        );
        expect(result.ok()).toBe(true);
        const rows = await result.json();
        expect(rows).toHaveLength(1);
        expect(rows[0][resource === "messages" ? "text" : "question"]).toBe(
          foreign.marker,
        );
        if (resource === "questions") expect(rows[0].response).toBeNull();
        await page.unroute(path);
      } else {
        page.once("dialog", (d) => d.accept());
        await page.reload();
        await page
          .getByRole("button", { name: roles[role], exact: true })
          .click();
        await open();
        await field.fill(text);
      }
      await send.dblclick();
      if (kind === "review") await expect(field).toHaveCount(0);
      else await expect(field).toHaveValue("");
      await page.reload();
      await open();
      await expect(
        page.getByText(
          kind === "review" ? "Ответ проверен преподавателем: " + text : text,
          { exact: true },
        ),
      ).toHaveCount(1);
      const result = await request.get(
        "/api/assignments/demo-assignment/" +
          (kind === "messages" ? "messages" : "questions"),
        { headers: owner },
      );
      expect(result.ok()).toBe(true);
      expect(await result.json()).toHaveLength(1);
    });
