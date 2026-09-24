import {test,expect,choose} from './audit-fixtures';
import type {Page} from '@playwright/test';
async function createSource(page:Page,marker=""){
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:'Материалы',exact:true}).click();await page.getByRole('button',{name:'Добавить материал',exact:true}).click();await page.getByLabel('Название',{exact:true}).fill('Источник 🧪 <текст>');await choose(page.getByRole('combobox',{name:'Ученик',exact:true}),'demo-link');await page.getByLabel('Или файл TXT').setInputFiles({name:'source.txt',mimeType:'text/plain',buffer:Buffer.from(marker+' Сумма двух и трёх равна пяти. Это синтетический материал для проверки генерации 🧪 <без HTML>.')});await page.getByRole('checkbox',{name:/Разрешаю/}).check();await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByText('Создать задания из этого TXT',{exact:true}).click();await page.getByLabel('Количество заданий').fill('1');
}
for(const failure of ['offline','expired-session','lost-ack'])test(`generation ${failure}: retry creates one private draft and survives reload`,async({page,context})=>{
 await createSource(page);const submit=()=>page.getByRole('button',{name:'Подготовить AI-черновик',exact:true});
 if(failure==='offline')await context.setOffline(true);
 if(failure==='expired-session')expect(await page.evaluate(async()=>(await fetch('/api/logout',{method:'POST',headers:{Authorization:'Bearer '+sessionStorage.getItem('reprep.session')}})).status)).toBe(200);
 if(failure==='lost-ack')await page.route('**/api/materials/*/generations',async r=>{if(r.request().method()!=='POST')return r.continue();expect((await r.fetch()).ok()).toBe(true);await r.abort();});
 try{await submit().click();await expect(page.getByRole('alert').first()).toBeVisible();await expect(page.getByRole('button',{name:'Скачать source.txt',exact:true})).toBeVisible();}finally{await context.setOffline(false);}
 await page.unroute('**/api/materials/*/generations');
 if(failure==='expired-session'){await page.reload();await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:'Материалы',exact:true}).click();await page.getByText('Создать задания из этого TXT',{exact:true}).click();await page.getByLabel('Количество заданий').fill('1');}
 await submit().dblclick();await expect(page.getByRole('button',{name:'Открыть AI-черновик (1 заданий)',exact:true})).toHaveCount(1,{timeout:15000});
 await page.reload();await page.getByRole('button',{name:'Материалы',exact:true}).click();for(const summary of await page.getByText('Создать задания из этого TXT',{exact:true}).all())await summary.click();await expect(page.getByRole('button',{name:'Открыть AI-черновик (1 заданий)',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Открыть AI-черновик (1 заданий)',exact:true}).click();await expect(page.getByRole('textbox',{name:'Условие',exact:true})).toHaveValue('Сколько будет 2+3?');
});
test('generation count rejects empty, zero, fraction and over-limit without posting',async({page})=>{
 await createSource(page);let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/generations'))posts++;});
 for(const value of ['', '0','6','1.5']){await page.getByLabel('Количество заданий').fill(value);await page.getByRole('button',{name:'Подготовить AI-черновик',exact:true}).click();expect(posts).toBe(0);expect(await page.getByLabel('Количество заданий').evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(false);}
 await page.getByLabel('Количество заданий').fill('1');await page.getByRole('button',{name:'Подготовить AI-черновик',exact:true}).click();await expect(page.getByRole('button',{name:'Открыть AI-черновик (1 заданий)',exact:true})).toBeVisible({timeout:15000});expect(posts).toBe(1);
});

test('slow generation shows pending state across reload and never publishes automatically',async({page,context})=>{
 await createSource(page,'AUD_AI_SLOW');await page.getByRole('button',{name:'Подготовить AI-черновик',exact:true}).click();await expect(page.getByText(/Запрос сохранён, AI готовит/)).toBeVisible();await expect(page.getByRole('button',{name:'Подготовить AI-черновик',exact:true})).toBeDisabled();
 await page.reload();await page.getByRole('button',{name:'Материалы',exact:true}).click();await page.getByText('Создать задания из этого TXT',{exact:true}).click();await expect(page.getByText(/Запрос сохранён, AI готовит/)).toBeVisible();await expect(page.getByRole('button',{name:'Подготовить AI-черновик',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Открыть AI-черновик (1 заданий)',exact:true})).toBeVisible({timeout:15000});const learner=await context.newPage();await learner.goto('/');await learner.getByRole('button',{name:'Я ученик',exact:true}).click();await learner.getByRole('button',{name:/^Задания(?: \d+)?$/}).click();await expect(learner.getByRole('button',{name:/Синтетическая генерация из материала/})).toHaveCount(0);await learner.close();
});
