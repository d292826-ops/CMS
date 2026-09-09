import { context, permit, responseError, HttpError } from '@/lib/server';
import { filter, joins, signed } from '@/lib/queries';
import { all, one } from '@/db';
import { groupNames } from '@/lib/domain';
import { streamWorkbook } from '@/lib/stream-xlsx';
export async function GET(request: Request) {
    try {
        const c = await context(request);
        permit(c, ['admin', 'finance']);
        const f = filter(c, false), revision = c.settings.revision;
        async function* rows() {
            yield ['ЦМС — детальный отчёт'];
            yield ['Период', f.from, f.to, 'Часовой пояс', c.settings.timezone];
            yield ['База цены', c.settings.price_basis === 'with_vat' ? 'С НДС' : 'Без НДС', 'Валюта', 'RUB'];
            yield ['Дата', 'Документ', 'Операция', 'Получатель', 'Объект', 'Ресурс', 'Группа', 'Количество со знаком', 'Единица', 'Цена, ₽', 'Сумма документа, ₽', 'Факт учёта, ₽', 'Состояние', 'Автор', 'Ссылка на документ'];
            let offset = 0, total = 0, net = 0;
            while (true) {
                const current = await one('SELECT revision FROM workspaces WHERE id=?', c.workspace);
                if (current?.revision !== revision)
                    throw new HttpError(409, 'Данные изменились во время выгрузки. Повторите экспорт.');
                const page = await all(`SELECT d.id,d.number,d.kind,d.status,d.operation_at,d.recipient_name,d.object_name,d.author_name,l.name,l."group" group_name,l.unit,l.qty,l.price,${signed} net_amount ${joins} WHERE ${f.where} ORDER BY d.operation_at DESC,d.id,l.id LIMIT 1000 OFFSET ?`, ...f.args, offset);
                for (const r of page) {
                    total += r.net_amount;
                    if (r.status === 'posted')
                        net += r.net_amount;
                    yield [r.operation_at.replace('T', ' '), r.number, r.kind === 'return' ? 'Возврат' : 'Выдача', r.recipient_name, r.object_name, r.name, groupNames[r.group_name], r.qty / 1000 * (r.kind === 'return' ? -1 : 1), r.unit, r.price / 100, r.net_amount / 100, r.status === 'posted' ? r.net_amount / 100 : 0, r.status === 'posted' ? 'Проведён' : r.status === 'draft' ? 'Черновик' : 'Отменён', r.author_name, new URL('/?document=' + r.id + '&mode=' + c.workspace, request.url).href];
                }
                offset += page.length;
                if (page.length < 1000)
                    break;
            }
            const current = await one('SELECT revision FROM workspaces WHERE id=?', c.workspace);
            if (current?.revision !== revision)
                throw new HttpError(409, 'Данные изменились во время выгрузки. Повторите экспорт.');
            yield ['ИТОГО', '', '', '', '', '', '', '', '', '', total / 100, net / 100];
        }
        return new Response(streamWorkbook(rows()), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="cms-report-${f.from}-${f.to}.xlsx"`, 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        return responseError(e);
    }
}
