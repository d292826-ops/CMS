import { ROLES, failure, success } from './types.ts';
import type { DemoState, Result } from './types.ts';
import { isDateOnly, isInstant, getAccountingDate } from './dates.ts';
import { isMoney, multiplyMoneyHalfUp } from './money.ts';
import { parseQuantity, toThousandths } from './quantity.ts';

type RecordValue = Record<string, unknown>;
type Kind = 'text' | 'nullableText' | 'bool' | 'integer' | 'quantity' | 'nullableQuantity' | 'money' | 'signedMoney' | 'instant' | 'nullableInstant' | 'date' | readonly string[];
const record = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
function valid(value: unknown, kind: Kind): boolean {
  if (Array.isArray(kind)) return kind.includes(value as string);
  switch (kind) {
    case 'text': return text(value);
    case 'nullableText': return value === null || typeof value === 'string';
    case 'bool': return typeof value === 'boolean';
    case 'integer': return Number.isSafeInteger(value) && Number(value) >= 0;
    case 'quantity': return typeof value === 'string' && parseQuantity(value).ok;
    case 'nullableQuantity': return value === null || valid(value, 'quantity');
    case 'money': return isMoney(value);
    case 'signedMoney': return isMoney(value, true);
    case 'instant': return isInstant(value);
    case 'nullableInstant': return value === null || isInstant(value);
    case 'date': return isDateOnly(value);
    default: return false;
  }
}
const schemas: Record<string, Record<string, Kind>> = {
  users: { id: 'text', display_name: 'text', role: ROLES, warehouse_id: 'nullableText', is_default_clerk: 'bool', is_active: 'bool', created_at: 'instant' },
  vehicles: { id: 'text', display_name: 'text', registration_number: 'nullableText', vin: 'nullableText', is_active: 'bool' },
  units: { id: 'text', code: 'text', name: 'text', quantity_scale: 'integer' },
  items: { id: 'text', article: 'text', name: 'text', unit_id: 'text', reference_unit_price_minor: 'money', is_active: 'bool' },
  warehouses: { id: 'text', name: 'text', is_active: 'bool' },
  stock_positions: { id: 'text', warehouse_id: 'text', item_id: 'text', initial_quantity: 'nullableQuantity' },
  requests: { id: 'text', number: 'text', created_at: 'instant', author_user_id: 'text', warehouse_id: 'text', assigned_clerk_id: 'text', vehicle_id: 'text', item_id: 'text', quantity: 'quantity', comment: 'nullableText', cancelled_at: 'nullableInstant' },
  documents: { id: 'text', kind: ['ISSUE', 'RETURN', 'SOURCE'], number: 'nullableText', document_date: 'date', created_at: 'instant', created_by_user_id: 'nullableText', posting_state: ['PREPARED', 'POSTED'], posted_at: 'nullableInstant', request_id: 'nullableText', return_of_document_id: 'nullableText', warehouse_id: 'nullableText', vehicle_id: 'text', vehicle_vin_snapshot: 'nullableText', item_id: 'nullableText', unit_id: 'nullableText', quantity: 'nullableQuantity', recipient_user_id: 'nullableText', unit_price_minor: 'money', amount_minor: 'money', discrepancy_comment: 'nullableText', discrepancy_author_id: 'nullableText', discrepancy_at: 'nullableInstant' },
  confirmations: { id: 'text', document_id: 'text', side: ['WAREHOUSE', 'RECIPIENT'], actor_user_id: 'text', confirmed_at: 'instant' },
  stock_movements: { id: 'text', stock_position_id: 'text', document_id: 'text', quantity_delta: 'quantity', occurred_at: 'instant' },
  financial_articles: { id: 'text', name: 'text', direction: ['INCOME', 'EXPENSE'], included_in_result: 'bool', description: 'nullableText' },
  financial_operations: { id: 'text', document_id: 'text', vehicle_id: 'text', article_id: 'text', accounting_date: 'date', amount_minor: 'signedMoney', description: 'nullableText', item_id: 'nullableText', quantity: 'nullableQuantity', unit_id: 'nullableText', unit_price_minor: 'money' },
  financial_coverage: { id: 'text', vehicle_id: 'text', period_start: 'date', article_id: 'text', base_status: ['NOT_PREPARED', 'PARTIAL', 'COMPLETE'], note: 'nullableText' },
};
function unique<T>(rows: T[], key: (row: T) => string): boolean { return new Set(rows.map(key)).size === rows.length; }
function check(condition: unknown): asserts condition { if (!condition) throw new Error('INVALID_RELATION'); }
export function validateDemoState(input: unknown): Result<DemoState> {
  try {
    const root: Record<string, Kind> = { id: 'text', dataset_id: 'text', schema_version: 'integer', revision: 'integer', saved_at: 'instant', selected_user_id: 'nullableText', default_warehouse_id: 'text', currency: ['RUB'], accounting_timezone: ['Asia/Kamchatka'] };
    check(record(input)); check(Object.keys(input).every(key => key in root || key === 'data'));
    check(Object.entries(root).every(([key, kind]) => key in input && valid(input[key], kind)));
    if (input.schema_version !== 1) return failure('SCHEMA_VERSION', 'Версия сохранённой демонстрации не поддерживается. Можно восстановить исходный набор');
    check(record(input.data)); const raw = input.data;
    check(Object.keys(raw).length === Object.keys(schemas).length);
    for (const [name, shape] of Object.entries(schemas)) {
      check(Array.isArray(raw[name]));
      const rows = raw[name] as unknown[];
      for (const row of rows) check(record(row) && Object.keys(row).length === Object.keys(shape).length && Object.entries(shape).every(([key, kind]) => key in row && valid(row[key], kind)));
      check(unique(rows as RecordValue[], row => String(row.id)));
    }
    const state = input as unknown as DemoState; const d = state.data;
    const users = new Map(d.users.map(x => [x.id, x])); const vehicles = new Map(d.vehicles.map(x => [x.id, x]));
    const items = new Map(d.items.map(x => [x.id, x])); const units = new Map(d.units.map(x => [x.id, x]));
    const warehouses = new Map(d.warehouses.map(x => [x.id, x])); const stocks = new Map(d.stock_positions.map(x => [x.id, x]));
    const requests = new Map(d.requests.map(x => [x.id, x])); const docs = new Map(d.documents.map(x => [x.id, x]));
    const articles = new Map(d.financial_articles.map(x => [x.id, x]));
    const requester = (id: string | null) => id !== null && ['MECHANIC', 'DRIVER'].includes(users.get(id)?.role ?? '');
    const quantity = (value: string, unitId: string, positive = true) => { const unit = units.get(unitId); return unit && parseQuantity(value, unit.quantity_scale, positive).ok && (!positive || toThousandths(value) > 0n); };
    check(warehouses.has(state.default_warehouse_id));
    check(state.selected_user_id === null || users.get(state.selected_user_id)?.is_active);
    check(unique(d.vehicles.filter(v => v.vin !== null), v => v.vin!.trim().toUpperCase()));
    check(d.vehicles.every(v => v.vin === null || text(v.vin)));
    check(unique(d.units, u => u.code)); check(d.units.every(u => u.quantity_scale <= 3));
    for (const user of d.users) {
      check(user.role === 'WAREHOUSE' ? user.warehouse_id !== null && warehouses.has(user.warehouse_id) : user.warehouse_id === null && !user.is_default_clerk);
    }
    check(unique(d.users.filter(u => u.is_active && u.is_default_clerk), u => u.warehouse_id!));
    check(d.items.every(item => units.has(item.unit_id)));
    check(unique(d.stock_positions, p => `${p.warehouse_id}\0${p.item_id}`));
    for (const stock of d.stock_positions) {
      const item = items.get(stock.item_id); check(item && warehouses.has(stock.warehouse_id));
      check(stock.initial_quantity === null || quantity(stock.initial_quantity, item.unit_id, false) && toThousandths(stock.initial_quantity) >= 0n);
    }
    check(unique(d.requests, r => r.number));
    for (const request of d.requests) {
      const item = items.get(request.item_id); const clerk = users.get(request.assigned_clerk_id);
      check(item && requester(request.author_user_id) && vehicles.has(request.vehicle_id) && warehouses.has(request.warehouse_id));
      check(clerk?.role === 'WAREHOUSE' && clerk.warehouse_id === request.warehouse_id && quantity(request.quantity, item.unit_id));
    }
    check(unique(d.documents.filter(x => x.kind !== 'SOURCE'), x => `${x.kind}\0${x.number}`));
    check(unique(d.documents.filter(x => x.kind === 'ISSUE'), x => x.request_id!));
    check(unique(d.documents.filter(x => x.kind === 'RETURN'), x => x.return_of_document_id!));
    for (const doc of d.documents) {
      check(vehicles.has(doc.vehicle_id));
      check(doc.warehouse_id === null || warehouses.has(doc.warehouse_id));
      check(doc.item_id === null || items.has(doc.item_id)); check(doc.unit_id === null || units.has(doc.unit_id));
      check(doc.created_by_user_id === null || users.has(doc.created_by_user_id));
      if (doc.discrepancy_comment !== null) check(text(doc.discrepancy_comment) && doc.discrepancy_author_id === doc.recipient_user_id && requester(doc.discrepancy_author_id) && doc.discrepancy_at !== null);
      else check(doc.discrepancy_author_id === null && doc.discrepancy_at === null);
      if (doc.kind === 'SOURCE') { check(doc.posting_state === 'POSTED' && doc.request_id === null && doc.return_of_document_id === null && doc.recipient_user_id === null); continue; }
      const item = doc.item_id ? items.get(doc.item_id) : undefined; const creator = doc.created_by_user_id ? users.get(doc.created_by_user_id) : undefined;
      check(text(doc.number) && item && creator?.role === 'WAREHOUSE' && creator.warehouse_id === doc.warehouse_id && doc.unit_id === item.unit_id);
      check(doc.quantity !== null && quantity(doc.quantity, item.unit_id) && requester(doc.recipient_user_id));
      if (doc.posting_state === 'POSTED') check(doc.posted_at !== null && text(doc.vehicle_vin_snapshot) && getAccountingDate(doc.posted_at) === doc.document_date);
      else check(doc.posted_at === null);
      if (doc.kind === 'ISSUE') {
        const request = doc.request_id ? requests.get(doc.request_id) : undefined;
        check(request && doc.return_of_document_id === null && doc.vehicle_id === request.vehicle_id && doc.item_id === request.item_id && doc.warehouse_id === request.warehouse_id && toThousandths(doc.quantity) === toThousandths(request.quantity));
        if (doc.posting_state === 'POSTED') {
          check(request.cancelled_at === null && doc.vehicle_vin_snapshot === vehicles.get(doc.vehicle_id)!.vin);
          const amount = multiplyMoneyHalfUp(doc.unit_price_minor, doc.quantity); check(amount.ok && amount.value === doc.amount_minor);
        }
      } else {
        const original = doc.return_of_document_id ? docs.get(doc.return_of_document_id) : undefined;
        check(original?.kind === 'ISSUE' && original.posting_state === 'POSTED' && doc.request_id === null);
        for (const field of ['warehouse_id', 'vehicle_id', 'vehicle_vin_snapshot', 'item_id', 'unit_id', 'quantity', 'recipient_user_id', 'unit_price_minor', 'amount_minor'] as const) check(doc[field] === original[field]);
        if (doc.posting_state === 'POSTED') check(Date.parse(doc.posted_at!) >= Date.parse(original.posted_at!));
      }
    }
    check(unique(d.confirmations, c => `${c.document_id}\0${c.side}`));
    for (const confirmation of d.confirmations) {
      const doc = docs.get(confirmation.document_id); const actor = users.get(confirmation.actor_user_id);
      check(doc?.kind === 'ISSUE' && doc.posting_state === 'POSTED' && actor);
      if (confirmation.side === 'WAREHOUSE') check(actor.role === 'WAREHOUSE' && actor.warehouse_id === doc.warehouse_id && confirmation.confirmed_at === doc.posted_at);
      else {
        check(actor.id === doc.recipient_user_id && requester(actor.id) && Date.parse(confirmation.confirmed_at) >= Date.parse(doc.posted_at!));
        const returned = d.documents.find(x => x.kind === 'RETURN' && x.return_of_document_id === doc.id && x.posting_state === 'POSTED');
        check(!returned || Date.parse(confirmation.confirmed_at) <= Date.parse(returned.posted_at!));
      }
    }
    check(unique(d.stock_movements, m => m.document_id));
    for (const movement of d.stock_movements) {
      const doc = docs.get(movement.document_id); const stock = stocks.get(movement.stock_position_id);
      check(doc && stock && doc.kind !== 'SOURCE' && doc.posting_state === 'POSTED' && stock.warehouse_id === doc.warehouse_id && stock.item_id === doc.item_id);
      check(toThousandths(movement.quantity_delta) === (doc.kind === 'ISSUE' ? -1n : 1n) * toThousandths(doc.quantity!) && movement.occurred_at === doc.posted_at);
    }
    check(unique(d.financial_operations.filter(f => docs.get(f.document_id)?.kind !== 'SOURCE'), f => f.document_id));
    for (const operation of d.financial_operations) {
      const doc = docs.get(operation.document_id); const article = articles.get(operation.article_id);
      check(doc && article && operation.vehicle_id === doc.vehicle_id && vehicles.has(operation.vehicle_id));
      check(operation.item_id === null || items.has(operation.item_id)); check(operation.unit_id === null || units.has(operation.unit_id));
      if (operation.quantity !== null) check(operation.unit_id !== null && quantity(operation.quantity, operation.unit_id, false));
      if (doc.kind === 'SOURCE') check(operation.amount_minor === null || operation.amount_minor >= 0);
      else {
        check(doc.posting_state === 'POSTED' && article.direction === 'EXPENSE' && operation.item_id === doc.item_id && operation.unit_id === doc.unit_id && operation.quantity === doc.quantity && operation.unit_price_minor === doc.unit_price_minor && operation.accounting_date === doc.document_date);
        check(operation.amount_minor === (doc.amount_minor === null ? null : doc.kind === 'RETURN' ? -doc.amount_minor : doc.amount_minor));
      }
    }
    for (const doc of d.documents) {
      const confirmations = d.confirmations.filter(c => c.document_id === doc.id); const movements = d.stock_movements.filter(m => m.document_id === doc.id); const ops = d.financial_operations.filter(f => f.document_id === doc.id);
      if (doc.kind === 'SOURCE' || doc.posting_state === 'PREPARED') check(confirmations.length === 0 && movements.length === 0 && (doc.kind === 'SOURCE' || ops.length === 0));
      else check(movements.length === 1 && ops.length === 1 && (doc.kind === 'ISSUE' ? confirmations.some(c => c.side === 'WAREHOUSE') : confirmations.length === 0));
    }
    for (const stock of d.stock_positions) if (stock.initial_quantity !== null) check(toThousandths(stock.initial_quantity) + d.stock_movements.filter(m => m.stock_position_id === stock.id).reduce((sum, m) => sum + toThousandths(m.quantity_delta), 0n) >= 0n);
    check(unique(d.financial_coverage, c => `${c.vehicle_id}\0${c.period_start}\0${c.article_id}`));
    check(d.financial_coverage.every(c => vehicles.has(c.vehicle_id) && articles.has(c.article_id) && c.period_start.endsWith('-01')));
    return success(state);
  } catch { return failure('DATA_INVALID', 'Сохранённые данные не читаются или противоречат друг другу. Повторите загрузку либо восстановите исходный набор'); }
}
