import {test,expect} from './audit-fixtures';
for(const kind of ['calendar','material'])test(`pending ${kind} download cannot deliver previous account data after login changes`,async({page,request})=>{
 let endpoint='/api/calendar',button='Скачать календарь (.ics)';
 if(kind==='material'){
  const login=await request.post('/api/auth/demo/tutor');const headers={Authorization:'Bearer '+(await login.json()).token};
  const saved=await request.post('/api/materials',{headers,data:{relationship_id:'demo-link-2',title:'Приватный TXT',file_name:'private.txt',content:'Синтетический приватный материал'}});expect(saved.ok()).toBe(true);endpoint='/api/materials/'+(await saved.json()).id+'/file';button='Скачать private.txt';
 }
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:kind==='calendar'?'Расписание':'Материалы',exact:true}).click();
 await page.evaluate(path=>{
  (window as any).__oldDownloadRead=false;(window as any).__oldDownloadURLs=0;const json=Response.prototype.json;
  Response.prototype.json=async function(){const data=await json.call(this);if(this.url.endsWith(path))(window as any).__oldDownloadRead=true;return data;};
  const create=URL.createObjectURL;URL.createObjectURL=function(value){(window as any).__oldDownloadURLs++;return create.call(this,value);};
 },endpoint);
 let release!:()=>void,start!:()=>void;const held=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>start=r);
 await page.route('**'+endpoint,async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);start();await held;await route.fulfill({response});});
 await page.getByRole('button',{name:button,exact:true}).click();await seen;
 await page.getByRole('button',{name:/Алекс • демо/}).click();await page.getByRole('button',{name:'Выйти',exact:true}).click();await page.getByRole('button',{name:'Я ученик',exact:true}).click();await expect(page.getByRole('heading',{name:'Ваш следующий шаг.',exact:true})).toBeVisible();
 release();await expect.poll(()=>page.evaluate(()=>(window as any).__oldDownloadRead)).toBe(true);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 expect(await page.evaluate(()=>(window as any).__oldDownloadURLs)).toBe(0);
});
