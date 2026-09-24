import {test,expect,choose} from './audit-fixtures';
for(const kind of ['group','workspace','catalog','plan','skills','lesson','material'])test(`${kind}: saved teacher content is absent for the next colleague account`,async({page})=>{
 const marker='Личное содержимое '+kind+' 🧪';
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();
 if(['group','workspace','plan','skills'].includes(kind))await page.getByRole('button',{name:'Ученики',exact:true}).click();
 if(['plan','skills'].includes(kind))await page.getByRole('button',{name:/Саша • демо/}).click();
 if(kind==='group'){
  await page.getByLabel('Название группы').fill(marker);await page.getByRole('checkbox',{name:/Саша • демо/}).check();await page.getByRole('button',{name:'Сохранить группу',exact:true}).click();await expect(page.getByText('Группа сохранена',{exact:true})).toBeVisible();
 }else if(kind==='workspace'){
  await page.getByLabel('Название пространства').fill(marker);await page.getByRole('button',{name:'Создать пространство',exact:true}).click();await expect(page.getByRole('combobox',{name:'Текущее пространство',exact:true})).toHaveText(marker);
 }else if(kind==='plan'){
  await page.getByLabel('Цель программы').fill(marker);await page.getByRole('button',{name:'Сохранить программу',exact:true}).click();await expect(page.getByText('Программа сохранена',{exact:true})).toBeVisible();
 }else if(kind==='skills'){
  await page.getByLabel('Навыки графа (каждый с новой строки)').fill(marker);await page.getByRole('button',{name:'Сохранить граф',exact:true}).click();await expect(page.getByText('Граф сохранён',{exact:true})).toBeVisible();
 }else if(kind==='catalog'){
  await page.getByRole('button',{name:'Репетиторы',exact:true}).click();await page.getByLabel('Заголовок анкеты').fill(marker);await page.getByLabel('О занятиях').fill('Синтетическое приватное описание занятий для теста');await page.getByLabel('Предметы анкеты (каждый с новой строки)').fill('Математика');await page.getByRole('button',{name:'Сохранить анкету',exact:true}).click();await expect(page.getByText('Анкета сохранена',{exact:true})).toBeVisible();
 }else{
  await page.getByRole('button',{name:kind==='lesson'?'Расписание':'Материалы',exact:true}).click();await page.getByRole('button',{name:kind==='lesson'?'Добавить занятие':'Добавить материал',exact:true}).click();await page.getByLabel('Название',{exact:true}).fill(marker);await choose(page.getByRole('combobox',{name:'Ученик',exact:true}),'demo-link');
  if(kind==='lesson')await page.getByLabel('Начало (ваш часовой пояс)').fill('2026-12-31T18:00');else await page.getByLabel('Ссылка HTTPS').fill('https://example.invalid/private');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.getByRole('heading',{name:marker,exact:true})).toBeVisible();
 }
 await page.getByRole('button',{name:/Алекс • демо/}).click();await page.getByRole('button',{name:'Выйти',exact:true}).click();const fresh=Promise.all(['relationships','assignments','lessons','materials'].map(resource=>page.waitForResponse(r=>r.url().endsWith('/api/'+resource))));
 await page.getByRole('button',{name:'Другой преподаватель · демо',exact:true}).click();await Promise.all((await fresh).map(r=>r.finished()));
 const target=kind==='catalog'?'Репетиторы':kind==='lesson'?'Расписание':kind==='material'?'Материалы':'Ученики';
 const childPath=kind==='group'?'/groups':kind==='workspace'?'/workspaces':kind==='catalog'?'/catalog/profile':'';
 const child=childPath?page.waitForResponse(r=>r.url().endsWith('/api'+childPath)):null;
 await page.getByRole('button',{name:target,exact:true}).click();if(child)await(await child).finished();await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));await expect(page.getByText(marker,{exact:true})).toHaveCount(0);
 expect(await page.locator('input,textarea').evaluateAll((els,text)=>els.some(el=>(el as HTMLInputElement).value.includes(text)),marker)).toBe(false);
 if(kind==='catalog')await expect(page.getByLabel('Заголовок анкеты')).toHaveValue('');
 if(['group','workspace','plan','skills'].includes(kind))await expect(page.getByRole('button',{name:/Саша • демо|Женя • демо/})).toHaveCount(0);
 await page.reload();await page.getByRole('button',{name:target,exact:true}).click();await expect(page.getByText(marker,{exact:true})).toHaveCount(0);
});

test('notification preferences and contact state belong only to the current account',async({page,request})=>{
 expect((await request.post('/__audit__/notification-contacts')).ok()).toBe(true);
 await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();await page.getByRole('button',{name:/Алекс • демо/}).click();
 await page.getByLabel('О ближайших занятиях').check();await page.getByRole('button',{name:'Сохранить напоминания',exact:true}).click();await expect(page.getByText('Настройки напоминаний сохранены',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Выйти',exact:true}).click();await page.getByRole('button',{name:'Другой преподаватель · демо',exact:true}).click();await page.getByRole('button',{name:/Другой репетитор • демо/}).click();
 await expect(page.getByLabel('О ближайших занятиях')).not.toBeChecked();await expect(page.getByLabel('О ближайших занятиях')).toBeDisabled();
 await page.reload();await page.getByRole('button',{name:/Другой репетитор • демо/}).click();await expect(page.getByLabel('О ближайших занятиях')).not.toBeChecked();
});

test('guardian summary and invitation buffer disappear for a new guardian identity',async({page,browser})=>{
 const tutor=await browser.newPage();await tutor.goto('/');await tutor.getByRole('button',{name:'Я преподаватель',exact:true}).click();await tutor.getByRole('button',{name:'Ученики',exact:true}).click();await tutor.getByRole('button',{name:/Саша • демо/}).click();await tutor.getByRole('button',{name:'Создать приглашение родителю',exact:true}).click();const code=await tutor.getByLabel('Код родителя',{exact:true}).inputValue();
 await page.goto('/');await page.getByRole('button',{name:'Я родитель',exact:true}).click();await page.getByLabel('Код приглашения родителю').fill(code);await page.getByRole('button',{name:'Принять доступ',exact:true}).click();await page.getByRole('button',{name:/Саша • демо/}).click();await expect(page.getByText('Разбираем уравнения',{exact:true})).toBeVisible();
 await page.getByLabel('Код приглашения родителю').fill('private-next-parent-invite');await page.getByRole('button',{name:'Выйти',exact:true}).click();
 await page.route('**/api/auth/demo/guardian',r=>r.continue({url:new URL('/__audit__/identity/guardian',r.request().url()).href}));
 const fresh=page.waitForResponse(r=>r.url().endsWith('/api/guardian/links'));await page.getByRole('button',{name:'Я родитель',exact:true}).click();await(await fresh).finished();
 await expect(page.getByText(/Открытых доступов нет/)).toBeVisible();await expect(page.getByText('Разбираем уравнения',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/Саша • демо/})).toHaveCount(0);await expect(page.getByLabel('Код приглашения родителю')).toHaveValue('');await tutor.close();
});
