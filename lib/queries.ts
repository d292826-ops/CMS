import { all, one } from '@/db';
import { Context, HttpError } from './server';
import { article, monthsBetween, periodRange, localNow } from './domain';
export function filter(c: Context, posted = true) { const p = c.url.searchParams, where = ['d.workspace=?'], args: any[] = [c.workspace]; if (posted)
    where.push("d.status='posted'");
else if (p.get('status') && p.get('status') !== 'all') {
    where.push('d.status=?');
    args.push(p.get('status'));
} const from = p.get('from') || localNow(c.settings.timezone).slice(0, 7) + '-01', to = p.get('to') || localNow(c.settings.timezone).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || new Date(from + 'T12:00:00Z').toISOString().slice(0, 10) !== from || new Date(to + 'T12:00:00Z').toISOString().slice(0, 10) !== to)
    throw new HttpError(400, 'Некорректный период'); where.push('d.operation_at>=? AND d.operation_at<=?'); args.push(from + 'T00:00:00', to + 'T23:59:59'); for (const [key, col] of [['object', 'd.object_id'], ['recipient', 'd.recipient_id'], ['resource', 'l.resource_id'], ['type', 'o.type']])
    if (p.get(key) && p.get(key) !== 'all') {
        where.push(col + '=?');
        args.push(p.get(key));
    } if (p.get('group') && p.get('group') !== 'all') {
    if (p.get('group') === 'materials')
        where.push("l.\"group\" IN ('part','material')");
    else {
        where.push('l."group"=?');
        args.push(p.get('group'));
    }
} if (p.get('fuelOnly') === 'true')
    where.push("l.\"group\" IN ('fuel','gas')"); if (p.get('q')) {
    where.push('(d.number LIKE ? OR d.recipient_name LIKE ? OR d.object_name LIKE ? OR l.name LIKE ? OR d.author_name LIKE ?)');
    for (let i = 0; i < 5; i++)
        args.push('%' + p.get('q') + '%');
} return { where: where.join(' AND '), args, from, to }; }
export const joins = 'FROM documents d JOIN lines l ON l.document_id=d.id JOIN objects o ON o.id=d.object_id';
export const signed = "CASE WHEN d.kind='return' THEN -l.amount ELSE l.amount END";
export async function dashboard(c: Context) {
    const f = filter(c), base = `${joins} WHERE ${f.where}`, monthly = c.url.searchParams.get('period') === 'year';
    const [totals, byGroup, byObject, byPerson, trend, fuel] = await Promise.all([
        one(`SELECT COALESCE(SUM(${signed}),0) total,COUNT(DISTINCT CASE WHEN d.kind='issue' THEN d.id END) issues,COUNT(DISTINCT CASE WHEN d.kind='return' THEN d.id END) returns ${base}`, ...f.args),
        all(`SELECT l."group" group_name,SUM(${signed}) total ${base} GROUP BY l."group"`, ...f.args),
        all(`SELECT o.id,o.name,o.type,o.plate,SUM(${signed}) total,SUM(CASE WHEN l."group" IN ('part','material') THEN ${signed} ELSE 0 END) materials,SUM(CASE WHEN l."group"='fuel' THEN ${signed} ELSE 0 END) fuel,SUM(CASE WHEN l."group"='gas' THEN ${signed} ELSE 0 END) gas,COUNT(DISTINCT CASE WHEN d.kind='issue' THEN d.id END) issues ${base} GROUP BY o.id ORDER BY total DESC`, ...f.args),
        all(`SELECT d.recipient_id id,d.recipient_name name,SUM(${signed}) total,COUNT(DISTINCT CASE WHEN d.kind='issue' THEN d.id END) issues,GROUP_CONCAT(DISTINCT d.object_name) objects ${base} GROUP BY d.recipient_id ORDER BY total DESC`, ...f.args),
        all(`SELECT substr(d.operation_at,1,${monthly ? 7 : 10}) date,l."group" group_name,SUM(${signed}) total ${base} GROUP BY date,l."group" ORDER BY date`, ...f.args),
        all(`SELECT o.id object_id,o.name object_name,l.resource_id,MAX(l.name) name,l.unit,l."group" group_name,SUM(CASE WHEN d.kind='issue' THEN l.qty ELSE 0 END) issued,SUM(CASE WHEN d.kind='return' THEN l.qty ELSE 0 END) returned,SUM(${signed}) total ${base} AND l."group" IN ('fuel','gas') GROUP BY o.id,l.resource_id,l.unit,l."group" ORDER BY total DESC`, ...f.args)
    ]);
    return { totals, byGroup, byObject, byPerson, trend, fuel, from: f.from, to: f.to };
}
export async function budgetReport(c: Context) {
    if (c.role === 'operator')
        return null;
    const p = c.url.searchParams;
    const f = filter(c);
    const ms = monthsBetween(f.from, f.to);
    const forbidden = ['recipient', 'resource'].some(k => p.get(k) && p.get(k) !== 'all') || ['part', 'material'].includes(p.get('group') || '');
    if (forbidden)
        return { hidden: true, reason: 'Бюджет задан объекту и статье. Для сравнения уберите фильтр получателя или конкретного ресурса.' };
    let objs = await all('SELECT * FROM objects WHERE workspace=? ORDER BY name', c.workspace);
    if (p.get('object') && p.get('object') !== 'all')
        objs = objs.filter(o => o.id === p.get('object'));
    if (p.get('type') && p.get('type') !== 'all')
        objs = objs.filter(o => o.type === p.get('type'));
    const plans = await all('SELECT * FROM budgets WHERE workspace=? AND month>=? AND month<=?', c.workspace, ms[0], ms.at(-1));
    const fullFrom = ms[0] + '-01', fullTo = periodRange('month', ms.at(-1) + '-01')[1];
    const facts = await all(`SELECT d.object_id,substr(d.operation_at,1,7) month,l."group" group_name,SUM(${signed}) total ${joins} WHERE d.workspace=? AND d.status='posted' AND d.operation_at>=? AND d.operation_at<=? GROUP BY d.object_id,month,l."group"`, c.workspace, fullFrom + 'T00:00:00', fullTo + 'T23:59:59');
    const selected = ['materials', 'fuel', 'gas'].includes(p.get('group') || '') ? [p.get('group')!] : ['materials', 'fuel', 'gas'];
    const rows = objs.map(o => { const detail = ms.flatMap(month => selected.map(a => { const plan = plans.find(x => x.object_id === o.id && x.month === month && x.article === a); return { month, article: a, plan: plan?.amount ?? null, fact: facts.filter(x => x.object_id === o.id && x.month === month && article(x.group_name) === a).reduce((v, x) => v + x.total, 0) }; })); return { ...o, detail, plan: detail.reduce((v, x) => v + (x.plan ?? 0), 0), fact: detail.reduce((v, x) => v + x.fact, 0), filled: detail.filter(x => x.plan !== null).length, expected: detail.length, complete: detail.every(x => x.plan !== null) }; });
    return { rows, months: ms, label: p.get('period') === 'year' ? 'Факт выбранного года / план на год' : f.from !== fullFrom || f.to !== fullTo ? 'Исполнение полных месячных бюджетов' : 'Исполнение бюджета месяца' };
}
export async function journal(c: Context, exportAll = false) {
    const f = filter(c, false);
    const page = Math.max(1, Number(c.url.searchParams.get('page')) || 1), size = 20;
    const base = `${joins} WHERE ${f.where}`;
    if (exportAll)
        return all(`SELECT d.id,d.number,d.kind,d.status,d.operation_at,d.recipient_name,d.object_name,d.author_name,l.name,l."group" group_name,l.unit,l.qty,l.price,l.amount,${signed} net_amount ${base} ORDER BY d.operation_at DESC,d.number,l.id`, ...f.args);
    const orders: Record<string, string> = { date_desc: 'd.operation_at DESC,d.number DESC', date_asc: 'd.operation_at ASC,d.number', amount_desc: 'filtered_total DESC', amount_asc: 'filtered_total ASC' };
    const order = orders[c.url.searchParams.get('sort') || 'date_desc'] || orders.date_desc;
    const count = await one(`SELECT COUNT(DISTINCT d.id) n ${base}`, ...f.args);
    const docs = await all(`SELECT d.*,SUM(${signed}) filtered_total,GROUP_CONCAT(DISTINCT l."group") groups ${base} GROUP BY d.id ORDER BY ${order} LIMIT ? OFFSET ?`, ...f.args, size, (page - 1) * size);
    return { rows: docs, total: count?.n ?? 0, page, size };
}
export async function detailReport(c: Context) { const f = filter(c, false), page = Math.max(1, Number(c.url.searchParams.get('page')) || 1), size = 50; const base = `${joins} WHERE ${f.where}`; const summary = await one(`SELECT COUNT(*) count,COALESCE(SUM(CASE WHEN d.status='posted' THEN ${signed} ELSE 0 END),0) total ${base}`, ...f.args); const rows = await all(`SELECT d.id,d.number,d.kind,d.status,d.operation_at,d.recipient_name,d.object_name,l.name,l."group" group_name,l.qty,l.unit,l.price,${signed} net_amount ${base} ORDER BY d.operation_at DESC,d.number,l.id LIMIT ? OFFSET ?`, ...f.args, size, (page - 1) * size); return { rows, page, size, total: summary?.count || 0, amount: summary?.total || 0 }; }
