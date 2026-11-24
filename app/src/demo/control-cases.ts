import type { StoragePort } from '../state/storage.ts';
import { postIssue } from '../domain/issue.ts';
import { postFullReturn } from '../domain/returns.ts';
import { createSeedState } from './seed.ts';
import {addManagementExample} from './management-example.ts';
export const CONTROL_CASES = [
  { id: 'wrong-item', label: 'Подменённая деталь выдачи' },
  { id: 'wrong-vehicle', label: 'Подменённая машина выдачи' },
  { id: 'wrong-quantity', label: 'Неверное количество выдачи' },
  { id: 'missing-request', label: 'Исходная заявка недоступна' },
  { id: 'lost-response', label: 'Ответ потерян после сохранения' },
  { id: 'income-error', label: 'Ошибка чтения доходов' },
  { id: 'missing-composition', label: 'Не определён состав результата' },
  { id: 'unknown-article', label: 'Неизвестная статья' },
  { id: 'invalid-money', label: 'Некорректная сумма' },
  { id: 'article-error', label: 'Ошибка чтения статьи' },
  { id: 'missing-source', label: 'Отсутствующий источник' },
  { id: 'trace-mismatch', label: 'Расхождение итога и строк' },
  { id: 'print-error', label: 'Ошибка подготовки печати' },
  { id: 'queue-error', label: 'Ошибка чтения очереди' },
  { id: 'confirmation-error', label: 'Противоречие подтверждений' },
  { id: 'no-clerk', label: 'Нет ответственного кладовщика' },
  { id: 'search-error', label: 'Ошибка поиска' },
  { id: 'empty-catalog', label: 'Пустая номенклатура' },
  { id: 'missing-unit', label: 'Отсутствующая единица' },
  { id: 'normal', label: 'Обычная демонстрация' },
  { id: 'corrupt', label: 'Повреждённое сохранение' },
  { id: 'incompatible', label: 'Другая версия сохранения' },
  { id: 'load-error', label: 'Недоступное хранилище' },
  { id: 'save-error', label: 'Отказ записи' },
  { id: 'slow-load', label: 'Загрузка дольше 10 секунд' },
  { id: 'calculation-error', label: 'Ошибка вычисления результата' },
] as const;
export type ControlCase = typeof CONTROL_CASES[number]['id'];
export function readControlCase(search: string): ControlCase {
  const value = new URLSearchParams(search).get('case');
  return CONTROL_CASES.find(item => item.id === value)?.id ?? 'normal';
}
export function controlStorage(base: StoragePort, mode: ControlCase): StoragePort {
  return {
    getItem: key => {
      if (mode === 'load-error') throw new Error('CONTROL_READ_FAILURE');
      if (mode === 'corrupt') return '{broken';
      if (mode === 'incompatible') { const raw = base.getItem(key); return JSON.stringify({ ...(raw ? JSON.parse(raw) : createSeedState()), schema_version: 999 }); }
      return base.getItem(key);
    },
    setItem: (key, value) => { if (mode === 'save-error' || mode === 'load-error') throw new Error('CONTROL_WRITE_FAILURE'); base.setItem(key, value); },
  };
}
export const DATASETS = [
  { id: 'management-dashboard', label: 'Дашборд: перевозки, автокран и экскаватор' },
  { id: 'baseline-november-2026', label: 'Основной набор: ноябрь 2026' },
  { id: 'issued-price-changed', label: 'Выдано по500, текущая цена700' },
  { id: 'returned-december', label: 'Выдача в ноябре, возврат в декабре' },
  { id: 'shortage', label: 'Недостаток: 1 шт. вместо 2' },
  { id: 'unknown-income', label: 'Нет данных о доходах машины А' },
  { id: 'partial-expenses', label: 'Часть расходов машины А неизвестна' },
  { id: 'unknown-price', label: 'Неизвестная цена запчасти' },
  { id: 'zero-values', label: 'Известные нулевые суммы машины А' },
  { id: 'twenty-lines', label: 'Двадцать операций по топливу' },
] as const;
export type DatasetId = typeof DATASETS[number]['id'];
export function createControlDataset(id: DatasetId) {
  let state = createSeedState(); state.dataset_id = id;
  if(id==='management-dashboard')return addManagementExample(state);
  if(id==='issued-price-changed'||id==='returned-december'){state.selected_user_id='K1';const issued=postIssue(state,{requestId:'request-control',actorId:'K1',recipientId:'D1',attemptId:'prepared-example',occurredAt:'2026-11-19T12:00:00+12:00',itemId:'P-001',vehicleId:'A',vin:state.data.vehicles[0].vin,quantity:'2',unitId:'pcs'});if(!issued.ok)throw Error('DATASET_INVALID');state=issued.value.state;if(id==='issued-price-changed')state.data.items[0].reference_unit_price_minor=70000;else{const returned=postFullReturn(state,{issueId:issued.value.entityId,actorId:'K1',attemptId:'december',occurredAt:'2026-12-01T00:01:00+12:00'});if(!returned.ok)throw Error('DATASET_INVALID');state=returned.value.state;}state.selected_user_id=null;}
  if (id === 'shortage') state.data.stock_positions[0].initial_quantity = '1';
  if (id === 'unknown-income') for (const row of state.data.financial_operations) if (row.vehicle_id === 'A' && row.article_id === 'income') row.amount_minor = null;
  if (id === 'partial-expenses') state.data.financial_operations.find(row => row.vehicle_id === 'A' && row.article_id === 'fuel')!.amount_minor = null;
  if (id === 'unknown-price') state.data.items[0].reference_unit_price_minor = null;
  if (id === 'zero-values') for (const row of state.data.financial_operations) if (row.vehicle_id === 'A') row.amount_minor = 0;
  if (id === 'twenty-lines') {
    const original = state.data.financial_operations.find(row => row.vehicle_id === 'A' && row.article_id === 'fuel')!;
    state.data.financial_operations = state.data.financial_operations.filter(row => !(row.vehicle_id === 'A' && row.article_id === 'fuel'));
    for (let i = 1; i <= 20; i++) state.data.financial_operations.push({ ...original, id: `fuel-line-${i}`, description: `Контрольная операция топлива ${i}`, amount_minor: 3500 });
  }
  return state;
}
