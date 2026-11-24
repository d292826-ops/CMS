export const ACCOUNTING_TIMEZONE = 'Asia/Kamchatka';
export function isInstant(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && isDateOnly(value.slice(0, 10)) && Number.isFinite(Date.parse(value)); }
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function getAccountingDate(instant: string): string {
  if (!isInstant(instant)) throw new Error('INVALID_INSTANT');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ACCOUNTING_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
