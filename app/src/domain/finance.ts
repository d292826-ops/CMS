import type { DemoState, FinancialArticle, FinancialOperation, Result, Vehicle } from './types.ts';
import { failure, success } from './types.ts';
import { sumMoney } from './money.ts';
export type CoverageStatus = 'COMPLETE' | 'PARTIAL' | 'NOT_PREPARED' | 'ERROR';
export interface ArticleSummary { article: FinancialArticle; rows: FinancialOperation[]; amount: number | null; knownPart: number | null; status: CoverageStatus; unknownCount: number }
export interface FinanceSummary { vehicle: Vehicle; period: string; articles: ArticleSummary[]; income: number | null; expenses: number | null; incomeKnown: number | null; expensesKnown: number | null; result: number | null; partialResult: number | null; status: CoverageStatus; unassigned: FinancialOperation[]; prepared: boolean }
export function validPeriod(period: string): boolean { return /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period); }
function add(values: number[]): number | null { const total = sumMoney(values); return total.ok ? total.value : null; }
export function selectVehiclePeriod(state: DemoState, vehicleId: string, period: string): Result<{ vehicle: Vehicle; rows: FinancialOperation[] }> {
  const vehicle = state.data.vehicles.find(v => v.id === vehicleId);
  if (!vehicle) return failure('VEHICLE_MISSING', 'Машина не найдена');
  if (!validPeriod(period)) return failure('PERIOD_INVALID', 'Проверьте период');
  return success({ vehicle, rows: state.data.financial_operations.filter(row => row.vehicle_id === vehicleId && row.accounting_date.slice(0, 7) === period) });
}
export function getFinancialCoverage(state: DemoState, vehicleId: string, period: string, article: FinancialArticle, rows: FinancialOperation[], conflict = false): ArticleSummary {
  const bases = state.data.financial_coverage.filter(c => c.vehicle_id === vehicleId && c.period_start === period + '-01' && c.article_id === article.id);
  const base = bases[0];
  const known = rows.flatMap(row => row.amount_minor === null ? [] : [row.amount_minor]);
  const invalid = known.some(value => !Number.isSafeInteger(value));
  const total = invalid ? null : add(known); const unknownCount = rows.filter(row => row.amount_minor === null).length;
  let status: CoverageStatus;
  if (conflict || bases.length > 1 || invalid || total === null) status = 'ERROR';
  else if (base?.base_status === 'COMPLETE' && unknownCount === 0) status = 'COMPLETE';
  else if (rows.length > 0 || base?.base_status === 'PARTIAL') status = 'PARTIAL';
  else status = 'NOT_PREPARED';
  return { article, rows, amount: status === 'COMPLETE' ? total : null, knownPart: known.length || status === 'COMPLETE' ? total : null, status, unknownCount };
}
export function calculateVehicleResult(state: DemoState, vehicleId: string, period: string): Result<FinanceSummary> {
  const selected = selectVehiclePeriod(state, vehicleId, period); if (!selected.ok) return selected;
  const unique = new Map<string, FinancialOperation>(); let conflict = false;
  for (const row of selected.value.rows) {
    const old = unique.get(row.id);
    if (old && (Object.keys(old) as (keyof FinancialOperation)[]).some(key => old[key] !== row[key])) conflict = true;
    else unique.set(row.id, row);
  }
  const rows = [...unique.values()];
  const articles = state.data.financial_articles.map(article => getFinancialCoverage(state, vehicleId, period, article, rows.filter(row => row.article_id === article.id), conflict));
  const unassigned = rows.filter(row => !state.data.financial_articles.some(a => a.id === row.article_id));
  const included = articles.filter(row => row.article.included_in_result);
  const totals = (direction: 'INCOME' | 'EXPENSE', partial: boolean) => {
    const list = included.filter(row => row.article.direction === direction);
    if (!list.length) return null;
    if (!partial && list.some(row => row.status !== 'COMPLETE')) return null;
    const known = list.flatMap(row => (partial ? row.knownPart : row.amount) === null ? [] : [partial ? row.knownPart! : row.amount!]);
    return known.length ? add(known) : null;
  };
  const income = totals('INCOME', false); const expenses = totals('EXPENSE', false);
  const incomeKnown = totals('INCOME', true); const expensesKnown = totals('EXPENSE', true);
  const prepared = state.data.financial_coverage.some(c => c.vehicle_id === vehicleId && c.period_start === period + '-01');
  const error = !included.length || conflict || unassigned.length > 0 || included.some(a => a.status === 'ERROR');
  const status: CoverageStatus = error ? 'ERROR' : included.length > 0 && included.every(a => a.status === 'COMPLETE') ? 'COMPLETE' : rows.length > 0 || prepared ? 'PARTIAL' : 'NOT_PREPARED';
  const result = status === 'COMPLETE' && income !== null && expenses !== null ? add([income, -expenses]) : null;
  const partialResult = !error && incomeKnown !== null && expensesKnown !== null ? add([incomeKnown, -expensesKnown]) : null;
  return success({ vehicle: selected.value.vehicle, period, articles, income, expenses, incomeKnown, expensesKnown, result, partialResult, status: status === 'COMPLETE' && result === null ? 'ERROR' : status, unassigned, prepared });
}
export function groupExpensesByArticle(summary: FinanceSummary): ArticleSummary[] { return summary.articles.filter(row => row.article.direction === 'EXPENSE'); }
export function getArticleOperations(state: DemoState, vehicleId: string, period: string, articleId: string): FinancialOperation[] { const selected = selectVehiclePeriod(state, vehicleId, period); return selected.ok ? selected.value.rows.filter(row => row.article_id === articleId) : []; }
