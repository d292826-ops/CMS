export type Role = 'admin' | 'operator' | 'finance';
export type Group = 'part' | 'material' | 'fuel' | 'gas';
export type Article = 'materials' | 'fuel' | 'gas';
export const groupNames: Record<string, string> = { part: 'Запчасти', material: 'Материалы', fuel: 'Жидкое топливо', gas: 'Газ' };
export const articleNames: Record<string, string> = { materials: 'Запчасти и материалы', fuel: 'Жидкое топливо', gas: 'Газ' };
export const roleNames: Record<Role, string> = { admin: 'Администратор', operator: 'Оператор выдачи', finance: 'Руководитель / финансист' };
export const objectTypes: Record<string, string> = { vehicle: 'Автомобиль', department: 'Подразделение', building: 'Здание' };
export function article(g: string): Article { return g === 'part' || g === 'material' ? 'materials' : g as Article; }
export function scaled(v: unknown, places: number): number { const s = String(v ?? '').trim().replace(',', '.'); if (!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(s))
    throw new Error(`Введите неотрицательное число, до ${places} знаков после запятой`); const [a, b = ''] = s.split('.'); const n = Number(a) * 10 ** places + Number(b.padEnd(places, '0')); if (!Number.isSafeInteger(n) || n > 1e11)
    throw new Error('Слишком большое значение'); return n; }
export function lineAmount(q: number, p: number): number { const n = (BigInt(q) * BigInt(p) + 500n) / 1000n; if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Сумма слишком велика'); return Number(n); }
export function returnAmount(original: {
    qty: number;
    price: number;
    amount: number;
}, returnedQty: number, returnedAmount: number, qty: number) { if (qty <= 0 || returnedQty + qty > original.qty)
    throw new Error('Нельзя вернуть больше выданного'); return returnedQty + qty === original.qty ? original.amount - returnedAmount : Math.max(0, Math.min(original.amount - returnedAmount, lineAmount(returnedQty + qty, original.price) - returnedAmount)); }
export function money(cents: number, digits = 0) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100); }
export function qtyFormat(n: number) { return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(n / 1000); }
export function localNow(zone = 'Asia/Kamchatka', date = new Date()) { const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date); return parts.replace(' ', 'T'); }
export function validateDate(s: string) { if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) || !Number.isFinite(Date.parse(s + 'Z')) || new Date(s + 'Z').toISOString().slice(0, 16) !== s.slice(0, 16))
    throw new Error('Укажите корректные дату и время операции'); return s.length === 16 ? s + ':00' : s; }
export function periodRange(kind: string, anchor: string) { const d = new Date(anchor.slice(0, 10) + 'T12:00:00Z'); const iso = (x: Date) => x.toISOString().slice(0, 10); const y = d.getUTCFullYear(), m = d.getUTCMonth(); if (kind === 'day')
    return [iso(d), iso(d)]; if (kind === 'week') {
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    const e = new Date(d);
    e.setUTCDate(d.getUTCDate() + 6);
    return [iso(d), iso(e)];
} if (kind === 'year')
    return [`${y}-01-01`, `${y}-12-31`]; return [iso(new Date(Date.UTC(y, m, 1, 12))), iso(new Date(Date.UTC(y, m + 1, 0, 12)))]; }
export function monthsBetween(from: string, to: string) { const a = from.slice(0, 7), b = to.slice(0, 7); if ((Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5)) - Number(a.slice(5)) >= 120)
    throw new Error('Выберите период не более 10 лет'); const out = []; let d = new Date(a + '-01T12:00:00Z'); while (d.toISOString().slice(0, 7) <= b && out.length < 120) {
    out.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
} return out; }
export function budgetState(plan: number | null, fact: number, complete = true) { if (!complete || plan === null)
    return { label: 'Бюджет задан частично', className: 'neutral', percent: null, remaining: null }; return { label: fact > plan ? 'Превышен' : plan > 0 && fact / plan >= .8 ? 'Близко к лимиту' : 'В пределах', className: fact > plan ? 'bad' : plan > 0 && fact / plan >= .8 ? 'warn' : '', percent: plan > 0 ? fact / plan * 100 : null, remaining: plan - fact }; }
