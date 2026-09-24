import {test,expect} from './audit-fixtures';
for (const role of ['tutor','learner']) test(`${role}: every navigation destination fits a narrow screen and survives reload`,async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:600});
 await page.goto('/');await page.getByRole('button',{name:role==='tutor'?'Я преподаватель':'Я ученик',exact:true}).click();
 const names=['Сегодня','Задания',role==='tutor'?'Ученики':'Мой прогресс','Расписание','Материалы','Репетиторы'];
 for (const [i,name] of names.entries()) {
  await test.step(name,async()=>{
   await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
   await page.locator('nav').getByRole('button',{name:new RegExp('^'+name+'(?: \\d+)?$')}).click();
   await expect(page.locator('h1').first()).toBeVisible();
   await expect(page.getByRole('alert')).toHaveCount(0);
   await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:testInfo.outputPath(`${role}-${i}.png`),fullPage:true});
  });
 }
 await page.reload();await expect(page.locator('h1').first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Я преподаватель',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
 await page.getByRole('button',{name:role==='tutor'?/Алекс • демо/:/Саша • демо/}).click();
 await expect(page.getByRole('heading',{name:'Настройки и помощь',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath(`${role}-settings.png`),fullPage:true});
});
