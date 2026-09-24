import {test,expect} from './audit-fixtures';
for(const role of ['tutor','learner'])for(const kind of ['profile','notifications'])test(`${role} ${kind}: cancelled navigation preserves edits, save clears warning, discard keeps saved settings`,async({page,request})=>{
 if(kind==='notifications')expect((await request.post('/__audit__/notification-contacts')).ok()).toBe(true);
 await page.goto('/');await page.getByRole('button',{name:role==='tutor'?'Я преподаватель':'Я ученик',exact:true}).click();const original=role==='tutor'?'Алекс • демо':'Саша • демо',alias='Новое имя 🧪 '+role;await page.getByRole('button',{name:new RegExp(original)}).click();
 const field=()=>kind==='profile'?page.getByLabel('Отображаемое имя',{exact:true}):page.getByLabel('О ближайших занятиях');if(kind==='profile')await field().fill(alias);else await field().check();
 let asked=0;page.once('dialog',async d=>{asked++;await d.dismiss();});await page.getByRole('button',{name:'Сегодня',exact:true}).click();expect(asked).toBe(1);if(kind==='profile')await expect(field()).toHaveValue(alias);else await expect(field()).toBeChecked();
 await page.getByRole('button',{name:kind==='profile'?'Сохранить имя':'Сохранить напоминания',exact:true}).click();await expect(page.getByText(kind==='profile'?'Имя сохранено':'Настройки напоминаний сохранены',{exact:true})).toBeVisible();
 const unexpected=async(d:any)=>{asked++;await d.dismiss();};page.on('dialog',unexpected);await page.getByRole('button',{name:'Сегодня',exact:true}).click();await expect(field()).toHaveCount(0);expect(asked).toBe(1);page.off('dialog',unexpected);
 await page.reload();await page.getByRole('button',{name:new RegExp(kind==='profile'?alias:original)}).click();if(kind==='profile'){await expect(field()).toHaveValue(alias);await field().fill('Несохранённое имя');}else{await expect(field()).toBeChecked();await field().uncheck();}
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Сегодня',exact:true}).click();await expect(field()).toHaveCount(0);await page.getByRole('button',{name:new RegExp(kind==='profile'?alias:original)}).click();if(kind==='profile')await expect(field()).toHaveValue(alias);else await expect(field()).toBeChecked();
 await page.screenshot({path:`artifacts/deep-audit/settings-${role}-${kind}-confirmed.png`,fullPage:true});
});
