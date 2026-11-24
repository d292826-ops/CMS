import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../src/demo/seed.ts';
import { createControlDataset } from '../src/demo/control-cases.ts';
import { STORAGE_KEY, saveDemoState } from '../src/state/storage.ts';
import type { StoragePort } from '../src/state/storage.ts';
import { BACKUP_KEY, MAX_BACKUPS, MAX_BACKUP_BYTES, createBackup, parseBackup, readBackups, restartBackupHistory, restoreBackup, withAutomaticBackups } from '../src/state/backups.ts';

class Memory implements StoragePort {
  data = new Map<string, string>();
  blocked: string | null = null;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (key === this.blocked) throw new Error('DENIED'); this.data.set(key, value); }
}
const checkedCopy = () => { const result = createBackup(createControlDataset('issued-price-changed')); assert(result.ok); return result.value; };
test('JSON возвращает полный снимок выданной детали по исторической цене, а копия не делит ссылки с исходником', () => {
  const state = createControlDataset('issued-price-changed'); const result = createBackup(state); assert(result.ok);
  const parsed = parseBackup(JSON.stringify(result.value)); assert(parsed.ok);
  assert.deepEqual(parsed.value.state.data, state.data);
  state.data.requests[0].comment = 'changed';
  assert.notEqual(parsed.value.state.data.requests[0].comment, 'changed');
});
test('повреждённые JSON, формат, версия, связи и посторонние поля отклоняются', () => {
  const copy = checkedCopy();
  const invalid = [null, {}, { ...copy, format: 'another' }, { ...copy, secret: 'not-allowed' },
    { ...copy, created_at: 'yesterday' }, { ...copy, state: { ...copy.state, schema_version: 999 } },
    { ...copy, state: { ...copy.state, toString: 'not-allowed' } }];
  const broken = structuredClone(copy); broken.state.data.stock_movements[0].quantity_delta = '-999'; invalid.push(broken);
  for (const value of invalid) assert.equal(parseBackup(JSON.stringify(value)).ok, false);
  assert.equal(parseBackup('{broken').ok, false);
  assert.equal(parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1)).ok, false);
});
test('автокопия сохраняет состояние до изменения, история вращается до десяти записей', () => {
  const base = new Memory(); const storage = withAutomaticBackups(base);
  let state = createSeedState(); base.setItem(STORAGE_KEY, JSON.stringify(state));
  for (let i = 0; i < 15; i++) {
    const result = saveDemoState(storage, { ...state, selected_user_id: i % 2 ? 'M1' : 'K1' }, state.revision);
    assert(result.ok); state = result.value;
  }
  const history = readBackups(storage); assert(history.ok);
  assert.equal(history.value.length, MAX_BACKUPS); assert.equal(history.value[0].state.revision, 14);
  assert.equal(history.value.at(-1)?.state.revision, 5); assert.equal(state.revision, 15);
});
test('объём истории ограничен двумя МБ с удалением только самых старых копий', () => {
  const base = new Memory(); const storage = withAutomaticBackups(base);
  let state = createSeedState(); state.data.requests[0].comment = 'a'.repeat(650000);
  base.setItem(STORAGE_KEY, JSON.stringify(state));
  for (let i = 0; i < 7; i++) { const r = saveDemoState(storage, state, state.revision); assert(r.ok); state = r.value; }
  const history = readBackups(storage); assert(history.ok);
  assert(history.value.length > 0 && history.value.length < MAX_BACKUPS);
  assert(new TextEncoder().encode(base.getItem(BACKUP_KEY)!).length <= MAX_BACKUP_BYTES);
  assert.equal(history.value[0].state.revision, 6);
});
test('отказ записи автокопии не меняет первичные данные', () => {
  const base = new Memory(); const state = createSeedState(); base.setItem(STORAGE_KEY, JSON.stringify(state));
  const before = base.getItem(STORAGE_KEY); base.blocked = BACKUP_KEY;
  const result = saveDemoState(withAutomaticBackups(base), { ...state, selected_user_id: 'M1' }, 0);
  assert.equal(result.ok, false); if (!result.ok) assert.match(result.message, /автокопию/);
  assert.equal(base.getItem(STORAGE_KEY), before); assert.equal(base.getItem(BACKUP_KEY), null);
});
test('отказ основной записи оставляет страховочную копию; повтор не дублирует историю', () => {
  const base = new Memory(); const state = createSeedState(); base.setItem(STORAGE_KEY, JSON.stringify(state));
  const storage = withAutomaticBackups(base); base.blocked = STORAGE_KEY;
  assert.equal(saveDemoState(storage, state, 0).ok, false);
  const historyBefore = base.getItem(BACKUP_KEY); base.blocked = null;
  assert.equal(saveDemoState(storage, state, 0).ok, true); assert.equal(base.getItem(BACKUP_KEY), historyBefore);
});
test('восстановление заменяет снимок, не повторяет выдачу и поднимает ревизию; прежнее состояние доступно для отмены', () => {
  const base = new Memory(); const before = { ...createSeedState(), revision: 100 };
  base.setItem(STORAGE_KEY, JSON.stringify(before)); const raw = base.getItem(STORAGE_KEY);
  const copy = checkedCopy(); const result = restoreBackup(withAutomaticBackups(base), copy, raw); assert(result.ok);
  assert.equal(result.value.revision, 101); assert.deepEqual(result.value.data, copy.state.data);
  assert.equal(result.value.data.stock_movements.length, 1);
  const history = readBackups(base); assert(history.ok); assert.deepEqual(history.value[0].state, before);
});
test('копия переносится в чистое хранилище, а повреждённое основное сохранение восстанавливается без повторных движений', () => {
  for (const raw of [null, '{broken']) {
    const base = new Memory(); if (raw !== null) base.setItem(STORAGE_KEY, raw);
    const copy = checkedCopy(); const result = restoreBackup(withAutomaticBackups(base), copy, raw); assert(result.ok);
    assert.deepEqual(result.value.data, copy.state.data); assert.equal(result.value.data.stock_movements.length, 1);
  }
});
test('изменение в другой вкладке после предпросмотра блокирует восстановление без побочных записей', () => {
  const base = new Memory(); const state = createSeedState(); const raw = JSON.stringify(state);
  base.setItem(STORAGE_KEY, JSON.stringify({ ...state, revision: 2 }));
  const before = [...base.data]; const result = restoreBackup(withAutomaticBackups(base), checkedCopy(), raw);
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, 'REVISION_CONFLICT');
  assert.deepEqual([...base.data], before);
});
test('повреждённая история не затирается молча; явное начало новой истории не меняет демонстрацию', () => {
  const base = new Memory(); const state = createSeedState(); base.setItem(STORAGE_KEY, JSON.stringify(state)); base.setItem(BACKUP_KEY, '{broken');
  const storage = withAutomaticBackups(base); assert.equal(readBackups(storage).ok, false);
  assert.equal(saveDemoState(storage, state, 0).ok, false); assert.equal(base.getItem(BACKUP_KEY), '{broken');
  const before = base.getItem(STORAGE_KEY); assert.equal(restartBackupHistory(storage).ok, true);
  assert.equal(base.getItem(STORAGE_KEY), before); assert.equal(saveDemoState(storage, state, 0).ok, true);
});
