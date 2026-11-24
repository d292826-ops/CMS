import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuantity, sumQuantities } from '../src/domain/quantity.ts';
import { multiplyMoneyHalfUp, sumMoney } from '../src/domain/money.ts';
import { getAccountingDate, isDateOnly, isInstant } from '../src/domain/dates.ts';
import { createSeedState } from '../src/demo/seed.ts';
import { validateDemoState } from '../src/domain/invariants.ts';
import { log } from '../src/shared/logger.ts';

test('количество: десятичная запятая сохраняет смысл, точность не округляется молча', () => {
  assert.deepEqual(parseQuantity('1,5', 3, true), { ok: true, value: '1.5' });
  assert.equal(parseQuantity('1.5', 0, true).ok, false);
  assert.equal(parseQuantity('1.2345', 3, true).ok, false);
  for (const input of ['0', '-1', 'abc', '1e3', '', 'Infinity']) assert.equal(parseQuantity(input, 3, true).ok, false, input);
  assert.equal(sumQuantities(['0.1', '0.2', '-0.3']), '0');
  assert.equal(parseQuantity('1000000000000', 3).ok, false);
});
test('деньги: точные копейки, half-up и неизвестная цена', () => {
  assert.deepEqual(multiplyMoneyHalfUp(50000, '2'), { ok: true, value: 100000 });
  assert.deepEqual(multiplyMoneyHalfUp(1, '0.5'), { ok: true, value: 1 });
  assert.deepEqual(multiplyMoneyHalfUp(null, '2'), { ok: true, value: null });
  assert.deepEqual(multiplyMoneyHalfUp(0, '2'), { ok: true, value: 0 });
  assert.equal(multiplyMoneyHalfUp(Number.MAX_SAFE_INTEGER, '2').ok, false);
  assert.equal(multiplyMoneyHalfUp(NaN, '2').ok, false);
  assert.deepEqual(sumMoney([100000, -100000]), { ok: true, value: 0 });
  assert.equal(sumMoney([Number.MAX_SAFE_INTEGER, 1]).ok, false);
});
test('дата учёта: граница месяца в Камчатке и недопустимые даты', () => {
  assert.equal(getAccountingDate('2026-11-30T12:30:00Z'), '2026-12-01');
  assert.equal(getAccountingDate('2026-11-30T11:30:00Z'), '2026-11-30');
  assert.equal(isDateOnly('2026-02-30'), false);
  assert.equal(isInstant('2026-02-30T00:00:00Z'), false);
});
test('исходный набор валиден; все 13 коллекций существуют, два SOURCE могут иметь один номер', () => {
  const state = createSeedState(); assert.equal(Object.keys(state.data).length, 13);
  assert.equal(validateDemoState(state).ok, true);
  assert.equal(state.data.documents.filter(d => d.number === 'Д-001').length, 2);
});
test('битые связи, дубли VIN и складской пары, лишние секретные поля не принимаются', () => {
  const mutations = [
    (s: ReturnType<typeof createSeedState>) => { s.data.items[0].unit_id = 'missing-unit'; },
    (s: ReturnType<typeof createSeedState>) => { s.data.vehicles[1].vin = s.data.vehicles[0].vin; },
    (s: ReturnType<typeof createSeedState>) => { s.data.stock_positions.push({ ...s.data.stock_positions[0], id: 'second-stock' }); },
    (s: ReturnType<typeof createSeedState>) => { Object.assign(s.data.users[0], { password_hash: 'not-allowed-in-demo' }); },
    (s: ReturnType<typeof createSeedState>) => { s.data.financial_operations[0].amount_minor = NaN; },
    (s: ReturnType<typeof createSeedState>) => { s.data.users.push({ ...s.data.users[3], id: 'K2' }); },
  ];
  for (const mutation of mutations) { const state = createSeedState(); mutation(state); assert.equal(validateDemoState(state).ok, false); }
});
test('журнал содержит уровень и код, произвольный текст и поля не утекут', () => {
  const output: unknown[] = [];
  log('INFO', 'STATE_LOADED', 'attempt-1', entry => output.push(entry));
  log('ERROR', 'password=example', 'private data with spaces', entry => output.push(entry));
  assert.deepEqual(output, [{ level: 'INFO', event: 'STATE_LOADED', attempt: 'attempt-1' }, { level: 'ERROR', event: 'UNSAFE_EVENT_REDACTED' }]);
});
