// Unauthenticated GET-only production check. No login, mutation, tokens or personal data.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin='https://reprep.ru';
const dir='artifacts/deep-audit/public-readonly';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[];const errors=[];
try {
 const context=await browser.newContext({viewport:{width:1280,height:900},ignoreHTTPSErrors:false});
 await context.route('**/*',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
 const page=await context.newPage();page.on('pageerror',()=>errors.push('uncaught_browser_error'));
 const response=await page.goto(origin,{waitUntil:'networkidle',timeout:30000});
 const csp=(await response.allHeaders())['content-security-policy']||'';
 checks.push({check:'canonical_https',passed:response.status()===200&&page.url().startsWith(origin+'/')});
 checks.push({check:'max_frame_policy',passed:csp.includes('https://max.ru')&&!csp.includes("frame-ancestors 'none'")});
 checks.push({check:'no_demo_login_ui',passed:await page.getByRole('button',{name:'Я преподаватель',exact:true}).count()===0});
 checks.push({check:'client_rendered',passed:(await page.locator('#root').innerText()).trim().length>30});
 for(const [path,allowed] of [['/api/ready',[200]],['/api/health',[200]],['/api/openapi.json',[200]],['/api/me',[401]],['/.env',[403,404]],['/token.txt',[403,404]]]) {
  const r=await context.request.get(origin+path,{timeout:15000});
  let valid=allowed.includes(r.status());
  if(valid&&path==='/api/ready')valid=(await r.json()).ready===true;
  if(valid&&path==='/api/health')valid=(await r.json()).status==='ok';
  if(valid&&path==='/api/openapi.json'){const data=await r.json();valid=!!data.openapi&&!!data.paths?.['/api/assignments'];}
  checks.push({check:path,status:r.status(),passed:valid});
 }
 await page.screenshot({path:dir+'/landing.png',fullPage:true});
 checks.push({check:'no_uncaught_browser_error',passed:errors.length===0});
 const result={origin,checked_at:new Date().toISOString(),method:'GET only; unauthenticated; valid TLS required',checks,not_tested:['authenticated user flows','live MAX','webhook registration','AI','POST demo-login denial','production data']};
 await writeFile(dir+'/result.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
 if(checks.some(c=>!c.passed))process.exitCode=1;
}catch(e){console.log('Read-only production check did not finish: '+e.name);process.exitCode=2;}finally{await browser.close();}
