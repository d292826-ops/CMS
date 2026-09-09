import { context, permit, responseError } from '@/lib/server';
import { env } from 'cloudflare:workers';
import { snapshot, archiveSnapshot } from '@/lib/backup';
export async function GET(request: Request) {
    try {
        const c = await context(request);
        permit(c, ['admin']);
        const data = await snapshot(c.workspace);
        if (env.BUCKET)
            await archiveSnapshot(env.BUCKET, data);
        return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="cms-backup-${c.workspace}-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        return responseError(e);
    }
}
