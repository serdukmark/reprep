import {test,expect,choose} from './audit-fixtures';
for(const failure of ['offline','expired-session','lost-ack'])test(`manual payment ${failure}: truthful state and durable retry`,async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:'Расписание',exact:true}).click();
 const payment=()=>page.getByRole('combobox',{name:'Ваша отметка об оплате',exact:true}).first();await expect(payment()).toBeVisible();const original=await payment().innerText();expect(original).not.toBe('Оплачено');
 if(failure==='offline')await context.setOffline(true);
 if(failure==='expired-session')expect(await page.evaluate(async()=>(await fetch('/api/logout',{method:'POST',headers:{Authorization:'Bearer '+sessionStorage.getItem('reprep.session')}})).status)).toBe(200);
 if(failure==='lost-ack')await page.route('**/api/lessons/*',async route=>{if(route.request().method()!=='PATCH')return route.continue();expect((await route.fetch()).ok()).toBe(true);await route.abort();});
 try{await choose(payment(),'paid');await expect(page.getByRole('alert').first()).toBeVisible();await expect(payment()).toHaveText(original);}finally{await context.setOffline(false);}
 if(failure==='expired-session'){await page.reload();await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:'Расписание',exact:true}).click();await expect(payment()).toHaveText(original);}
 await page.unroute('**/api/lessons/*');await choose(payment(),'paid');await expect(payment()).toHaveText('Оплачено');await page.reload();await page.getByRole('button',{name:'Расписание',exact:true}).click();await expect(payment()).toHaveText('Оплачено');
 await choose(payment(),'unpaid');await expect(payment()).toHaveText('Не оплачено');await page.getByRole('button',{name:'Материалы',exact:true}).click();await page.getByRole('button',{name:'Расписание',exact:true}).click();await expect(payment()).toHaveText('Не оплачено');
});
