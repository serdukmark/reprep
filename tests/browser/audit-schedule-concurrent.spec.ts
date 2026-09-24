import { test, expect, choose } from './audit-fixtures';
test('two tutor tabs preserve independent payment and lesson status changes', async ({ browser }) => {
  const a = await browser.newPage(), b = await browser.newPage();
  for (const p of [a,b]) {
    await p.goto('/');
    await p.getByRole('button', {name:'Я преподаватель', exact:true}).click();
    await p.getByRole('button', {name:'Расписание', exact:true}).click();
    await expect(p.getByRole('combobox', {name:'Ваша отметка об оплате', exact:true}).first()).toBeVisible();
  }
  await choose(a.getByRole('combobox', {name:'Ваша отметка об оплате', exact:true}).first(), 'paid');
  await expect(a.getByRole('combobox', {name:'Ваша отметка об оплате', exact:true}).first()).toHaveText('Оплачено');
  await choose(b.getByRole('combobox', {name:'Статус занятия', exact:true}).first(), 'completed');
  await expect(b.getByRole('combobox', {name:'Статус занятия', exact:true}).first()).toHaveText('Проведено');
  await a.reload();
  await a.getByRole('button', {name:'Расписание', exact:true}).click();
  await expect(a.getByRole('combobox', {name:'Ваша отметка об оплате', exact:true}).first()).toHaveText('Оплачено');
  await expect(a.getByRole('combobox', {name:'Статус занятия', exact:true}).first()).toHaveText('Проведено');
  await a.close(); await b.close();
});
