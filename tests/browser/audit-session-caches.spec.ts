import {test,expect} from './audit-fixtures';
test('unaccepted invitation input does not survive logout into a different learner',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Я ученик',exact:true}).click();await page.getByRole('button',{name:/Саша • демо/}).click();
 await page.getByLabel('Код приглашения',{exact:true}).fill('private-unaccepted-invite');
 await page.getByRole('button',{name:'Выйти',exact:true}).click();
 await page.route('**/api/auth/demo/learner',r=>r.continue({url:new URL('/__audit__/identity/learner',r.request().url()).href}));
 await page.getByRole('button',{name:'Я ученик',exact:true}).click();await page.getByRole('button',{name:/Новый ученик • аудит/}).click();
 await expect(page.getByLabel('Код приглашения',{exact:true})).toHaveValue('');
});
for(const resource of ['relationships','lessons','materials','profile'])test(`old ${resource} response cannot restore teacher data after a learner login`,async({page,request})=>{
 const oldName='Старые приватные данные 🧪';
 if(resource==='materials'||resource==='lessons'){
  const login=await request.post('/api/auth/demo/tutor');const headers={Authorization:'Bearer '+(await login.json()).token};
  const data=resource==='materials'?{relationship_id:'demo-link-2',title:oldName,note:'Приватная заметка',url:'https://example.invalid/private'}:{relationship_id:'demo-link-2',title:oldName,starts_at:'2026-12-31T18:00:00Z',duration:60};
  expect((await request.post('/api/'+resource,{headers,data})).ok()).toBe(true);
 }
 await page.goto('/');let release!:()=>void,start!:()=>void;const held=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>start=r);let caught=false;
 const install=async()=>page.route('**/api/'+resource,async route=>{
  if(caught||(resource==='profile'&&route.request().method()!=='PUT'))return route.continue();caught=true;
  const response=await route.fetch();expect(response.ok()).toBe(true);start();await held;await route.fulfill({response});
 });
 if(resource!=='profile')await install();
 await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();
 if(resource==='profile'){
  await page.getByRole('button',{name:/Алекс • демо/}).click();await page.getByLabel('Отображаемое имя').fill(oldName);await install();await page.getByRole('button',{name:'Сохранить имя',exact:true}).click();
 }
 await seen;
 if(resource!=='profile')await page.getByRole('button',{name:/Алекс • демо/}).click();
 await page.getByRole('button',{name:'Выйти',exact:true}).click();await page.getByRole('button',{name:'Я ученик',exact:true}).click();
 await expect(page.getByRole('button',{name:/Линейные уравнения: от шага к решению/})).toBeVisible();
 const ack=page.waitForResponse(r=>r.url().endsWith('/api/'+resource));release();await(await ack).finished();await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 if(resource==='relationships'){
  await page.getByRole('button',{name:'Мой прогресс',exact:true}).click();await expect(page.locator('.learner-list button')).toHaveCount(1);await expect(page.getByRole('button',{name:/Саша • демо/})).toHaveCount(1);
 }else if(resource==='materials'){
  await page.getByRole('button',{name:'Материалы',exact:true}).click();await expect(page.getByText(oldName,{exact:true})).toHaveCount(0);
 }else if(resource==='lessons'){
  await page.getByRole('button',{name:'Расписание',exact:true}).click();await expect(page.getByText(oldName,{exact:true})).toHaveCount(0);await expect(page.getByText('Ваша отметка об оплате',{exact:true})).toHaveCount(0);
 }
 await expect(page.getByRole('button',{name:'Ученики',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:new RegExp(oldName)})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Саша • демо/})).toHaveCount(1);
});
