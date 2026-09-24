import {test,expect,choose} from './audit-fixtures';
for(const destination of ['schedule','new-draft','new-account'])test(`pending generated draft cannot replace ${destination} selected afterwards`,async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:'Материалы',exact:true}).click();
 await page.getByRole('button',{name:'Добавить материал',exact:true}).click();await page.getByLabel('Название',{exact:true}).fill('Синтетический материал');await choose(page.getByRole('combobox',{name:'Ученик',exact:true}),'demo-link');
 await page.getByLabel('Или файл TXT').setInputFiles({name:'source.txt',mimeType:'text/plain',buffer:Buffer.from('Чтобы решить 3x + 7 = 22, вычтите 7 из обеих частей: 3x = 15. Разделите на 3: x = 5. Проверка: 3 умножить на 5 плюс 7 равно 22.')});await page.getByRole('checkbox',{name:/Разрешаю/}).check();await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.getByText('Создать задания из этого TXT',{exact:true}).click();await page.getByLabel('Количество заданий').fill('1');await page.getByRole('button',{name:'Подготовить AI-черновик',exact:true}).click();await expect(page.getByRole('button',{name:'Открыть AI-черновик (1 заданий)',exact:true})).toBeVisible({timeout:15000});
 let release!:()=>void,start!:()=>void,oldURL='';const held=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>start=r);let caught=false;
 await page.route('**/api/assignments/*',async route=>{if(caught||route.request().method()!=='GET')return route.continue();caught=true;oldURL=route.request().url();const response=await route.fetch();expect(response.ok()).toBe(true);start();await held;await route.fulfill({response});});
 await page.getByRole('button',{name:'Открыть AI-черновик (1 заданий)',exact:true}).click();await seen;
 if(destination==='schedule'){await page.getByRole('button',{name:'Расписание',exact:true}).click();await expect(page.getByRole('heading',{name:'Расписание',exact:true})).toBeVisible();}
 else if(destination==='new-draft'){await page.getByRole('button',{name:/^Задания(?: \d+)?$/}).click();await page.getByRole('button',{name:'Создать задание',exact:true}).click();await page.getByLabel('Название работы').fill('Мой новый ручной черновик');}
 else {await page.getByRole('button',{name:/Алекс • демо/}).click();await page.getByRole('button',{name:'Выйти',exact:true}).click();await page.getByRole('button',{name:'Я ученик',exact:true}).click();await expect(page.getByRole('heading',{name:'Ваш следующий шаг.',exact:true})).toBeVisible();}
 const ack=page.waitForResponse(r=>r.url()===oldURL);release();await(await ack).finished();await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 if(destination==='new-draft')await expect(page.getByLabel('Название работы')).toHaveValue('Мой новый ручной черновик');
 else{await expect(page.getByRole('heading',{name:destination==='schedule'?'Расписание':'Ваш следующий шаг.',exact:true})).toBeVisible();await expect(page.getByLabel('Название работы')).toHaveCount(0);}
});
