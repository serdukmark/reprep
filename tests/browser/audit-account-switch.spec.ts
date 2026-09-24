import {test,expect} from './audit-fixtures';
for(const kind of ['refresh','open'])test(`${kind}: delayed teacher response cannot enter the next learner session`,async({page})=>{
 await page.goto('/');
 let release!:()=>void,start!:()=>void;const held=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>start=r);let intercepted=false;
 const path=kind==='refresh'?'**/api/assignments':'**/api/assignments/*';
 const privateTitle='Дроби и уравнения: самостоятельная работа';
 const intercept=async()=>{
  await page.route(path,async route=>{
   if(intercepted||route.request().method()!=='GET')return route.continue();
   intercepted=true;const response=await route.fetch();expect(response.ok()).toBe(true);start();await held;await route.fulfill({response});
  });
 };
 if(kind==='refresh')await intercept();
 await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();
 if(kind==='open'){
  await expect(page.getByRole('button',{name:new RegExp(privateTitle)})).toBeVisible();await intercept();
  await page.getByRole('button',{name:new RegExp(privateTitle)}).click();
 }
 await seen;
 await page.getByRole('button',{name:/Алекс • демо/}).click();await page.getByRole('button',{name:'Выйти',exact:true}).click();
 await page.getByRole('button',{name:'Я ученик',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Ваш следующий шаг.',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Линейные уравнения: от шага к решению/})).toBeVisible();
 await page.evaluate(text=>{
  (window as any).__auditLeak=false;
  new MutationObserver(()=>{if(document.body.innerText.includes(text))(window as any).__auditLeak=true}).observe(document.body,{subtree:true,childList:true,characterData:true});
 },privateTitle);
 const ack=page.waitForResponse(r=>kind==='refresh'?r.url().endsWith('/api/assignments'):r.url().includes('/api/assignments/'));
 release();await(await ack).finished();await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 expect(await page.evaluate(()=>(window as any).__auditLeak)).toBe(false);
 await expect(page.getByText(privateTitle,{exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Ваш следующий шаг.',exact:true})).toBeVisible();
});

test('logout clears the old schedule before the new account refresh finishes',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();
 await page.getByRole('button',{name:'Расписание',exact:true}).click();await expect(page.getByRole('heading',{name:'Разбираем уравнения',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Алекс • демо/}).click();await page.getByRole('button',{name:'Выйти',exact:true}).click();
 await page.route('**/api/auth/demo/learner',r=>r.continue({url:new URL('/__audit__/identity/learner',r.request().url()).href}));
 let release!:()=>void,start!:()=>void;const held=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>start=r);
 await page.route('**/api/lessons',async route=>{const response=await route.fetch();start();await held;await route.fulfill({response});});
 await page.getByRole('button',{name:'Я ученик',exact:true}).click();await seen;
 try {
  await page.getByRole('button',{name:'Расписание',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Расписание',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Разбираем уравнения',exact:true})).toHaveCount(0);
 }finally{release();}
});

test('delayed export cannot download previous account data after logout and a new login',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:/Алекс • демо/}).click();
 await page.evaluate(()=>{
  (window as any).__exportBlobFinished=false;(window as any).__exportURLs=0;
  const blob=Response.prototype.blob;Response.prototype.blob=async function(){const result=await blob.call(this);(window as any).__exportBlobFinished=true;return result;};
  const create=URL.createObjectURL;URL.createObjectURL=function(value){(window as any).__exportURLs++;return create.call(this,value);};
 });
 let release!:()=>void,start!:()=>void;const held=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>start=r);
 await page.route('**/api/account/export',async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);start();await held;await route.fulfill({response});});
 await page.getByRole('button',{name:'Скачать мои данные',exact:true}).click();await seen;
 await page.getByRole('button',{name:'Выйти',exact:true}).click();await page.getByRole('button',{name:'Я ученик',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Ваш следующий шаг.',exact:true})).toBeVisible();
 release();await expect.poll(()=>page.evaluate(()=>(window as any).__exportBlobFinished)).toBe(true);
 await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 expect(await page.evaluate(()=>(window as any).__exportURLs)).toBe(0);
});
