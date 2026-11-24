import type { DemoState, Document, Request } from './types.ts';
import { fromThousandths, toThousandths } from './quantity.ts';
export function currentStock(state: DemoState, warehouseId: string, itemId: string): string | null {
  const position = state.data.stock_positions.find(p => p.warehouse_id === warehouseId && p.item_id === itemId);
  if (!position || position.initial_quantity === null) return null;
  return fromThousandths(toThousandths(position.initial_quantity) + state.data.stock_movements.filter(m => m.stock_position_id === position.id).reduce((sum, m) => sum + toThousandths(m.quantity_delta), 0n));
}
export function documentStatus(state: DemoState, doc: Document): string {
  if (doc.kind === 'RETURN') return 'Возврат'; if (doc.kind === 'SOURCE') return 'Подготовленный источник';
  if (state.data.documents.some(d => d.kind === 'RETURN' && d.return_of_document_id === doc.id && d.posting_state === 'POSTED')) return 'Возвращён';
  if (doc.posting_state === 'PREPARED') return 'Подготовлен';
  return state.data.confirmations.some(c => c.document_id === doc.id && c.side === 'RECIPIENT') ? 'Выдан и подписан' : 'Выдан — ожидает подтверждения получателя';
}
export function requestStatus(state: DemoState, request: Request): string {
  if (request.cancelled_at !== null) return 'Отменена';
  const doc = state.data.documents.find(d => d.kind === 'ISSUE' && d.request_id === request.id);
  if (!doc) return 'Новая'; const status = documentStatus(state, doc);
  return status === 'Возвращён' ? 'Возвращена' : doc.posting_state === 'PREPARED' ? 'Подготовлена' : 'Выдана';
}
export function availability(state: DemoState, request: Request): 'ENOUGH' | 'SHORTAGE' | 'UNKNOWN' {
  const stock = currentStock(state, request.warehouse_id, request.item_id);
  return stock === null ? 'UNKNOWN' : toThousandths(stock) < toThousandths(request.quantity) ? 'SHORTAGE' : 'ENOUGH';
}
