import {test,expect,choose} from './audit-fixtures';
for (const width of [320,390]) test(`work status filter remains readable at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:600});await page.goto('/');await page.getByRole('button',{name:'Я преподаватель',exact:true}).click();
 await page.getByRole('button',{name:'Открыть меню',exact:true}).click();await page.locator('nav').getByRole('button',{name:/^Задания(?: \d+)?$/}).click();
 if(process.env.E2E_MUTATION==='mobile-filter') await page.addStyleTag({content:'.filters{display:flex!important;gap:0!important;align-items:center!important}.filters>.search{width:65%!important;max-width:420px!important}.filters>span{white-space:normal!important;padding-bottom:0!important}'});
 const filter=page.getByRole('combobox',{name:'Статус работ',exact:true});
 for(const value of ['all','overdue','completed','draft']) {
  await choose(filter,value);
  const dimensions=await filter.locator('span').evaluate(el=>({height:el.getBoundingClientRect().height,line:parseFloat(getComputedStyle(el).lineHeight)}));
  expect(dimensions.height,`selected label ${value} must fit one line`).toBeLessThanOrEqual(dimensions.line+1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.screenshot({path:info.outputPath('filter.png'),fullPage:true});
});
