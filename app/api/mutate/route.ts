import { context, json, responseError, sameOrigin, HttpError } from '@/lib/server';
import { catalog, saveDocument, cancelDocument, saveBudgets, settings } from '@/lib/mutations';
import { one } from '@/db';
export async function POST(request: Request) { try {
    sameOrigin(request);
    const c = await context(request);
    if (c.guest) throw new HttpError(403, 'Демонстрация доступна только для просмотра.');
    if (Number(request.headers.get('content-length') || 0) > 500000)
        throw new HttpError(413, 'Запрос слишком большой');
    const b: any = await request.json();
    if (b.key) {
        const old = await one('SELECT result FROM receipts WHERE id=?', c.workspace + ':' + c.user.userId + ':' + b.key);
        if (old)
            return json(JSON.parse(old.result));
    }
    switch (b.action) {
        case 'catalog': return json(await catalog(c, b));
        case 'document': return json(await saveDocument(c, b));
        case 'preview': return json(await saveDocument(c, b, true));
        case 'cancel': return json(await cancelDocument(c, b));
        case 'budget': return json(await saveBudgets(c, b));
        case 'user':
        case 'settings': return json(await settings(c, b));
        default: throw new HttpError(400, 'Неизвестное действие');
    }
}
catch (e) {
    return responseError(e);
} }
