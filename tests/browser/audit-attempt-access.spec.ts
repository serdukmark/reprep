import { test, expect } from "./audit-fixtures";
for (const role of ["learner", "tutor"])
  for (const resource of ["list", "detail"])
    test(`attempt history ${role} rejects foreign ${resource} ID and recovers own history`, async ({
      page,
      request,
    }) => {
      const auth = async (path: string) => {
        const r = await request.post(path);
        expect(r.ok()).toBe(true);
        return { Authorization: "Bearer " + (await r.json()).token };
      };
      const th = await auth("/api/auth/demo/outsider");
      const lh = await auth("/__audit__/identity/learner");
      const inv = await request.post("/api/invitations", {
        headers: th,
        data: { subject: "Приватный предмет" },
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
      const links = await (
        await request.get("/api/relationships", { headers: th })
      ).json();
      const work = await request.post("/api/assignments", {
        headers: th,
        data: {
          relationship_id: links[0].id,
          title: "Чужой архив",
          tasks: [
            {
              id: "linear",
              type: "short_text",
              prompt: "Объясните свой ответ",
              rubric: "Связное объяснение",
              skill: "Объяснение",
            },
          ],
        },
      });
      expect(work.ok()).toBe(true);
      const aid = (await work.json()).id;
      expect(
        (
          await request.post(`/api/assignments/${aid}/publish`, { headers: th })
        ).ok(),
      ).toBe(true);
      const marker = "Чужое приватное объяснение 🧪";
      const sub = await request.post(`/api/assignments/${aid}/submit`, {
        headers: lh,
        data: { revision: 0, answers: { linear: marker } },
      });
      expect(sub.ok()).toBe(true);
      const sid = (await sub.json()).id;
      // Own work is submitted through UI; foreign data above is fixture setup only.
      await page.goto("/");
      await page.getByRole("button", { name: "Я ученик", exact: true }).click();
      const title = /Линейные уравнения: от шага к решению/;
      await page.getByRole("button", { name: title }).click();
      await page.getByLabel("Ответ на задание 1").fill("5");
      await page.getByRole("radio", { name: "0,75", exact: true }).check();
      await page.getByLabel("Ответ на задание 3").fill("Своё объяснение");
      await expect(page.getByRole("status")).toHaveText("Сохранено");
      page.once("dialog", (d) => d.accept());
      await page
        .getByRole("button", { name: "Отправить работу", exact: true })
        .click();
      await expect(page.locator(".work-task .original p").first()).toHaveText(
        "5",
      );
      if (role === "tutor") {
        await page.getByRole("button", { name: /Саша • демо/ }).click();
        await page.getByRole("button", { name: "Выйти", exact: true }).click();
        await page
          .getByRole("button", { name: "Я преподаватель", exact: true })
          .click();
        await page.getByRole("button", { name: title }).click();
      }
      const pattern =
        resource === "list"
          ? "**/api/assignments/demo-assignment/attempts?*"
          : "**/api/submissions/*";
      let denied = 0;
      await page.route(pattern, async (r) => {
        const url =
          resource === "list"
            ? new URL(
                `/api/assignments/${aid}/attempts?offset=0`,
                r.request().url(),
              ).href
            : new URL(`/api/submissions/${sid}`, r.request().url()).href;
        const response = await r.fetch({ url });
        expect(response.status()).toBe(404);
        denied++;
        expect(await response.text()).not.toContain(marker);
        await r.fulfill({ response });
      });
      await page
        .getByRole("button", { name: "История попыток", exact: true })
        .click();
      const history = page.locator(".attempt-history");
      if (resource === "detail")
        await history.getByRole("button", { name: /Попытка 1/ }).click();
      await expect(history.getByRole("alert")).toBeVisible();
      expect(denied).toBe(1);
      await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
      await expect(page.locator(".attempt-detail")).toHaveCount(0);
      await page.unroute(pattern);
      await page.reload();
      await page.getByRole("button", { name: title }).click();
      await page
        .getByRole("button", { name: "История попыток", exact: true })
        .click();
      await history.getByRole("button", { name: /Попытка 1/ }).click();
      await expect(
        page.locator(".attempt-detail .original p").first(),
      ).toHaveText("5");
      await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
    });
