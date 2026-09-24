import { test, expect } from "./audit-fixtures";
import type { APIRequestContext, Page } from "@playwright/test";
async function seed(request: APIRequestContext) {
  const auth = async (role: string) => ({
    Authorization:
      "Bearer " +
      (await (await request.post("/api/auth/demo/" + role)).json()).token,
  });
  const tutor = await auth("tutor"),
    outsider = await auth("outsider"),
    learner = await auth("learner");
  const make = async (headers: Record<string, string>, id: string) => {
    expect(
      (
        await request.put("/api/catalog/profile", {
          headers,
          data: {
            revision: 0,
            visible: true,
            headline: "Синтетическая физика",
            description: "Проверяем безопасный приём ученика",
            subjects: ["Физика"],
            price_rub: 500,
            duration: 60,
          },
        })
      ).ok(),
    ).toBe(true);
    const result = await request.post(`/api/catalog/${id}/requests`, {
      headers: learner,
      data: {
        offer_revision: 1,
        subject: "Физика",
        message: "Заявка только для " + id,
        client_id: crypto.randomUUID(),
      },
    });
    expect(result.ok()).toBe(true);
    return (await result.json()).id;
  };
  return {
    tutor,
    outsider,
    ownId: await make(tutor, "demo-tutor"),
    foreignId: await make(outsider, "demo-outsider"),
  };
}
async function open(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Репетиторы", exact: true }).click();
  await expect(page.getByLabel("Ответ на заявку")).toBeVisible();
}
for (const mode of ["foreign", "session"])
  test(`catalog review ${mode}: denied write does not expose or modify the other request`, async ({
    page,
    request,
  }) => {
    const fixture = await seed(request);
    await open(page);
    const text = "Мой ответ 🧪";
    await page.getByLabel("Ответ на заявку").fill(text);
    const path = `**/api/catalog/requests/${fixture.ownId}/review`;
    let denied = 0;
    if (mode === "foreign")
      await page.route(path, async (r) => {
        const response = await r.fetch({
          url: r.request().url().replace(fixture.ownId, fixture.foreignId),
        });
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
        if (r.url().endsWith("/review") && r.status() === 401) denied++;
      });
    }
    await page
      .getByRole("button", { name: "Принять ученика", exact: true })
      .click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect.poll(() => denied).toBe(1);
    await expect(page.getByLabel("Ответ на заявку")).toHaveValue(text);
    await expect(
      page.getByText("Заявка только для demo-outsider", { exact: true }),
    ).toHaveCount(0);
    const foreign = await (
      await request.get("/api/catalog/requests", { headers: fixture.outsider })
    ).json();
    expect(foreign).toHaveLength(1);
    expect(foreign[0].status).toBe("pending");
    expect(foreign[0].reply).toBe("");
    const own = await (
      await request.get("/api/catalog/requests", { headers: fixture.tutor })
    ).json();
    expect(own[0].status).toBe("pending");
    await page.unroute(path);
    await page.reload();
    if (mode === "session")
      await page
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
    await page.getByRole("button", { name: "Репетиторы", exact: true }).click();
    await page.getByLabel("Ответ на заявку").fill(text);
    await page
      .getByRole("button", { name: "Принять ученика", exact: true })
      .click();
    await expect(
      page.getByText("Преподаватель принял заявку. Учебная связь создана.", {
        exact: true,
      }),
    ).toBeVisible();
  });
for (const decision of ["same", "conflict"])
  test(`catalog two tabs ${decision}: accepted request cannot create duplicate relationships or be overwritten`, async ({
    context,
    request,
  }) => {
    const fixture = await seed(request);
    const first = await context.newPage(),
      second = await context.newPage();
    await open(first);
    await open(second);
    const snapshot = await (
      await request.get("/api/catalog/requests", { headers: fixture.tutor })
    ).json();
    await second.route("**/api/catalog/requests", (r) =>
      r.fulfill({ json: snapshot }),
    );
    await first.getByLabel("Ответ на заявку").fill("Ответ первой вкладки");
    await second
      .getByLabel("Ответ на заявку")
      .fill(
        decision === "same" ? "Ответ первой вкладки" : "Конфликтующий ответ",
      );
    await first
      .getByRole("button", { name: "Принять ученика", exact: true })
      .click();
    await expect(
      first.getByText("Преподаватель принял заявку. Учебная связь создана.", {
        exact: true,
      }),
    ).toBeVisible();
    const observed = second.waitForResponse((r) =>
      r.url().endsWith(`/catalog/requests/${fixture.ownId}/review`),
    );
    await second
      .getByRole("button", {
        name: decision === "same" ? "Принять ученика" : "Отклонить заявку",
        exact: true,
      })
      .click();
    expect((await observed).status()).toBe(decision === "same" ? 200 : 409);
    if (decision === "conflict") {
      await expect(second.getByRole("alert").first()).toContainText(
        "По заявке уже принято решение",
      );
      await expect(second.getByLabel("Ответ на заявку")).toHaveValue(
        "Конфликтующий ответ",
      );
    }
    await second.unroute("**/api/catalog/requests");
    await second.reload();
    await second
      .getByRole("button", { name: "Репетиторы", exact: true })
      .click();
    await expect(
      second.getByText("Ответ преподавателя: Ответ первой вкладки", {
        exact: true,
      }),
    ).toBeVisible();
    const links = await (
      await request.get("/api/relationships", { headers: fixture.tutor })
    ).json();
    expect(
      links.filter((r: { subject: string }) => r.subject === "Физика"),
    ).toHaveLength(1);
  });
