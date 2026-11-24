import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../src/demo/seed.ts';
import { createControlDataset, DATASETS } from '../src/demo/control-cases.ts';
import { calculateVehicleResult } from '../src/domain/finance.ts';
import { postIssue } from '../src/domain/issue.ts';
import { validateDemoState } from '../src/domain/invariants.ts';
import { formatMoney } from '../src/ui/format.ts';
function summary(s = createSeedState(), id = 'A', period = '2026-11') { const r = calculateVehicleResult(s, id, period); assert(r.ok); return r.value; }
test('контрольные суммы А и Б; выдача изменяет результат один раз', () => {
  const s = createSeedState(); assert.deepEqual([summary(s).income, summary(s).expenses, summary(s).result], [500000,100000,400000]);
  assert.equal(summary(s,'B').result,-40000); s.selected_user_id='K1';
  const out=postIssue(s,{requestId:'request-control',actorId:'K1',recipientId:'D1',attemptId:'test',occurredAt:'2026-11-19T12:00:00+12:00',itemId:'P-001',vehicleId:'A',vin:s.data.vehicles[0].vin,quantity:'2',unitId:'pcs'}); assert(out.ok);
  assert.equal(summary(out.value.state).expenses,200000); assert.equal(summary(out.value.state).result,300000);
});
test('нулевые значения отдельно от неизвестности и неподготовленного месяца',()=>{
  const zero=summary(createControlDataset('zero-values')); assert.equal(zero.result,0); assert.equal(zero.status,'COMPLETE');
  const unknown=summary(createControlDataset('unknown-income')); assert.equal(unknown.income,null); assert.equal(unknown.result,null); assert.equal(unknown.expenses,100000);
  const partial=summary(createControlDataset('partial-expenses')); assert.equal(partial.expenses,null); assert.equal(partial.expensesKnown,80000); assert.equal(partial.partialResult,420000); assert.equal(partial.result,null);
  const absent=summary(createSeedState(),'A','2026-12'); assert.equal(absent.prepared,false); assert.equal(absent.result,null); assert.equal(absent.status,'NOT_PREPARED');
});
test('все подготовленные наборы соответствуют схеме и связям',()=>{for(const d of DATASETS) assert.equal(validateDemoState(createControlDataset(d.id)).ok,true,d.id);});
test('одинаковая строка не удваивается, конфликтующая и неизвестная статья видимы как ошибка',()=>{
  const s=createSeedState(); s.data.financial_operations.push({...s.data.financial_operations[0]}); assert.equal(summary(s).result,400000);
  s.data.financial_operations.at(-1)!.amount_minor=1; assert.equal(summary(s).status,'ERROR'); assert.equal(summary(s).result,null);
  const other=createSeedState(); other.data.financial_operations[0].article_id='missing'; assert.equal(summary(other).unassigned.length,1); assert.equal(summary(other).status,'ERROR');
});
test('неопределённый состав, дубли покрытия, NaN и переполнение блокируют полный результат',()=>{
  const empty=createSeedState(); empty.data.financial_articles=[]; assert.equal(summary(empty).status,'ERROR');
  const dup=createSeedState(); dup.data.financial_coverage.push({...dup.data.financial_coverage[0]}); assert.equal(summary(dup).status,'ERROR');
  for(const invalid of [NaN,Infinity,Number.MAX_SAFE_INTEGER]) { const s=createSeedState(); s.data.financial_operations[0].amount_minor=invalid; assert.equal(summary(s).result,null); assert.equal(summary(s).status,'ERROR'); }
});
test('исключённая статья, обратный расход и границы периода не теряют знак или контекст',()=>{
  const s=createSeedState(); s.data.financial_operations.push({...s.data.financial_operations[0],id:'reverse',article_id:'parts',amount_minor:-10000}); assert.equal(summary(s).result,410000);
  s.data.financial_articles.find(a=>a.id==='parts')!.included_in_result=false; assert.equal(summary(s).result,400000);
  s.data.financial_operations.at(-1)!.accounting_date='2026-12-01'; assert.equal(summary(s).result,400000);
  assert.equal(calculateVehicleResult(s,'missing','2026-11').ok,false); assert.equal(calculateVehicleResult(s,'A','2026-13').ok,false);
});
test('представление денег отличает ноль, null, неприменимость и ошибочный формат',()=>{
  assert.match(formatMoney(0),/0/); assert.equal(formatMoney(null),'Нет данных'); assert.equal(formatMoney(undefined),'Не применяется'); assert.equal(formatMoney(NaN),'Ошибка данных');
});
