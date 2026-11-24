import type { DemoState, Result } from '../domain/types.ts';
import { failure, success } from '../domain/types.ts';
import { validateDemoState } from '../domain/invariants.ts';
import { log } from '../shared/logger.ts';

export const STORAGE_KEY = 'supply-demo:v1';
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function loadDemoState(storage: StoragePort, seed: () => DemoState): Result<DemoState> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const result = validateDemoState(raw === null ? seed() : JSON.parse(raw));
    log(result.ok ? 'INFO' : 'WARNING', result.ok ? 'STATE_LOADED' : 'STATE_INVALID');
    return result;
  } catch { log('ERROR', 'STATE_READ_FAILED'); return failure('STORAGE_READ', 'Сохранённая демонстрация не читается. Повторите загрузку или восстановите исходный набор'); }
}
export function saveDemoState(storage: StoragePort, candidate: DemoState, expectedRevision: number, now = new Date().toISOString()): Result<DemoState> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const current = raw === null ? null : validateDemoState(JSON.parse(raw));
    if (current !== null && !current.ok) return current;
    const actual = current?.ok ? current.value.revision : 0;
    if (actual !== expectedRevision) { log('WARNING', 'STATE_REVISION_CONFLICT'); return failure('REVISION_CONFLICT', 'Данные уже изменились. Повторите загрузку и проверьте действие'); }
    const next = { ...candidate, revision: expectedRevision + 1, saved_at: now };
    const checked = validateDemoState(next); if (!checked.ok) return checked;
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    log('INFO', 'STATE_SAVED'); return success(next);
  } catch { log('ERROR', 'STATE_WRITE_FAILED'); return failure('STORAGE_WRITE', 'Не удалось сохранить изменения в этом браузере. Прежние данные не изменены. Повторите попытку'); }
}
export function selectDemoUser(storage: StoragePort, state: DemoState, userId: string): Result<DemoState> {
  if (!state.data.users.some(user => user.id === userId && user.is_active)) return failure('USER_NOT_FOUND', 'Участник не найден в демонстрации');
  return saveDemoState(storage, { ...state, selected_user_id: userId }, state.revision);
}
export function resetDemoState(storage: StoragePort, seed: () => DemoState, confirmed: boolean): Result<DemoState> {
  if (!confirmed) return failure('RESET_CANCELLED', 'Сброс отменён');
  try {
    const raw = storage.getItem(STORAGE_KEY); let previousRevision = 0;
    if (raw !== null) { try { const previous = validateDemoState(JSON.parse(raw)); if (previous.ok) previousRevision = previous.value.revision; } catch { /* Explicitly confirmed recovery of unreadable data. */ } }
    const next = { ...seed(), revision: previousRevision + 1, saved_at: new Date().toISOString() };
    const checked = validateDemoState(next); if (!checked.ok) return checked;
    storage.setItem(STORAGE_KEY, JSON.stringify(next)); log('INFO', 'STATE_RESET'); return success(next);
  } catch { log('ERROR', 'STATE_RESET_FAILED'); return failure('STORAGE_WRITE', 'Не удалось восстановить набор. Прежние сведения не удалены. Проверьте доступ к хранилищу и повторите'); }
}
