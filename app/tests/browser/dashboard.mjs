import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {connect} from './driver.mjs';
const b=await connect();const base=(process.env.SUPPLY_BASE_URL??'http://127.0.0.1:4173/').replace(/\/$/,'');
const out=new URL('../results/',import.meta.url);const checks=[];
const at=(path,mode='')=>b.go(base+'/'+(mode?'?case='+mode:'')+'#'+path);
const state=()=>b.evaluate('JSON.parse(localStorage.getItem("supply-demo:v1"))');
const money=text=>Number(text.replace(/[^\d,−-]/g,'').replace(',','.').replace('−','-'));
async function check(name,fn){await fn();checks.push({name,status:'PASS'});}
async function role(id){await at('/');await b.value('#participant',id);await b.click(await b.evaluate('document.querySelector("#participant").closest("form").querySelector("button").textContent.trim()'));}
async function reset(){await at('/');await b.click('Начать демонстрацию заново');await b.click('Восстановить исходный набор');}
async function dataset(id){await at('/');await b.evaluate('document.querySelectorAll("details").forEach(d=>d.open=true)');await b.value('#dataset',id);await b.click('Загрузить учебный пример');await b.click('Заменить демоданные');}
async function selectVehicle(id){await b.value('#filter-vehicle',id);await b.click('Показать');await b.wait('location.hash.startsWith("#/vehicles/'+id+'?")');}
try{
  await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await check('Открытие и отмена примера не меняют учебные действия',async()=>{
    await reset();await role('S1');await at('/vehicles/A?period=2026-11');
    assert.equal(await b.evaluate('!!document.querySelector("[data-finance-dashboard]")'),true);
    const before=JSON.stringify(await state());await b.click('Показать пример автопарка');await b.click('Отмена');assert.equal(JSON.stringify(await state()),before);
  });
  await check('Пример сохраняет собственника и показывает доходы от перевозок и аренды',async()=>{
    await b.click('Показать пример автопарка');await b.click('Открыть пример автопарка');await b.wait('document.querySelector("[data-profit-status]")?.textContent==="В плюсе"');
    const s=await state();assert.equal(s.selected_user_id,'S1');assert.equal(s.dataset_id,'management-dashboard');
    assert.deepEqual((await b.evaluate('[...document.querySelectorAll(".metric-value")].map(e=>e.textContent)')).map(money),[660000,465000,195000]);
    assert.equal(await b.evaluate('document.querySelector(".income-visual").textContent.includes("Перевозки и доставка")&&document.querySelector(".income-visual").textContent.includes("Аренда техники")'),true);
    assert.equal(await b.evaluate('document.querySelector(".profit-ring svg").getAttribute("aria-label").includes("В плюсе")'),true);
    await b.screenshot(fileURLToPath(new URL('dashboard-desktop.png',out)));
  });
  await check('Автокран и убыточный экскаватор имеют собственные доходы, расходы и круговую диаграмму',async()=>{
    await selectVehicle('B');assert.equal(money(await b.evaluate('document.querySelector("[data-result]").textContent')),220000);
    assert.equal(await b.evaluate('document.querySelector(".income-visual").textContent.includes("Работы спецтехники")'),true);
    await selectVehicle('C');assert.equal(await b.evaluate('document.querySelector("[data-profit-status]").textContent'),'В минусе');
    assert.equal(money(await b.evaluate('document.querySelector("[data-chart-result]").textContent')),-75000);
    const arcs=await b.evaluate('[...document.querySelectorAll(".ring-slice")].map(e=>e.getAttribute("stroke-dasharray"))');
    assert(arcs.length===2&&arcs.every(s=>!s.includes('NaN')&&!s.includes('Infinity')));
    assert.equal(await b.evaluate('document.querySelectorAll(".trend-month").length'),3);
  });
  await check('Финдиректор видит те же расчёты, а источник дохода открывается и возвращает контекст',async()=>{
    await role('F1');await at('/vehicles/B?period=2026-11');await b.click('Посмотреть доходные операции');await b.wait('!!document.querySelector("tbody")');
    await b.click('Открыть источник');await b.wait('!!document.querySelector(".document-details")');
    await b.click('Назад к списку');await b.wait('!!document.querySelector("[data-finance-dashboard]")');
    assert.equal(await b.evaluate('location.hash.includes("/vehicles/B?period=2026-11")'),true);
  });
  await check('Механик, водитель и кладовщик не видят финансовые дашборды',async()=>{
    for(const id of ['M1','D1','K1']){await role(id);await at('/vehicles/A?period=2026-11');assert.equal(await b.evaluate('!!document.querySelector("[data-finance-dashboard]")'),false);assert.equal(await b.evaluate('document.body.innerText.includes("Раздел недоступен")'),true);}
  });
  await check('Неизвестные доходы, нулевые суммы и ошибка расчёта не превращаются в прибыль',async()=>{
    await dataset('unknown-income');await role('F1');await at('/vehicles/A?period=2026-11');assert.equal(await b.evaluate('document.querySelector("[data-profit-status]").textContent'),'Недостаточно данных');assert.equal(await b.evaluate('document.querySelectorAll(".ring-slice").length'),0);
    await dataset('zero-values');await role('F1');await at('/vehicles/A?period=2026-11');assert.equal(await b.evaluate('document.querySelector("[data-profit-status]").textContent'),'В ноль');assert.equal(money(await b.evaluate('document.querySelector("[data-chart-result]").textContent')),0);
    assert.equal(await b.evaluate('document.querySelector(".income-visual").textContent.includes("часть сумм неизвестна")'),false);
    await at('/vehicles/A?period=2026-12');assert.equal(await b.evaluate('document.querySelector("[data-profit-status]").textContent'),'Недостаточно данных');
    await at('/vehicles/A?period=2026-11','calculation-error');assert.equal(await b.evaluate('!!document.querySelector("[data-finance-dashboard]")'),false);
  });
  await check('Мобильные 390px и 320px не переполняют страницу, подписи и значения доступны',async()=>{
    await dataset('management-dashboard');await role('S1');await at('/vehicles/C?period=2026-11');
    for(const width of [390,320]){
      await b.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'width '+width);
      assert.equal(await b.evaluate('document.querySelector("[data-profit-status]").textContent'),'В минусе');
      if(width===390)await b.screenshot(fileURLToPath(new URL('dashboard-mobile.png',out)));
    }
    await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  });
  assert.equal(b.exceptions.length,0);await reset();
  await fs.writeFile(new URL('dashboard.json',out),JSON.stringify({date:new Date().toISOString(),base,checks,exceptions:b.exceptions},null,2));
  console.log(JSON.stringify({checks:checks.length,exceptions:b.exceptions.length}));
}catch(error){await fs.writeFile(new URL('dashboard.json',out),JSON.stringify({checks,error:String(error),exceptions:b.exceptions},null,2));console.error(error);process.exitCode=1;}finally{b.close();}
