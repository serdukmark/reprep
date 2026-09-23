const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('apps/client/src/max.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function load(hash, search='', window={}) {
  const ctx={exports:{},location:{hash,search},window,URLSearchParams,document:{documentElement:{classList:{add(){}}}},setTimeout};
  vm.runInNewContext(code,ctx);return ctx.exports;
}
const tg=load('#tgWebAppData='+encodeURIComponent('signed+data'));
assert.equal(tg.inTelegram,true);assert.equal(tg.launchData(),'signed+data');
const refresh=load('','?platform=telegram');assert.equal(refresh.inTelegram,true);assert.throws(()=>refresh.launchData());
assert.throws(()=>load('#tgWebAppData=a&tgWebAppData=b').launchData());
assert.throws(()=>load('#tgWebAppData=a&WebAppData=b').launchData());
const max=load('#WebAppData=max-signed');assert.equal(max.inTelegram,false);assert.equal(max.launchData(),'max-signed');
let ready=0,expand=0,closing=0,back=0;
const bridge=load('#tgWebAppData=a','',{Telegram:{WebApp:{initData:'sdk-signed',ready(){ready++},expand(){expand++},enableClosingConfirmation(){closing++},BackButton:{show(){},hide(){},onClick(f){f()},offClick(){}}}}});
(async()=>{await bridge.initializeMax();bridge.closingConfirmation(true);bridge.bindMaxBack(()=>back++);assert.equal(bridge.launchData(),'sdk-signed');assert.deepEqual([ready,expand,closing,back],[1,1,1,1]);console.log('Telegram/MAX bridge checks passed (mock SDK; no GUI input).')})().catch(()=>process.exit(1));
