import type { DemoState, Result } from '../domain/types.ts';
import { failure, success } from '../domain/types.ts';
import { validateDemoState } from '../domain/invariants.ts';
import { isInstant } from '../domain/dates.ts';
import { log } from '../shared/logger.ts';
import { STORAGE_KEY } from './storage.ts';
import type { StoragePort } from './storage.ts';

export const BACKUP_KEY = 'supply-demo:backups:v1';
export const BACKUP_FORMAT = 'otdel-snabzheniya-backup-v1';
export const MAX_BACKUPS = 10;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export interface DemoBackup { format: typeof BACKUP_FORMAT; created_at: string; state: DemoState }
const bytes = (text: string) => new TextEncoder().encode(text).length;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const stateKeys = ['id', 'dataset_id', 'schema_version', 'revision', 'saved_at', 'selected_user_id', 'default_warehouse_id', 'currency', 'accounting_timezone', 'data'];

export function validateBackup(value: unknown): Result<DemoBackup> {
  if (!object(value) || Object.keys(value).length !== 3 || value.format !== BACKUP_FORMAT || !isInstant(value.created_at))
    return failure('BACKUP_FORMAT', 'Это не поддерживаемая резервная копия «Отдела снабжения». Выберите JSON, скачанный из этого сайта');
  if (!object(value.state) || Object.keys(value.state).some(key => !stateKeys.includes(key)))
    return failure('BACKUP_DATA', 'В копии есть неподдерживаемые поля. Текущие данные не изменены');
  const checked = validateDemoState(value.state);
  if (!checked.ok) return failure('BACKUP_DATA', 'Копия повреждена, имеет другую версию или содержит противоречивые данные. Текущие данные не изменены');
  return success({ format: BACKUP_FORMAT, created_at: value.created_at, state: checked.value });
}
export function parseBackup(text: string): Result<DemoBackup> {
  if (bytes(text) > MAX_BACKUP_BYTES) return failure('BACKUP_SIZE', 'Файл больше 2 МБ. Выберите меньшую резервную копию');
  try { return validateBackup(JSON.parse(text)); }
  catch { return failure('BACKUP_JSON', 'Файл не читается как JSON. Выберите другую копию; текущие данные не изменены'); }
}
export function createBackup(state: DemoState, now = new Date().toISOString()): Result<DemoBackup> {
  const checked = validateBackup({ format: BACKUP_FORMAT, created_at: now, state });
  if (!checked.ok) return checked;
  const text = JSON.stringify(checked.value);
  if (bytes(text) > MAX_BACKUP_BYTES) return failure('BACKUP_SIZE', 'Демонстрационный набор больше 2 МБ; копию создать не удалось');
  return success(JSON.parse(text) as DemoBackup);
}
export function readBackups(storage: StoragePort): Result<DemoBackup[]> {
  try {
    const raw = storage.getItem(BACKUP_KEY);
    if (raw === null) return success([]);
    if (bytes(raw) > MAX_BACKUP_BYTES) throw new Error('SIZE');
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > MAX_BACKUPS) throw new Error('FORMAT');
    const items: DemoBackup[] = [];
    for (const item of value) {
      const checked = validateBackup(item); if (!checked.ok) throw new Error('ITEM');
      items.push(checked.value);
    }
    return success(items);
  } catch {
    return failure('BACKUP_HISTORY', 'История автокопий не читается. Скачайте текущий набор в JSON и начните новую историю копий');
  }
}
function backupError(message: string): Error { const error = new Error(message); error.name = 'DemoBackupError'; return error; }

/** Applied only to the real browser adapter, not to domain command/test adapters. */
export function withAutomaticBackups(base: StoragePort): StoragePort {
  return {
    getItem: key => base.getItem(key),
    setItem: (key, value) => {
      if (key !== STORAGE_KEY) { base.setItem(key, value); return; }
      const previous = base.getItem(STORAGE_KEY);
      let current: DemoState | null = null;
      if (previous !== null) {
        try { const checked = validateDemoState(JSON.parse(previous)); if (checked.ok) current = checked.value; }
        catch { /* Confirmed recovery may replace unreadable primary data. */ }
      }
      if (current) {
        try {
          const history = readBackups(base); if (!history.ok) throw backupError(history.message);
          if (!history.value[0] || JSON.stringify(history.value[0].state) !== JSON.stringify(current)) {
            const copy = createBackup(current); if (!copy.ok) throw backupError(copy.message);
            const items = [copy.value, ...history.value].slice(0, MAX_BACKUPS);
            while (items.length > 1 && bytes(JSON.stringify(items)) > MAX_BACKUP_BYTES) items.pop();
            const text = JSON.stringify(items);
            if (bytes(text) > MAX_BACKUP_BYTES) throw backupError('Недостаточно места для автокопии. Скачайте текущий набор в JSON');
            base.setItem(BACKUP_KEY, text);
            log('INFO', 'BACKUP_CREATED');
          }
        } catch (error) {
          log('ERROR', 'BACKUP_WRITE_FAILED');
          if (error instanceof Error && error.name === 'DemoBackupError') throw error;
          throw backupError('Не удалось сохранить автокопию. Изменение отменено; прежние данные сохранены. Скачайте JSON и проверьте свободное место браузера');
        }
      }
      if (base.getItem(STORAGE_KEY) !== previous)
        throw backupError('Другая вкладка изменила демонстрацию. Обновите данные и повторите действие');
      base.setItem(key, value);
    },
  };
}
export function restoreBackup(storage: StoragePort, copy: DemoBackup, expectedRaw: string | null, now = new Date().toISOString()): Result<DemoState> {
  const checked = validateBackup(copy); if (!checked.ok) return checked;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== expectedRaw) return failure('REVISION_CONFLICT', 'После выбора копии данные изменились в другой вкладке. Повторно выберите копию и проверьте замену');
    let revision = 0;
    if (raw !== null) { try { const current = validateDemoState(JSON.parse(raw)); if (current.ok) revision = current.value.revision; } catch { /* Explicit recovery. */ } }
    const next = { ...checked.value.state, revision: Math.max(revision, checked.value.state.revision) + 1, saved_at: now };
    const result = validateDemoState(next); if (!result.ok) return result;
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    log('INFO', 'BACKUP_RESTORED'); return success(next);
  } catch {
    log('ERROR', 'BACKUP_RESTORE_FAILED');
    return failure('BACKUP_WRITE', 'Не удалось восстановить копию. Текущие данные не изменены; проверьте доступ к хранилищу и историю автокопий');
  }
}
export function restartBackupHistory(storage: StoragePort): Result<true> {
  try { storage.setItem(BACKUP_KEY, '[]'); log('WARNING', 'BACKUP_HISTORY_RESET'); return success(true); }
  catch { return failure('BACKUP_WRITE', 'Не удалось начать новую историю копий. Текущая демонстрация не изменена'); }
}
