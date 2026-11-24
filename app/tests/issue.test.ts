import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../src/demo/seed.ts';
import { prepareIssue, postIssue } from '../src/domain/issue.ts';
import type { IssueInput } from '../src/domain/issue.ts';
import type { DemoState } from '../src/domain/types.ts';
import { validateDemoState } from '../src/domain/invariants.ts';
import { currentStock, documentStatus } from '../src/domain/status.ts';
import { commitDemoCommand } from '../src/state/commands.ts';
import { STORAGE_KEY, loadDemoState, selectDemoUser } from '../src/state/storage.ts';
import type { StoragePort } from '../src/state/storage.ts';
function state() { const s = createSeedState(); s.selected_user_id = 'K1'; return s; }
function input(s: DemoState, requestId = 'request-control'): IssueInput {
  const request = s.data.requests.find(r => r.id === requestId)!; const item = s.data.items.find(i => i.id === request.item_id)!;
  return { requestId, actorId: 'K1', recipientId: 'D1', attemptId: 'attempt-1', occurredAt: '2026-11-19T12:00:00+12:00', itemId: request.item_id, vehicleId: request.vehicle_id, vin: s.data.vehicles.find(v => v.id === request.vehicle_id)!.vin, quantity: request.quantity, unitId: item.unit_id };
}
function port(s: DemoState) {
  const adapter: StoragePort & { raw: string; writes: number; deny: boolean } = { raw: JSON.stringify(s), writes: 0, deny: false, getItem: (_key: string) => adapter.raw, setItem: (_key: string, value: string) => { if (adapter.deny) throw Error('WRITE_FAILED'); adapter.raw = value; adapter.writes++; } };
  return adapter;
}
test('конфликт не пишет данные; после явного обновления команда сохраняется один раз', () => {
  const stale = state(); const storage = port(stale);
  const updated = selectDemoUser(storage, stale, 'K1'); assert(updated.ok);
  const before = storage.raw; const writes = storage.writes;
  const conflict = commitDemoCommand(storage, stale, current => prepareIssue(current, input(stale)));
  assert(!conflict.ok); assert.equal(conflict.code, 'REVISION_CONFLICT');
  assert.match(conflict.message, /Обновите данные/);
  assert.equal(storage.raw, before); assert.equal(storage.writes, writes);
  const loaded = loadDemoState(storage, () => stale); assert(loaded.ok);
  const saved = commitDemoCommand(storage, loaded.value, current => prepareIssue(current, input(stale)));
  assert(saved.ok); assert.equal(storage.writes, writes + 1);
  const repeated = commitDemoCommand(storage, loaded.value, current => prepareIssue(current, input(stale)));
  assert(repeated.ok); assert.equal(repeated.value.changed, false);
  assert.equal(storage.writes, writes + 1);
  assert.equal(saved.value.state.data.stock_movements.length, 0);
});
test('подготовка сохраняет один документ, без резерва, движения и расхода', () => {
  const s = state(); const out = prepareIssue(s, input(s)); assert(out.ok);
  assert.equal(out.value.state.data.documents.length, s.data.documents.length + 1);
  assert.equal(out.value.state.data.stock_movements.length, 0); assert.equal(out.value.state.data.financial_operations.length, s.data.financial_operations.length);
  assert.equal(currentStock(out.value.state, 'warehouse-main', 'P-001'), '10');
  assert.equal(validateDemoState(out.value.state).ok, true);
});
test('уточнение получателя PREPARED сохраняет тот же документ без движения; проведение использует новый выбор', () => {
  const s = state(); const storage = port(s);
  const first = commitDemoCommand(storage, s, current => prepareIssue(current, input(s))); assert(first.ok);
  const second = commitDemoCommand(storage, first.value.state, current => prepareIssue(current, {...input(s), recipientId:'D2'})); assert(second.ok);
  assert.equal(second.value.entityId, first.value.entityId); assert.equal(second.value.changed, true);
  const prepared = second.value.state.data.documents.find(doc=>doc.id===first.value.entityId)!;
  assert.equal(prepared.recipient_user_id,'D2'); assert.equal(prepared.posting_state,'PREPARED');
  assert.equal(second.value.state.data.documents.filter(doc=>doc.kind==='ISSUE').length,1);
  assert.equal(second.value.state.data.stock_movements.length,0);
  assert.equal(second.value.state.data.financial_operations.length,s.data.financial_operations.length);
  const repeated=commitDemoCommand(storage,second.value.state,current=>prepareIssue(current,{...input(s),recipientId:'D2'}));assert(repeated.ok);assert.equal(repeated.value.changed,false);
  const posted=commitDemoCommand(storage,second.value.state,current=>postIssue(current,{...input(s),recipientId:'D2'}));assert(posted.ok);
  assert.equal(posted.value.state.data.documents.find(doc=>doc.id===first.value.entityId)!.recipient_user_id,'D2');
  assert.equal(posted.value.state.data.stock_movements.length,1);
  const immutable=prepareIssue(posted.value.state,input(s));assert(immutable.ok);
  assert.equal(immutable.value.changed,false);assert.equal(immutable.value.state.data.documents.find(doc=>doc.id===first.value.entityId)!.recipient_user_id,'D2');
});
test('выдача одновременно создаёт документ, сторону склада, движение и расход ровно один раз', () => {
  const s = state(); const storage = port(s);
  const one = commitDemoCommand(storage, s, value => postIssue(value, input(s))); assert(one.ok);
  const next = one.value.state; const doc = next.data.documents.find(d => d.id === one.value.entityId)!;
  assert.equal(doc.posting_state, 'POSTED'); assert.equal(doc.amount_minor, 100000);
  assert.equal(doc.recipient_user_id, 'D1'); assert.equal(next.data.requests[0].author_user_id, 'M1');
  assert.equal(currentStock(next, 'warehouse-main', 'P-001'), '8');
  assert.equal(next.data.confirmations.length, 1); assert.equal(next.data.stock_movements.length, 1);
  assert.equal(next.data.financial_operations.filter(f => f.document_id === doc.id).length, 1);
  assert.equal(documentStatus(next, doc), 'Выдан — ожидает подтверждения получателя');
  const two = commitDemoCommand(storage, s, value => postIssue(value, { ...input(s), attemptId: 'different-attempt' })); assert(two.ok);
  assert.equal(two.value.changed, false); assert.equal(storage.writes, 1); assert.equal(currentStock(two.value.state, 'warehouse-main', 'P-001'), '8');
});
test('цена null разрешает физическую выдачу, но не становится нулём', () => {
  const s = state(); s.data.items[0].reference_unit_price_minor = null;
  const out = postIssue(s, input(s)); assert(out.ok);
  assert.equal(out.value.state.data.documents.at(-1)!.amount_minor, null);
  assert.equal(out.value.state.data.financial_operations.at(-1)!.amount_minor, null);
  assert.equal(validateDemoState(out.value.state).ok, true);
});
test('проверки детали, машины, единицы, количества и получателя блокируют проведение', () => {
  const s = state(); const original = JSON.stringify(s);
  const wrong: Partial<IssueInput>[] = [{ itemId: 'P-002' }, { vehicleId: 'B' }, { vin: 'XTEST000000000002' }, { unitId: 'meter' }, { quantity: '3' }, { quantity: '0' }, { quantity: '2.5' }, { recipientId: '' }, { recipientId: 'F1' }, { requestId: 'missing' }, { actorId: 'F1' }];
  for (const change of wrong) assert.equal(postIssue(s, { ...input(s), ...change }).ok, false, JSON.stringify(change));
  assert.equal(JSON.stringify(s), original);
});
test('неизвестный VIN, нехватка, неизвестное наличие и отмена не создают операций', () => {
  for (const kind of ['vin', 'shortage', 'unknown', 'cancelled']) {
    const s = state();
    if (kind === 'vin') s.data.vehicles[0].vin = null;
    if (kind === 'shortage') s.data.stock_positions[0].initial_quantity = '1';
    if (kind === 'unknown') s.data.stock_positions[0].initial_quantity = null;
    if (kind === 'cancelled') s.data.requests[0].cancelled_at = '2026-11-18T12:00:00+12:00';
    assert.equal(postIssue(s, input(s)).ok, false, kind); assert.equal(s.data.stock_movements.length, 0);
  }
});
test('при отказе записи сохраняется весь прежний снимок', () => {
  const s = state(); const storage = port(s); storage.deny = true; const before = storage.raw;
  assert.equal(commitDemoCommand(storage, s, current => postIssue(current, input(s))).ok, false);
  assert.equal(storage.raw, before); assert.equal(storage.writes, 0);
});
test('утраченный после успешного сохранения ответ восстанавливается без повторного списания', () => {
  const s = state(); const storage = port(s);
  commitDemoCommand(storage, s, current => postIssue(current, input(s)));
  const retry = commitDemoCommand(storage, s, current => postIssue(current, input(s))); assert(retry.ok);
  assert.equal(retry.value.state.data.stock_movements.length, 1); assert.equal(storage.writes, 1);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).revision, 1);
});
test('непосредственно перед проведением проверяется новое сохранённое наличие', () => {
  const s = state(); const storage = port(s); const changed = structuredClone(s); changed.revision = 1; changed.data.stock_positions[0].initial_quantity = '1'; storage.raw = JSON.stringify(changed);
  const out = commitDemoCommand(storage, s, current => postIssue(current, input(s)));
  assert.equal(out.ok, false); if (!out.ok) assert.equal(out.code, 'STOCK_SHORTAGE'); assert.equal(storage.writes, 0);
});
test('два подготовленных документа связаны с правильными заявками; номера уникальны', () => {
  const s = state(); s.data.requests.push({ ...s.data.requests[0], id: 'request-B', number: 'З-0002', vehicle_id: 'B' });
  const first = prepareIssue(s, input(s)); assert(first.ok);
  const second = prepareIssue(first.value.state, { ...input(s, 'request-B'), attemptId: 'attempt-2' }); assert(second.ok);
  const docs = second.value.state.data.documents.filter(d => d.kind === 'ISSUE');
  assert.equal(docs[0].vehicle_id, 'A'); assert.equal(docs[1].vehicle_id, 'B'); assert.notEqual(docs[0].number, docs[1].number);
  assert.equal(validateDemoState(second.value.state).ok, true);
});
