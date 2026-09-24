import {test,expect,choose} from './audit-fixtures';
for(const kind of ['assign','lessons'])test(`group ${kind}: cancelling navigation keeps unsubmitted bulk form`,async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:'Ученики',exact:true}).click();await page.getByLabel('Название группы').fill('Группа для перехода');await page.getByRole('checkbox',{name:/Саша • демо/}).check();await page.getByRole('button',{name:'Сохранить группу',exact:true}).click();const group=page.locator('article').filter({has:page.getByRole('heading',{name:'Группа для перехода',exact:true})});
 if(kind==='assign')await choose(group.getByRole('combobox',{name:'Работа для группы Группа для перехода',exact:true}),'demo-assignment');
 else{await group.getByLabel('Тема общего занятия').fill('Несохранённое групповое <>& 🧪');await group.getByLabel('Начало общего занятия').fill('2026-10-20T15:00');}
 let asked=0;page.once('dialog',async d=>{asked++;await d.dismiss();});await page.getByRole('button',{name:'Расписание',exact:true}).click();expect(asked).toBe(1);
 if(kind==='assign')await expect(group.getByRole('combobox')).not.toHaveText('Выберите проверенный шаблон');else await expect(group.getByLabel('Тема общего занятия')).toHaveValue('Несохранённое групповое <>& 🧪');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Расписание',exact:true}).click();await expect(page.getByRole('heading',{name:'Расписание',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ученики',exact:true}).click();if(kind==='assign')await expect(group.getByRole('combobox')).toHaveText('Выберите проверенный шаблон');else await expect(group.getByLabel('Тема общего занятия')).toHaveValue('');
});
