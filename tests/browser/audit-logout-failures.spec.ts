import { test, expect } from "./audit-fixtures";
const roles = {
  tutor: ["Я преподаватель", "Алекс • демо"],
  learner: ["Я ученик", "Саша • демо"],
  guardian: ["Я родитель", "Родитель • демо"],
  outsider: ["Другой преподаватель · демо", "Другой репетитор • демо"],
};
for (const [role, [button, alias]] of Object.entries(roles))
  for (const failure of ["expired", "offline", "lost-ack"])
    test(`logout ${role} ${failure}: local identity and cached screens are cleared despite failed server acknowledgement`, async ({
      page,
      request,
    }) => {
      await page.goto("/");
      await page.getByRole("button", { name: button, exact: true }).click();
      if (role !== "guardian")
        await page.getByRole("button", { name: new RegExp(alias) }).click();
      if (role === "guardian")
        await expect(
          page.getByRole("heading", { name: "Кабинет родителя", exact: true }),
        ).toBeVisible();
      const oldToken = await page.evaluate(() =>
        sessionStorage.getItem("reprep.session"),
      );
      if (failure === "expired")
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
      else
        await page.route("**/api/logout", async (r) => {
          if (failure === "lost-ack")
            expect((await r.fetch()).status()).toBe(200);
          await r.abort("connectionreset");
        });
      await page.getByRole("button", { name: "Выйти", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Я ученик", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => sessionStorage.getItem("reprep.session")),
      ).toBeFalsy();
      await expect(
        page.getByRole("heading", { name: "Кабинет родителя", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: new RegExp(alias) }),
      ).toHaveCount(0);
      await expect(page.getByRole("alert").first()).toContainText(
        "Не удалось подтвердить отзыв сессии на сервере",
      );
      const oldSession = await request.get("/api/me", {
        headers: { Authorization: "Bearer " + oldToken },
      });
      expect(oldSession.status()).toBe(failure === "offline" ? 200 : 401);
      await page.unroute("**/api/logout");
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Я ученик", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Я ученик", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /Дроби и уравнения: самостоятельная работа/,
        }),
      ).toHaveCount(0);
    });
