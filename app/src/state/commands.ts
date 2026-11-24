import type { DemoState, Result } from '../domain/types.ts';
import { failure, success } from '../domain/types.ts';
import { loadDemoState, saveDemoState } from './storage.ts';
import type { StoragePort } from './storage.ts';
import { log } from '../shared/logger.ts';
export interface CommandOutcome { state: DemoState; entityId: string; changed: boolean }
export type DemoCommand = (state: DemoState) => Result<CommandOutcome>;
export function commitDemoCommand(storage: StoragePort, expected: DemoState, command: DemoCommand, event = 'COMMAND_SAVED'): Result<CommandOutcome> {
  const current = loadDemoState(storage, () => expected); if (!current.ok) return current;
  if (current.value.selected_user_id !== expected.selected_user_id) {
    log('WARNING', 'COMMAND_PARTICIPANT_CHANGED');
    return failure('REVISION_CONFLICT', 'В другой вкладке изменён участник. Обновите данные перед продолжением');
  }
  const outcome = command(current.value); if (!outcome.ok) { log('WARNING', 'COMMAND_REJECTED'); return outcome; }
  if (!outcome.value.changed) { log('WARNING', 'COMMAND_ALREADY_APPLIED'); return success({ ...outcome.value, state: current.value }); }
  if (current.value.revision !== expected.revision) {
    log('WARNING', 'COMMAND_REVISION_CONFLICT');
    return failure('REVISION_CONFLICT', 'Данные уже изменились. Обновите данные и проверьте действие перед повтором');
  }
  const saved = saveDemoState(storage, outcome.value.state, current.value.revision);
  if (!saved.ok) { log('ERROR', 'COMMAND_SAVE_FAILED'); return saved; }
  log('INFO', event); return success({ ...outcome.value, state: saved.value });
}
