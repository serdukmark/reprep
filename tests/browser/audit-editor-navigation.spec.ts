import {test,expect} from './audit-fixtures';
for (const kind of ['group','catalog','skills']) test(`${kind}: cancel navigation preserves edited fields, confirmed navigation discards only unsaved edits`,async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();
 const open=async()=>{
  await page.getByRole('button',{name:kind==='catalog'?'Репетиторы':'Ученики',exact:true}).click();
  if(kind==='skills')await page.getByRole('button',{name:/Саша • демо/}).click();
 };
 await open();
 const field=page.getByRole('textbox',{name:kind==='group'?'Название группы':kind==='catalog'?'Заголовок анкеты':'Навыки графа (каждый с новой строки)',exact:true});
 await expect(field).toBeVisible();const original=await field.inputValue();await field.fill('Несохранённая правка <>& 🧪');
 let asked=0;page.once('dialog',async d=>{asked++;await d.dismiss();});
 await page.getByRole('button',{name:'Сегодня',exact:true}).click();expect(asked).toBe(1);await expect(field).toHaveValue('Несохранённая правка <>& 🧪');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Сегодня',exact:true}).click();await expect(field).toHaveCount(0);
 await open();await expect(field).toHaveValue(original);
});
