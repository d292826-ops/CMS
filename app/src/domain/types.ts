export const ROLES = ['MECHANIC', 'DRIVER', 'WAREHOUSE', 'FINANCE_DIRECTOR', 'OWNER'] as const;
export type Role = typeof ROLES[number];
export type Id = string;
export type Quantity = string;
export type Money = number | null;
export type DateOnly = string;
export type Instant = string;
export interface User { id: Id; display_name: string; role: Role; warehouse_id: Id | null; is_default_clerk: boolean; is_active: boolean; created_at: Instant }
export interface Vehicle { id: Id; display_name: string; registration_number: string | null; vin: string | null; is_active: boolean }
export interface Unit { id: Id; code: string; name: string; quantity_scale: number }
export interface Item { id: Id; article: string; name: string; unit_id: Id; reference_unit_price_minor: Money; is_active: boolean }
export interface Warehouse { id: Id; name: string; is_active: boolean }
export interface StockPosition { id: Id; warehouse_id: Id; item_id: Id; initial_quantity: Quantity | null }
export interface Request {
  id: Id; number: string; created_at: Instant; author_user_id: Id; warehouse_id: Id; assigned_clerk_id: Id;
  vehicle_id: Id; item_id: Id; quantity: Quantity; comment: string | null; cancelled_at: Instant | null;
}
export type DocumentKind = 'ISSUE' | 'RETURN' | 'SOURCE';
export interface Document {
  id: Id; kind: DocumentKind; number: string | null; document_date: DateOnly; created_at: Instant;
  created_by_user_id: Id | null; posting_state: 'PREPARED' | 'POSTED'; posted_at: Instant | null;
  request_id: Id | null; return_of_document_id: Id | null; warehouse_id: Id | null; vehicle_id: Id;
  vehicle_vin_snapshot: string | null; item_id: Id | null; unit_id: Id | null; quantity: Quantity | null;
  recipient_user_id: Id | null; unit_price_minor: Money; amount_minor: Money; discrepancy_comment: string | null;
  discrepancy_author_id: Id | null; discrepancy_at: Instant | null;
}
export interface Confirmation { id: Id; document_id: Id; side: 'WAREHOUSE' | 'RECIPIENT'; actor_user_id: Id; confirmed_at: Instant }
export interface StockMovement { id: Id; stock_position_id: Id; document_id: Id; quantity_delta: Quantity; occurred_at: Instant }
export interface FinancialArticle { id: Id; name: string; direction: 'INCOME' | 'EXPENSE'; included_in_result: boolean; description: string | null }
export interface FinancialOperation {
  id: Id; document_id: Id; vehicle_id: Id; article_id: Id; accounting_date: DateOnly; amount_minor: Money;
  description: string | null; item_id: Id | null; quantity: Quantity | null; unit_id: Id | null; unit_price_minor: Money;
}
export interface FinancialCoverage { id: Id; vehicle_id: Id; period_start: DateOnly; article_id: Id; base_status: 'NOT_PREPARED' | 'PARTIAL' | 'COMPLETE'; note: string | null }
export interface DemoData {
  users: User[]; vehicles: Vehicle[]; units: Unit[]; items: Item[]; warehouses: Warehouse[]; stock_positions: StockPosition[];
  requests: Request[]; documents: Document[]; confirmations: Confirmation[]; stock_movements: StockMovement[];
  financial_articles: FinancialArticle[]; financial_operations: FinancialOperation[]; financial_coverage: FinancialCoverage[];
}
export interface DemoState {
  id: string; dataset_id: string; schema_version: number; revision: number; saved_at: Instant; selected_user_id: Id | null;
  default_warehouse_id: Id; currency: 'RUB'; accounting_timezone: 'Asia/Kamchatka'; data: DemoData;
}
export type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string; field?: string };
export function failure(code: string, message: string, field?: string): Result<never> { return { ok: false, code, message, ...(field ? { field } : {}) }; }
export function success<T>(value: T): Result<T> { return { ok: true, value }; }
