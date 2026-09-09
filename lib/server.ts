import { db, one, all, stmt } from '@/db';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { initialize } from './seed';
import { Role, localNow } from './domain';
import { env } from 'cloudflare:workers';
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export async function context(request: Request) {
    const user = await getChatGPTUser();
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'demo';
    if (!['demo', 'live'].includes(mode))
        throw new HttpError(400, 'Неизвестная база учёта');
    let member = user ? await one('SELECT * FROM users WHERE email=?', user.email.toLowerCase()) : null;
    // Only the configured Site owner may bootstrap the first administrator.
    if (user && !member && env.CMS_OWNER_EMAIL && user.email.toLowerCase() === env.CMS_OWNER_EMAIL.toLowerCase()) {
        await db().prepare('INSERT INTO users(id,email,name,role) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM users)').bind(user.userId, user.email.toLowerCase(), user.displayName, 'admin').run();
        member = await one('SELECT * FROM users WHERE email=?', user.email.toLowerCase());
    }
    if (!user || !member?.active) {
        const readViews = ['bootstrap', 'dashboard', 'fuel', 'budgets', 'report', 'journal', 'document'];
        const publicRead = request.method === 'GET' && (url.pathname === '/api/export' ||
            url.pathname === '/api/data' && readViews.includes(url.searchParams.get('view') || 'dashboard'));
        if (mode === 'live' || !publicRead)
            throw new HttpError(user ? 403 : 401, 'Для работы с данными необходим вход и доступ от администратора.');
        // Never expose the editable member demo or live records to visitors.
        const workspace = 'public-demo-' + localNow().slice(0, 7);
        await initialize(workspace);
        const role: Role = 'finance';
        return { user: { userId: 'public-guest', email: '', displayName: 'Гость', fullName: null },
            member: { id: 'public-guest', role, active: 1 }, role, workspace, guest: true,
            settings: (await one('SELECT * FROM workspaces WHERE id=?', workspace))!, url };
    }
    await initialize();
    const workspace = mode;
    const simulated = url.searchParams.get('role');
    const role: Role = workspace === 'demo' && member.role === 'admin' && ['admin', 'operator', 'finance'].includes(simulated || '') ? simulated : member.role;
    return { user, member, role, workspace, guest: false, settings: (await one('SELECT * FROM workspaces WHERE id=?', workspace))!, url };
}
export type Context = Awaited<ReturnType<typeof context>>;
export function permit(c: Context, roles: Role[]) { if (!roles.includes(c.role))
    throw new HttpError(403, 'Для этого действия недостаточно прав'); }
export function sameOrigin(request: Request) { const origin = request.headers.get('origin'); if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, 'Недопустимый источник запроса'); }
export async function transact(c: Context, key: string, action: string, entity: string, statements: D1PreparedStatement[], before: any, after: any, reason = '') {
    if (c.guest) throw new HttpError(403, 'Демонстрация доступна только для просмотра.');
    if (!/^[a-zA-Z0-9_-]{8,120}$/.test(key || ''))
        throw new HttpError(400, 'Отсутствует ключ запроса');
    const receiptKey = c.workspace + ':' + c.user.userId + ':' + key;
    const previous = await one('SELECT result FROM receipts WHERE id=?', receiptKey);
    if (previous)
        return JSON.parse(previous.result);
    const result = { ok: true, id: entity };
    const guard = crypto.randomUUID();
    try {
        await db().batch([
            stmt('INSERT INTO guards(id,ok) VALUES(?,CASE WHEN (SELECT revision FROM workspaces WHERE id=?)=? THEN 1 ELSE 0 END)', guard, c.workspace, c.settings.revision),
            ...statements,
            stmt('UPDATE workspaces SET revision=revision+1 WHERE id=?', c.workspace),
            stmt('INSERT INTO audit(id,workspace,at,actor,action,entity_id,reason,before,after) VALUES(?,?,?,?,?,?,?,?,?)', crypto.randomUUID(), c.workspace, new Date().toISOString(), c.user.displayName, action, entity, reason, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)),
            stmt('INSERT INTO receipts(id,workspace,actor,result) VALUES(?,?,?,?)', receiptKey, c.workspace, c.user.userId, JSON.stringify(result)), stmt('DELETE FROM guards WHERE id=?', guard)
        ]);
        return result;
    }
    catch (e) {
        const retry = await one('SELECT result FROM receipts WHERE id=?', receiptKey);
        if (retry)
            return JSON.parse(retry.result);
        if (String(e).includes('optimistic_concurrency_guard'))
            throw new HttpError(409, 'Данные изменились другим пользователем. Обновите экран и повторите действие.');
        throw e;
    }
}
export function responseError(e: unknown) { console.error('CMS request failed', e); const status = e instanceof HttpError ? e.status : 400; return Response.json({ error: e instanceof Error ? e.message : 'Не удалось выполнить действие' }, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function json(data: any) { return Response.json(data, { headers: { 'Cache-Control': 'no-store' } }); }
export function required(value: any, label: string) { if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, `Заполните поле «${label}»`); if (value.length > 2000)
    throw new HttpError(400, 'Слишком длинное значение'); return value.trim(); }
export async function consistent(c: Context, read: () => Promise<any>) { for (let attempt = 0; attempt < 3; attempt++) {
    c.settings = (await one('SELECT * FROM workspaces WHERE id=?', c.workspace))!;
    const revision = c.settings.revision;
    const result = await read();
    const latest = await one('SELECT revision FROM workspaces WHERE id=?', c.workspace);
    if (latest?.revision === revision)
        return result;
} throw new HttpError(409, 'Учёт обновляется. Повторите загрузку через несколько секунд.'); }
