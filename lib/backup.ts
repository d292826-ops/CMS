import { db, stmt } from '@/db';
export async function snapshot(workspace: string) {
    const queries = [['workspaces', stmt('SELECT * FROM workspaces WHERE id=?', workspace)], ['users', stmt('SELECT * FROM users')], ...['recipients', 'objects', 'resources', 'documents', 'budgets', 'audit', 'receipts'].map(t => [t, stmt(`SELECT * FROM ${t} WHERE workspace=?`, workspace)]), ['lines', stmt('SELECT l.* FROM lines l JOIN documents d ON d.id=l.document_id WHERE d.workspace=?', workspace)]] as [
        string,
        D1PreparedStatement
    ][];
    const results = await db().batch(queries.map(([, s]) => s));
    return { format: 'cms-backup-v1', createdAt: new Date().toISOString(), workspace, tables: Object.fromEntries(queries.map(([n], i) => [n, results[i].results])) };
}
export async function archiveSnapshot(bucket: R2Bucket, data: Awaited<ReturnType<typeof snapshot>>) {
    const key = `backups/${data.workspace}/${data.createdAt.replace(/[:.]/g, '-')}.json`;
    await bucket.put(key, JSON.stringify(data), { httpMetadata: { contentType: 'application/json' } });
    const cutoff = Date.now() - 31 * 86400000;
    let cursor: string | undefined;
    do {
        const listed = await bucket.list({ prefix: `backups/${data.workspace}/`, cursor });
        const expired = listed.objects.filter(o => o.uploaded.getTime() < cutoff).map(o => o.key);
        if (expired.length)
            await bucket.delete(expired);
        cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    return key;
}
