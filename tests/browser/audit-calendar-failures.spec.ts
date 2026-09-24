import {test,expect} from './audit-fixtures';
import {readFile} from 'node:fs/promises';
for(const role of ['tutor','learner'])test(`${role} calendar offline error, recovery and reload produce private valid download`,async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:role==='tutor'?'Я преподаватель':'Я ученик',exact:true}).click();await page.getByRole('button',{name:'Расписание',exact:true}).click();let files=0;page.on('download',()=>files++);
 await context.setOffline(true);try{await page.getByRole('button',{name:'Скачать календарь (.ics)',exact:true}).click();await expect(page.getByRole('alert').first()).toBeVisible();expect(files).toBe(0);}finally{await context.setOffline(false);}
 for(let n=0;n<2;n++){
  if(n){await page.reload();await page.getByRole('button',{name:'Расписание',exact:true}).click();}
  const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать календарь (.ics)',exact:true}).click();const file=await wait;expect(file.suggestedFilename()).toMatch(/\.ics$/);const text=await readFile((await file.path())!,'utf8');expect(text).toContain('BEGIN:VCALENDAR');expect(text).toContain('BEGIN:VEVENT');expect(text).not.toMatch(/payment_status|Оплачено|Не оплачено/);if(role==='learner')expect(text).not.toContain('Женя');
 }
 expect(files).toBe(2);
});
