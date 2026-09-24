import {test,expect} from './audit-fixtures';
for(const resource of ['plan','skill-graph'])test(`learner cannot open another child's ${resource} by substituting the id in the visible screen`,async({browser})=>{
 const tutor=await browser.newPage(),learner=await browser.newPage();
 await tutor.goto('/');await tutor.getByRole('button',{name:'Я преподаватель',exact:true}).click();await tutor.getByRole('button',{name:'Ученики',exact:true}).click();await tutor.getByRole('button',{name:/Женя • демо/}).click();
 const secret='Приватная программа Жени 🧪';
 if(resource==='plan'){
  await tutor.getByLabel('Цель программы').fill(secret);await tutor.getByRole('button',{name:'Сохранить программу',exact:true}).click();await expect(tutor.getByText('Программа сохранена',{exact:true})).toBeVisible();
 }else{
  await tutor.getByLabel('Навыки графа (каждый с новой строки)').fill(secret);await tutor.getByRole('button',{name:'Сохранить граф',exact:true}).click();await expect(tutor.getByText('Граф сохранён',{exact:true})).toBeVisible();
 }
 await learner.goto('/');await learner.getByRole('button',{name:'Я ученик',exact:true}).click();let denied=0;
 const path='**/api/relationships/demo-link/'+resource;
 await learner.route(path,async route=>{const response=await route.fetch({url:route.request().url().replace('/demo-link/','/demo-link-2/')});expect(response.status()).toBe(404);denied++;await route.fulfill({response});});
 await learner.getByRole('button',{name:'Мой прогресс',exact:true}).click();await expect(learner.getByRole('alert').first()).toBeVisible();expect(denied).toBe(1);
 await expect(learner.getByText(secret,{exact:true})).toHaveCount(0);
 await learner.unroute(path);await learner.reload();await learner.getByRole('button',{name:'Мой прогресс',exact:true}).click();await expect(learner.getByRole('alert')).toHaveCount(0);await expect(learner.getByText(secret,{exact:true})).toHaveCount(0);
 await tutor.close();await learner.close();
});
