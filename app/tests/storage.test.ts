import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../src/demo/seed.ts';
import { controlStorage } from '../src/demo/control-cases.ts';
import { STORAGE_KEY, loadDemoState, saveDemoState, resetDemoState, selectDemoUser } from '../src/state/storage.ts';
import type { StoragePort } from '../src/state/storage.ts';
class MemoryStorage implements StoragePort {
  data = new Map<string, string>(); writes = 0; denyRead = false; denyWrite = false;
  getItem(key: string) { if (this.denyRead) throw new Error('READ_DENIED'); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.denyWrite) throw new Error('WRITE_DENIED'); this.data.set(key, value); this.writes++; }
}
test('первый запуск читает подготовленный набор, повтор не создаёт операции', () => {
  const storage = new MemoryStorage(); const first = loadDemoState(storage, createSeedState);
  assert.equal(first.ok, true); assert.equal(storage.writes, 0);
  const selected = selectDemoUser(storage, createSeedState(), 'M1'); assert.equal(selected.ok, true);
  const loaded = loadDemoState(storage, createSeedState);
  assert.equal(loaded.ok, true);
  if (loaded.ok) { assert.equal(loaded.value.selected_user_id, 'M1'); assert.equal(loaded.value.data.requests.length, 1); assert.equal(loaded.value.revision, 1); }
});
test('отказ записи не подменяет выбранного участника и не меняет сохранённое', () => {
  const storage = new MemoryStorage(); const first = selectDemoUser(storage, createSeedState(), 'M1'); assert(first.ok);
  const previous = storage.getItem(STORAGE_KEY); storage.denyWrite = true;
  assert.equal(selectDemoUser(storage, first.value, 'D1').ok, false);
  assert.equal(storage.getItem(STORAGE_KEY), previous); assert.equal(first.value.selected_user_id, 'M1');
});
test('неизвестный участник не становится случайным сотрудником', () => {
  const storage = new MemoryStorage(); assert.equal(selectDemoUser(storage, createSeedState(), 'missing').ok, false); assert.equal(storage.writes, 0);
});
test('повреждённая и несовместимая запись не сбрасываются молча', () => {
  for (const content of ['{broken', JSON.stringify({ ...createSeedState(), schema_version: 999 })]) {
    const storage = new MemoryStorage(); storage.data.set(STORAGE_KEY, content);
    assert.equal(loadDemoState(storage, createSeedState).ok, false);
    assert.equal(saveDemoState(storage, createSeedState(), 0).ok, false);
    assert.equal(storage.getItem(STORAGE_KEY), content); assert.equal(storage.writes, 0);
  }
});
test('отмена сброса сохраняет всё, подтверждение сбрасывает и увеличивает revision', () => {
  const storage = new MemoryStorage(); const one = selectDemoUser(storage, createSeedState(), 'M1'); assert(one.ok);
  const two = selectDemoUser(storage, one.value, 'D1'); assert(two.ok);
  const previous = storage.getItem(STORAGE_KEY);
  assert.equal(resetDemoState(storage, createSeedState, false).ok, false); assert.equal(storage.getItem(STORAGE_KEY), previous);
  const reset = resetDemoState(storage, createSeedState, true); assert(reset.ok);
  assert.equal(reset.value.selected_user_id, null); assert.equal(reset.value.revision, 3);
  assert.equal(saveDemoState(storage, two.value, two.value.revision).ok, false);
});
test('явно подтверждённое восстановление исправляет нечитаемый набор', () => {
  const storage = new MemoryStorage(); storage.data.set(STORAGE_KEY, 'broken');
  assert.equal(resetDemoState(storage, createSeedState, true).ok, true);
  assert.equal(loadDemoState(storage, createSeedState).ok, true);
});
test('устаревшая форма и недоступное хранилище не записывают новое состояние', () => {
  const storage = new MemoryStorage(); selectDemoUser(storage, createSeedState(), 'M1');
  assert.equal(selectDemoUser(storage, createSeedState(), 'D1').ok, false);
  storage.denyRead = true; assert.equal(loadDemoState(storage, createSeedState).ok, false);
});
test('контрольные ошибки воспроизводимы и не повреждают исходное хранилище', () => {
  const storage = new MemoryStorage(); const first = selectDemoUser(storage, createSeedState(), 'M1'); assert(first.ok);
  const before = storage.getItem(STORAGE_KEY);
  for (const mode of ['corrupt', 'incompatible', 'load-error'] as const) assert.equal(loadDemoState(controlStorage(storage, mode), createSeedState).ok, false);
  assert.equal(selectDemoUser(controlStorage(storage, 'save-error'), first.value, 'D1').ok, false);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});
