import { all, one } from '@/db';
import { context, json, permit, responseError, HttpError, consistent } from '@/lib/server';
import { dashboard, budgetReport, journal, detailReport } from '@/lib/queries';
import { localNow } from '@/lib/domain';
export async function GET(request: Request) {
    try {
        const c = await context(request);
        const view = c.url.searchParams.get('view') || 'dashboard';
        if (view === 'bootstrap') {
            const [recipients, objects, resources] = await Promise.all(['recipients', 'objects', 'resources'].map(t => all(`SELECT * FROM ${t} WHERE workspace=? ORDER BY active DESC,name`, c.workspace)));
            return json({ recipients, objects, resources, role: c.role, actualRole: c.member.role, user: { name: c.user.displayName, email: c.user.email, id: c.user.userId }, settings: c.settings, now: localNow(c.settings.timezone) });
        }
        if (view === 'dashboard') {
            permit(c, ['admin', 'finance']);
            return json(await consistent(c, async () => { const [stats, budget] = await Promise.all([dashboard(c), budgetReport(c)]); return { ...stats, budget }; }));
        }
        if (view === 'fuel') {
            permit(c, ['admin', 'finance']);
            return json(await consistent(c, () => dashboard(c)));
        }
        if (view === 'budgets') {
            permit(c, ['admin', 'finance']);
            return json(await consistent(c, () => budgetReport(c)));
        }
        if (view === 'budget-edit') {
            permit(c, ['admin', 'finance']);
            return json({ revision: c.settings.revision, rows: await all('SELECT * FROM budgets WHERE workspace=? AND object_id=? AND month LIKE ?', c.workspace, c.url.searchParams.get('id') || '', (c.url.searchParams.get('year') || '2026') + '-%') });
        }
        if (view === 'report') {
            permit(c, ['admin', 'finance']);
            return json(await consistent(c, () => detailReport(c)));
        }
        if (view === 'journal')
            return json(await consistent(c, () => journal(c)));
        if (view === 'document') {
            const d = await one('SELECT * FROM documents WHERE id=? AND workspace=?', c.url.searchParams.get('id') || '', c.workspace);
            if (!d)
                throw new HttpError(404, 'Документ не найден');
            const lines = await all("SELECT l.*,COALESCE((SELECT SUM(rl.qty) FROM lines rl JOIN documents rd ON rd.id=rl.document_id WHERE rl.original_line_id=l.id AND rd.status='posted'),0) returned_qty FROM lines l WHERE l.document_id=?", d.id);
            return json({ ...d, lines });
        }
        if (view === 'audit') {
            permit(c, ['admin']);
            return json(await all('SELECT * FROM audit WHERE workspace=? ORDER BY at DESC LIMIT 100', c.workspace));
        }
        if (view === 'users') {
            permit(c, ['admin']);
            return json(await all('SELECT id,email,name,role,active,version FROM users ORDER BY name'));
        }
        throw new HttpError(404, 'Раздел не найден');
    }
    catch (e) {
        return responseError(e);
    }
}
