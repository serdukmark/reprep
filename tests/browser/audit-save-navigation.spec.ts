import {test,expect,choose} from './audit-fixtures';
for(const kind of ['save','duplicate'])test(`${kind}: completed request cannot pull user back from the schedule`,async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();
 if(kind==='save'){
  await page.getByRole('button',{name:'Создать задание',exact:true}).click();await page.getByLabel('Название работы').fill('Сохранение после ухода 🧪');
  await choose(page.getByRole('combobox',{name:'Ученик',exact:true}),'demo-link');
  await page.getByLabel('Условие',{exact:true}).fill('2+3');await page.getByLabel('Эталонный ответ',{exact:true}).fill('5');await page.getByLabel('Навык',{exact:true}).fill('Сложение');
 }else{await page.getByRole('button',{name:/Линейные уравнения: от шага к решению/}).click();await expect(page.getByRole('button',{name:'Создать копию',exact:true})).toBeVisible();}
 let release!:()=>void,start!:()=>void,savedId='';const held=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>start=r);
 await page.route(kind==='save'?'**/api/assignments':'**/api/assignments/*/duplicate',async route=>{
  if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();expect(response.ok()).toBe(true);savedId=(await response.json()).id;start();await held;await route.fulfill({response});
 });
 await page.getByRole('button',{name:kind==='save'?'Сохранить черновик':'Создать копию',exact:true}).click();await seen;
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Расписание',exact:true}).click();await expect(page.getByRole('heading',{name:'Расписание',exact:true})).toBeVisible();
 const loaded=page.waitForResponse(r=>r.url().endsWith('/api/assignments/'+savedId)&&r.request().method()==='GET');
 release();await(await loaded).finished();await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 await expect(page.getByRole('heading',{name:'Расписание',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:/^Задания(?: \d+)?$/}).click();
 await expect(page.getByRole('button',{name:kind==='save'?/Сохранение после ухода/:/копия/i}).first()).toBeVisible();
});
