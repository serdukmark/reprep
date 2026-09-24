import {test,expect,choose} from './audit-fixtures';
for(const kind of ['payment','status'])test(`tutor cannot change colleague lesson ${kind} through substituted id`,async({page,request})=>{
 const other=await request.post('/api/auth/demo/outsider'),student=await request.post('/api/auth/demo/learner');const oh={Authorization:'Bearer '+(await other.json()).token},lh={Authorization:'Bearer '+(await student.json()).token};
 const inv=await request.post('/api/invitations',{headers:oh,data:{subject:'Чужая связь'}});expect((await request.post('/api/invitations/accept',{headers:lh,data:{token:(await inv.json()).token}})).ok()).toBe(true);
 const links=await request.get('/api/relationships',{headers:oh});const rid=(await links.json())[0].id;
 const saved=await request.post('/api/lessons',{headers:oh,data:{relationship_id:rid,title:'Приватное занятие коллеги',starts_at:'2026-10-20T10:00:00Z',duration:60,payment_status:'unpaid'}});expect(saved.ok()).toBe(true);const foreign=(await saved.json()).id;
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:'Расписание',exact:true}).click();const control=page.getByRole('combobox',{name:kind==='payment'?'Ваша отметка об оплате':'Статус занятия',exact:true}).first();await expect(control).toBeVisible();const original=await control.innerText();
 await page.route('**/api/lessons/*',r=>r.request().method()==='PATCH'?r.continue({url:new URL('/api/lessons/'+foreign,r.request().url()).href}):r.continue());await choose(control,kind==='payment'?'paid':'completed');await expect(page.getByRole('alert').first()).toBeVisible();await expect(control).toHaveText(original);await expect(page.getByRole('heading',{name:'Приватное занятие коллеги',exact:true})).toHaveCount(0);
 const lessons=await request.get('/api/lessons',{headers:oh});const actual=(await lessons.json()).find((x:any)=>x.id===foreign);expect(actual.payment_status).toBe('unpaid');expect(actual.status).toBe('scheduled');
 await page.unroute('**/api/lessons/*');await choose(control,kind==='payment'?'paid':'completed');await expect(control).toHaveText(kind==='payment'?'Оплачено':'Проведено');
});
