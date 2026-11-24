import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedState} from '../src/demo/seed.ts';
import {createControlDataset} from '../src/demo/control-cases.ts';
import {calculateVehicleResult} from '../src/domain/finance.ts';
import {incomeActivity,incomeBreakdown,resultBreakdown,vehicleTrend} from '../src/domain/dashboard.ts';
import {postIssue} from '../src/domain/issue.ts';
import {validateDemoState} from '../src/domain/invariants.ts';

function summary(state=createSeedState(),id='A',period='2026-11'){
  const result=calculateVehicleResult(state,id,period);assert(result.ok);return result.value;
}
test('прибыль и убыток представлены положительными секторами с понятным основанием',()=>{
  const positive=resultBreakdown(summary());assert.equal(positive.label,'В плюсе');
  assert.equal(positive.result,400000);assert.deepEqual(positive.slices.map(s=>s.amount),[100000,400000]);
  assert.equal(positive.slices.reduce((total,s)=>total+s.percent,0),100);
  const loss=resultBreakdown(summary(createSeedState(),'B'));assert.equal(loss.label,'В минусе');
  assert.equal(loss.result,-40000);assert.deepEqual(loss.slices.map(s=>s.amount),[60000,40000]);
  assert.equal(loss.slices.reduce((total,s)=>total+s.percent,0),100);
});
test('нулевые, неизвестные и отрицательные корректировки не превращаются в ложную прибыльную диаграмму',()=>{
  const zero=resultBreakdown(summary(createControlDataset('zero-values')));assert.equal(zero.label,'В ноль');assert.equal(zero.result,0);assert.equal(zero.slices.length,0);
  for(const id of ['unknown-income','partial-expenses','unknown-price'] as const){
    const state=createControlDataset(id);
    if(id==='unknown-price'){
      state.selected_user_id='K1';const issued=postIssue(state,{requestId:'request-control',actorId:'K1',recipientId:'D1',attemptId:'dashboard-null',occurredAt:'2026-11-24T12:00:00+12:00',itemId:'P-001',vehicleId:'A',vin:state.data.vehicles[0].vin,quantity:'2',unitId:'pcs'});assert(issued.ok);
      const ring=resultBreakdown(summary(issued.value.state));assert.equal(ring.result,null);assert.equal(ring.slices.length,0);
    }else{const ring=resultBreakdown(summary(state));assert.equal(ring.result,null);assert.equal(ring.slices.length,0);}
  }
  const reverse=createSeedState();reverse.data.financial_operations.push({...reverse.data.financial_operations[0],id:'credit',article_id:'parts',amount_minor:-200000});
  const adjusted=resultBreakdown(summary(reverse));assert.equal(adjusted.result,600000);assert.equal(adjusted.slices.length,0);assert.match(adjusted.note,/корректировки/);
});
test('пример трёх машин и трёх месяцев соответствует схеме, источникам и заданным итогам',()=>{
  const state=createControlDataset('management-dashboard');assert.equal(validateDemoState(state).ok,true);
  assert.deepEqual(state.data.vehicles.map(v=>v.id),['A','B','C']);
  for(const id of ['A','B','C'])for(const period of ['2026-09','2026-10','2026-11'])assert.equal(summary(state,id,period).status,'COMPLETE');
  assert.deepEqual([summary(state).income,summary(state).expenses,summary(state).result],[66000000,46500000,19500000]);
  assert.equal(summary(state,'B').result,22000000);assert.equal(summary(state,'C').result,-7500000);
  assert.equal(incomeBreakdown(summary(state)).reduce((sum,row)=>sum+(row.amount??0),0),summary(state).income);
  assert.deepEqual(incomeBreakdown(summary(state,'B')).map(row=>row.id),['rental','work']);
  assert.equal(state.data.stock_movements.length,0);assert.equal(state.data.confirmations.length,0);
});
test('категории дохода сохраняют неизвестность и не теряют прочие источники',()=>{
  assert.equal(incomeActivity('Доставка щебня'),'delivery');assert.equal(incomeActivity('Аренда автокрана'),'rental');assert.equal(incomeActivity('Работа экскаватора'),'work');assert.equal(incomeActivity(null),'other');
  const unknown=incomeBreakdown(summary(createControlDataset('unknown-income')));assert(unknown.every(row=>row.amount===null));
});
test('динамика использует выбранную машину и корректно переходит между годами; нет данных не ноль',()=>{
  const trend=vehicleTrend(createControlDataset('management-dashboard'),'C','2026-11');
  assert.deepEqual(trend.map(row=>row.period),['2026-09','2026-10','2026-11']);assert.deepEqual(trend.map(row=>row.result),[8500000,2000000,-7500000]);
  const edge=vehicleTrend(createSeedState(),'A','2026-01');assert.deepEqual(edge.map(row=>row.period),['2025-11','2025-12','2026-01']);assert(edge.every(row=>row.result===null));
  assert.deepEqual(vehicleTrend(createSeedState(),'A','invalid'),[]);
});
test('реальная учебная выдача обновляет финансовый результат и сектор расходов',()=>{
  const state=createControlDataset('management-dashboard');state.selected_user_id='K1';
  const issued=postIssue(state,{requestId:'request-control',actorId:'K1',recipientId:'D1',attemptId:'dashboard-issue',occurredAt:'2026-11-24T12:00:00+12:00',itemId:'P-001',vehicleId:'A',vin:state.data.vehicles[0].vin,quantity:'2',unitId:'pcs'});assert(issued.ok);
  assert.equal(resultBreakdown(summary(issued.value.state)).result,19400000);
  assert.equal(resultBreakdown(summary(issued.value.state)).slices[0].amount,46600000);
});
