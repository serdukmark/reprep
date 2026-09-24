import { test, expect } from './audit-fixtures';
const cases = [
  ['groups','**/api/groups','students','Групповые занятия'],
  ['workspaces','**/api/workspaces','students','Пространства преподавателей'],
  ['plan','**/api/relationships/demo-link/plan','learner','Индивидуальная программа'],
  ['skills','**/api/relationships/demo-link/skill-graph','learner','Граф навыков'],
  ['recommendations','**/api/relationships/demo-link/recommendations','learner','Следующий учебный шаг'],
  ['catalog','**/api/catalog/profile','catalog','Моя анкета'],
  ['notifications','**/api/notifications','settings','Напоминания в мессенджере'],
  ['analytics','**/api/analytics','settings','Работа пространства'],
];
for (const [name, path, target, heading] of cases) test(`${name}: interrupted initial read is visible and reload recovers`, async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();
  await expect(page.getByRole('button',{name:/Линейные уравнения: от шага к решению/})).toBeVisible();
  const open = async () => {
    if (target==='settings') await page.getByRole('button',{name:/Алекс • демо/}).click();
    else if (target==='catalog') await page.getByRole('button',{name:'Репетиторы',exact:true}).click();
    else {
      await page.getByRole('button',{name:'Ученики',exact:true}).click();
      if (target==='learner') await page.getByRole('button',{name:/Саша • демо/}).click();
    }
  };
  let intercepted = 0;
  await page.route(path, async route => { intercepted++; await route.abort('connectionreset'); });
  await open();
  await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  await expect(page.getByRole('alert').first()).toBeVisible();
  expect(intercepted).toBeGreaterThan(0);
  await page.unroute(path);
  await page.reload();
  await open();
  await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
