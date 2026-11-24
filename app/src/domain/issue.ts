import type { DemoState, Document, Result } from './types.ts';
import { failure, success } from './types.ts';
import type { CommandOutcome } from '../state/commands.ts';
import { getAccountingDate, isInstant } from './dates.ts';
import { currentStock } from './status.ts';
import { parseQuantity, toThousandths, fromThousandths } from './quantity.ts';
import { multiplyMoneyHalfUp } from './money.ts';
export interface IssueInput { requestId: string; actorId: string; recipientId: string; attemptId: string; occurredAt: string; itemId: string; vehicleId: string; vin: string | null; quantity: string; unitId: string }
export function nextDocumentNumber(state: DemoState, kind: 'ISSUE' | 'RETURN'): string {
  const max = state.data.documents.filter(d => d.kind === kind).reduce((value, d) => Math.max(value, Number(d.number?.match(/(\d+)$/)?.[1] ?? 0)), 0);
  return `${kind === 'ISSUE' ? 'В' : 'Воз'}-${String(max + 1).padStart(4, '0')}`;
}
export function validateIssue(state: DemoState, input: IssueInput, posting = true): Result<undefined> {
  const actor = state.data.users.find(u => u.id === input.actorId);
  const request = state.data.requests.find(r => r.id === input.requestId);
  if (!actor?.is_active || actor.role !== 'WAREHOUSE' || state.selected_user_id !== actor.id) return failure('ROLE_DENIED', 'Выдачу подтверждает кладовщик');
  if (!request) return failure('REQUEST_MISSING', 'Не найдена исходная заявка');
  if (actor.warehouse_id !== request.warehouse_id) return failure('WAREHOUSE_DENIED', 'Заявка относится к другому складу');
  if (request.cancelled_at !== null) return failure('REQUEST_CANCELLED', 'Заявка отменена. Выдача недоступна');
  const item = state.data.items.find(i => i.id === request.item_id); const vehicle = state.data.vehicles.find(v => v.id === request.vehicle_id);
  if (!item?.is_active || input.itemId !== item.id) return failure('WRONG_ITEM', 'Выбрана не та деталь', 'itemId');
  if (!vehicle?.is_active || input.vehicleId !== vehicle.id || input.vin !== vehicle.vin) return failure('WRONG_VEHICLE', 'Машина или VIN не соответствуют заявке', 'vehicleId');
  if (posting && !vehicle.vin) return failure('VIN_MISSING', 'Выберите корректную машину: VIN не указан', 'vehicleId');
  const unit = state.data.units.find(u => u.id === item.unit_id);
  if (!unit || input.unitId !== unit.id) return failure('UNIT_MISSING', 'Для детали не задана корректная единица измерения', 'quantity');
  const parsed = parseQuantity(input.quantity, unit.quantity_scale, true); if (!parsed.ok) return { ...parsed, field: 'quantity' };
  if (toThousandths(parsed.value) !== toThousandths(request.quantity)) return failure('WRONG_QUANTITY', 'Количество не совпадает с заявкой', 'quantity');
  if (!state.data.users.some(u => u.id === input.recipientId && u.is_active && ['MECHANIC', 'DRIVER'].includes(u.role))) return failure('RECIPIENT_MISSING', 'Выберите фактического получателя', 'recipientId');
  if (!isInstant(input.occurredAt)) return failure('DATE_INVALID', 'Не удалось определить дату операции');
  if (posting) {
    const stock = currentStock(state, request.warehouse_id, item.id);
    if (stock === null) return failure('STOCK_UNKNOWN', 'Проверьте наличие: данные недоступны');
    if (toThousandths(stock) < toThousandths(request.quantity)) return failure('STOCK_SHORTAGE', `На складе доступно ${stock}, требуется ${request.quantity}`);
  }
  return success(undefined);
}
export function prepareIssue(state: DemoState, input: IssueInput): Result<CommandOutcome> {
  const valid = validateIssue(state, input, false); if (!valid.ok) return valid;
  const existing = state.data.documents.find(d => d.kind === 'ISSUE' && d.request_id === input.requestId);
  if (existing) {
    if (existing.posting_state === 'POSTED' || existing.recipient_user_id === input.recipientId) return success({ state, entityId: existing.id, changed: false });
    const next = structuredClone(state);
    next.data.documents.find(doc => doc.id === existing.id)!.recipient_user_id = input.recipientId;
    return success({ state: next, entityId: existing.id, changed: true });
  }
  const request = state.data.requests.find(r => r.id === input.requestId)!;
  const item = state.data.items.find(i => i.id === request.item_id)!;
  const doc: Document = { id: `issue-${input.attemptId}`, kind: 'ISSUE', number: nextDocumentNumber(state, 'ISSUE'), document_date: getAccountingDate(input.occurredAt), created_at: input.occurredAt, created_by_user_id: input.actorId, posting_state: 'PREPARED', posted_at: null, request_id: request.id, return_of_document_id: null, warehouse_id: request.warehouse_id, vehicle_id: request.vehicle_id, vehicle_vin_snapshot: input.vin, item_id: item.id, unit_id: item.unit_id, quantity: request.quantity, recipient_user_id: input.recipientId, unit_price_minor: null, amount_minor: null, discrepancy_comment: null, discrepancy_author_id: null, discrepancy_at: null };
  const next = structuredClone(state); next.data.documents.push(doc);
  return success({ state: next, entityId: doc.id, changed: true });
}
export function postIssue(state: DemoState, input: IssueInput): Result<CommandOutcome> {
  const actor = state.data.users.find(u => u.id === input.actorId);
  if (actor?.role !== 'WAREHOUSE' || state.selected_user_id !== actor.id) return failure('ROLE_DENIED', 'Выдачу подтверждает кладовщик');
  const existing = state.data.documents.find(d => d.kind === 'ISSUE' && d.request_id === input.requestId);
  if (existing?.posting_state === 'POSTED') {
    if (existing.warehouse_id !== actor.warehouse_id) return failure('WAREHOUSE_DENIED', 'Документ относится к другому складу');
    return success({ state, entityId: existing.id, changed: false });
  }
  const valid = validateIssue(state, input); if (!valid.ok) return valid;
  const prepared = existing ? success({ state, entityId: existing.id, changed: false }) : prepareIssue(state, input); if (!prepared.ok) return prepared;
  const next = structuredClone(prepared.value.state); const doc = next.data.documents.find(d => d.id === prepared.value.entityId)!;
  const item = next.data.items.find(i => i.id === input.itemId)!;
  const amount = multiplyMoneyHalfUp(item.reference_unit_price_minor, doc.quantity!); if (!amount.ok) return amount;
  const stock = next.data.stock_positions.find(p => p.warehouse_id === doc.warehouse_id && p.item_id === doc.item_id)!;
  if (!next.data.financial_articles.some(a => a.id === 'parts' && a.direction === 'EXPENSE')) return failure('ARTICLE_MISSING', 'Состав складского расхода не определён');
  Object.assign(doc, { posting_state: 'POSTED', posted_at: input.occurredAt, document_date: getAccountingDate(input.occurredAt), recipient_user_id: input.recipientId, vehicle_vin_snapshot: input.vin, unit_price_minor: item.reference_unit_price_minor, amount_minor: amount.value });
  next.data.confirmations.push({ id: `warehouse-${doc.id}`, document_id: doc.id, side: 'WAREHOUSE', actor_user_id: input.actorId, confirmed_at: input.occurredAt });
  next.data.stock_movements.push({ id: `movement-${doc.id}`, document_id: doc.id, stock_position_id: stock.id, quantity_delta: fromThousandths(-toThousandths(doc.quantity!)), occurred_at: input.occurredAt });
  next.data.financial_operations.push({ id: `expense-${doc.id}`, document_id: doc.id, vehicle_id: doc.vehicle_id, article_id: 'parts', accounting_date: doc.document_date, amount_minor: amount.value, description: 'Фактическая выдача запчасти', item_id: doc.item_id, quantity: doc.quantity, unit_id: doc.unit_id, unit_price_minor: doc.unit_price_minor });
  return success({ state: next, entityId: doc.id, changed: true });
}
