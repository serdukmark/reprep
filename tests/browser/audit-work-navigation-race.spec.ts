import {test,expect} from './audit-fixtures';
for(const destination of ['other-work','schedule','new-draft'])test(`delayed work opening cannot replace ${destination} chosen afterwards`,async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();
 const oldTitle='Дроби и уравнения: самостоятельная работа',newTitle='Линейные уравнения: от шага к решению';
 await expect(page.getByRole('button',{name:new RegExp(oldTitle)})).toBeVisible();
 let release!:()=>void,start!:()=>void,oldURL='';const held=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>start=r);let caught=false;
 await page.route('**/api/assignments/*',async route=>{
  if(caught||route.request().method()!=='GET')return route.continue();caught=true;oldURL=route.request().url();const response=await route.fetch();expect(response.ok()).toBe(true);start();await held;await route.fulfill({response});
 });
 await page.getByRole('button',{name:new RegExp(oldTitle)}).click();await seen;
 if(destination==='other-work'){
  await page.getByRole('button',{name:new RegExp(newTitle)}).click();await expect(page.getByRole('heading',{name:newTitle,exact:true})).toBeVisible();
 }else if(destination==='schedule'){
  await page.getByRole('button',{name:'Расписание',exact:true}).click();await expect(page.getByRole('heading',{name:'Расписание',exact:true})).toBeVisible();
 }else{
  await page.getByRole('button',{name:'Создать задание',exact:true}).click();await page.getByLabel('Название работы').fill('Новый черновик после перехода');
 }
 await page.evaluate(text=>{(window as any).__staleWork=false;new MutationObserver(()=>{if([...document.querySelectorAll('h1')].some(e=>e.textContent===text))(window as any).__staleWork=true;}).observe(document.body,{subtree:true,childList:true,characterData:true});},oldTitle);
 const ack=page.waitForResponse(r=>r.url()===oldURL);release();await(await ack).finished();await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 expect(await page.evaluate(()=>(window as any).__staleWork)).toBe(false);
 if(destination==='new-draft')await expect(page.getByLabel('Название работы')).toHaveValue('Новый черновик после перехода');
 else await expect(page.getByRole('heading',{name:destination==='schedule'?'Расписание':newTitle,exact:true})).toBeVisible();
});
