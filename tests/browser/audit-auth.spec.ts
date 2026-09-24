import { test, expect } from "./audit-fixtures";
import { createHmac } from "node:crypto";
function signed(platform: string, id: number, expired = false) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000) - (expired ? 86400 : 0)),
    user: JSON.stringify({ id, first_name: "Синтетический" }),
    query_id: "audit",
  };
  const key = createHmac("sha256", "WebAppData")
    .update(
      platform === "MAX"
        ? "synthetic-max-test-token"
        : "synthetic-tg-test-token",
    )
    .digest();
  const hash = createHmac("sha256", key)
    .update(
      Object.entries(fields)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => k + "=" + v)
        .join("\n"),
    )
    .digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
for (const platform of ["MAX", "Telegram"]) {
  for (const role of ["Преподаватель", "Ученик", "Родитель"])
    test(`${platform} simulator registration role ${role} and durable logout`, async ({
      page,
    }) => {
      const raw = signed(platform, Date.now());
      await page.route("https://st.max.ru/js/max-web-app.js", (r) =>
        r.fulfill({ body: 'window.WebApp={initData:""}' }),
      );
      await page.route("https://telegram.org/js/telegram-web-app.js", (r) =>
        r.fulfill({
          body: 'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}',
        }),
      );
      await page.goto(
        "/#" +
          (platform === "MAX" ? "WebAppData" : "tgWebAppData") +
          "=" +
          encodeURIComponent(raw),
      );
      await page.getByLabel("Как к вам обращаться").fill("Аудит роли 🧪");
      await expect(page.getByRole("radio")).toHaveCount(3);
      await expect(
        page.getByRole("radio", { name: /Организатор/ }),
      ).toHaveCount(0);
      await page
        .locator(".registration-role")
        .filter({
          has: page.getByRole("radio", { name: new RegExp("^" + role) }),
        })
        .click();
      await expect(
        page.getByRole("radio", { name: new RegExp("^" + role) }),
      ).toBeChecked();
      await page
        .getByRole("button", { name: "Войти через " + platform, exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name:
            role === "Родитель"
              ? "Кабинет родителя"
              : role === "Ученик"
                ? "Ваш следующий шаг."
                : "Хороший день, чтобы учить.",
          exact: true,
        }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name:
            role === "Родитель"
              ? "Кабинет родителя"
              : role === "Ученик"
                ? "Ваш следующий шаг."
                : "Хороший день, чтобы учить.",
          exact: true,
        }),
      ).toBeVisible();
      if (role !== "Родитель")
        await page.getByRole("button", { name: /Аудит роли/ }).click();
      await page.getByRole("button", { name: "Выйти", exact: true }).click();
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Я преподаватель", exact: true }),
      ).toBeVisible();
    });
  for (const invalid of ["expired", "duplicate", "forged"])
    test(`${platform} simulator rejects ${invalid} identity`, async ({
      page,
    }) => {
      let raw = signed(platform, 123456, invalid === "expired");
      if (invalid === "duplicate") raw += "&user={}";
      if (invalid === "forged") raw = raw.replace("123456", "999999");
      await page.route("https://st.max.ru/js/max-web-app.js", (r) =>
        r.fulfill({ body: 'window.WebApp={initData:""}' }),
      );
      await page.route("https://telegram.org/js/telegram-web-app.js", (r) =>
        r.fulfill({
          body: 'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}',
        }),
      );
      await page.goto(
        "/#" +
          (platform === "MAX" ? "WebAppData" : "tgWebAppData") +
          "=" +
          encodeURIComponent(raw),
      );
      await page.getByLabel("Как к вам обращаться").fill("Неверная подпись");
      await page
        .getByRole("button", { name: "Войти через " + platform, exact: true })
        .click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Войти через " + platform,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Создать задание", exact: true }),
      ).toHaveCount(0);
    });
}

for (const platform of ["MAX", "Telegram"])
  for (const committed of [false, true])
    test(`${platform} registration recovers from ${committed ? 'lost acknowledgement' : 'network outage'} without changing role or alias`, async ({page}) => {
      const raw=signed(platform,Date.now());
      await page.route('https://st.max.ru/js/max-web-app.js',r=>r.fulfill({body:'window.WebApp={initData:""}'}));
      await page.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}'}));
      await page.goto('/#'+(platform==='MAX'?'WebAppData':'tgWebAppData')+'='+encodeURIComponent(raw));
      const alias='Ученик <>& 🧪';
      await page.getByLabel('Как к вам обращаться').fill(alias);
      await page.locator('.registration-role').filter({has:page.getByRole('radio',{name:/^Ученик/})}).click();
      const path='**/api/auth/'+(platform==='MAX'?'max':'telegram');
      let firstId='';
      await page.route(path,async route=>{
        if(committed){const response=await route.fetch();expect(response.ok()).toBe(true);firstId=(await response.json()).user.id;}
        await route.abort();
      });
      await page.getByRole('button',{name:'Войти через '+platform,exact:true}).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByLabel('Как к вам обращаться')).toHaveValue(alias);
      await expect(page.getByRole('radio',{name:/^Ученик/})).toBeChecked();
      await expect(page.getByRole('heading',{name:'Ваш следующий шаг.',exact:true})).toHaveCount(0);
      await page.unroute(path);
      const reply=page.waitForResponse(r=>r.url().endsWith('/auth/'+(platform==='MAX'?'max':'telegram')));
      await page.getByRole('button',{name:'Войти через '+platform,exact:true}).click();
      const second=(await (await reply).json()).user;
      expect(second.role).toBe('learner');expect(second.alias).toBe(alias);if(committed)expect(second.id).toBe(firstId);
      await expect(page.getByRole('heading',{name:'Ваш следующий шаг.',exact:true})).toBeVisible();
      await page.reload();await expect(page.getByRole('heading',{name:'Ваш следующий шаг.',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:new RegExp('Ученик <>&')})).toBeVisible();
    });

for(const platform of ['MAX','Telegram'])test(`${platform} logout clears the previous registration alias`,async({page})=>{
 const raw=signed(platform,Date.now());
 await page.route('https://st.max.ru/js/max-web-app.js',r=>r.fulfill({body:'window.WebApp={initData:""}'}));
 await page.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:'window.Telegram={WebApp:{initData:"",ready(){},expand(){}}}'}));
 await page.goto('/#'+(platform==='MAX'?'WebAppData':'tgWebAppData')+'='+encodeURIComponent(raw));
 await page.getByLabel('Как к вам обращаться').fill('Приватное прежнее имя');
 await page.getByRole('button',{name:'Войти через '+platform,exact:true}).click();
 await page.getByRole('button',{name:/Приватное прежнее имя/}).click();await page.getByRole('button',{name:'Выйти',exact:true}).click();
 await expect(page.getByLabel('Как к вам обращаться')).toHaveValue('');
});
