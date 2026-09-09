// Optional separate Worker: provision DB and BUCKET bindings and a daily Cron Trigger.
// This Worker has no HTTP endpoint. It is deployed only in an infrastructure-controlled environment.
import { env } from 'cloudflare:workers';
import { snapshot, archiveSnapshot } from '../lib/backup';
export default {
    async scheduled(_event: ScheduledController, _bindings: unknown, ctx: ExecutionContext) { ctx.waitUntil((async () => { if (!env.BUCKET)
        throw new Error('Backup BUCKET is required'); for (const workspace of ['live', 'demo'])
        await archiveSnapshot(env.BUCKET, await snapshot(workspace)); })()); },
};
