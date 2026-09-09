import { all, one, stmt } from '@/db';
import { Context, HttpError, permit, required, transact } from './server';
import { scaled, lineAmount, returnAmount, validateDate, localNow, article, money } from './domain';
const tables = ['recipients', 'objects', 'resources'];
export async function catalog(c: Context, b: any) {
    permit(c, ['admin']);
    if (!tables.includes(b.table))
        throw new HttpError(400, 'Неизвестный справочник');
    const table = b.table;
    const before = b.id ? await one(`SELECT * FROM ${table} WHERE id=? AND workspace=?`, b.id, c.workspace) : null;
    if (b.id && !before)
        throw new HttpError(404, 'Запись не найдена');
    if (before && b.version !== before.version)
        throw new HttpError(409, 'Запись уже изменена. Обновите её.');
    const id = before?.id || crypto.randomUUID();
    let record: any;
    if (b.archive !== undefined) {
        if (!before)
            throw new HttpError(404, 'Запись не найдена');
        record = { ...before, active: b.archive ? 0 : 1 };
        return transact(c, b.key, 'Изменён статус справочника', id, [stmt(`UPDATE ${table} SET active=?,version=version+1 WHERE id=?`, record.active, id)], before, record);
    }
    record = { name: required(b.name, 'Наименование'), code: required(b.code, 'Код'), comment: String(b.comment || '').slice(0, 2000) };
    if (table === 'recipients') {
        for (const k of ['position', 'department', 'phone'])
            record[k] = String(b[k] || '').slice(0, 200);
        const duplicate = await one('SELECT id FROM recipients WHERE workspace=? AND name=? AND id<>?', c.workspace, record.name, id);
        if (duplicate && !b.confirmDuplicate)
            throw new HttpError(422, 'Получатель с таким ФИО уже существует. Подтвердите создание однофамильца.');
    }
    if (table === 'objects') {
        if (!['vehicle', 'building', 'department'].includes(b.type))
            throw new Error('Выберите тип объекта');
        record.type = b.type;
        for (const k of ['model', 'plate', 'vin', 'address', 'responsible'])
            record[k] = String(b[k] || '').slice(0, 300);
        if (b.type === 'vehicle') {
            required(record.model, 'Марка / модель');
            required(record.plate, 'Госномер или инвентарный номер');
        }
    }
    if (table === 'resources') {
        if (!['part', 'material', 'fuel', 'gas'].includes(b.group))
            throw new Error('Выберите группу ресурса');
        record.group = b.group;
        if (!['шт.', 'л', 'кг', 'м', 'м³'].includes(b.unit))
            throw new Error('Выберите единицу измерения');
        if (['fuel', 'gas'].includes(b.group) && !['л', 'кг', 'м³'].includes(b.unit))
            throw new Error('Для топлива и газа допустимы л, кг и м³');
        record.unit = b.unit;
        record.price = scaled(b.price, 2);
        for (const k of ['sku', 'manufacturer', 'grade'])
            record[k] = String(b[k] || '').slice(0, 200);
        if (['fuel', 'gas'].includes(b.group))
            required(record.grade, 'Вид / марка топлива');
        if (before && (before.group !== b.group || before.unit !== b.unit)) {
            const used = await one("SELECT l.id FROM lines l JOIN documents d ON d.id=l.document_id WHERE l.resource_id=? AND d.status<>'draft' LIMIT 1", id);
            if (used)
                throw new Error('После проведения нельзя менять группу и единицу ресурса. Создайте новую позицию.');
        }
        if (record.sku) {
            const dup = await one('SELECT id FROM resources WHERE workspace=? AND sku=? AND manufacturer=? AND id<>?', c.workspace, record.sku, record.manufacturer, id);
            if (dup && !b.confirmDuplicate)
                throw new HttpError(422, 'Этот артикул и производитель уже есть. Подтвердите отдельное исполнение.');
        }
    }
    const keys = Object.keys(record);
    const sql = before ? stmt(`UPDATE ${table} SET ${keys.map(k => '"' + k + '"=?').join(',')},version=version+1 WHERE id=?`, ...Object.values(record), id) : stmt(`INSERT INTO ${table}(id,workspace,${keys.map(k => '"' + k + '"').join(',')}) VALUES(${Array(keys.length + 2).fill('?').join(',')})`, id, c.workspace, ...Object.values(record));
    return transact(c, b.key, 'Сохранён справочник', id, [sql], before, record);
}
export async function saveDocument(c: Context, b: any, preview = false) {
    permit(c, ['admin', 'operator']);
    const before = b.id ? await one('SELECT * FROM documents WHERE id=? AND workspace=?', b.id, c.workspace) : null;
    if (b.id && !before)
        throw new HttpError(404, 'Документ не найден');
    if (before && (before.status !== 'draft' || (c.role !== 'admin' && before.author !== c.user.userId)))
        throw new HttpError(403, 'Можно менять только свой черновик');
    if (before && before.version !== b.version)
        throw new HttpError(409, 'Черновик изменён другим пользователем');
    const operationAt = validateDate(b.operation_at);
    const kind = b.kind === 'return' ? 'return' : 'issue';
    let original: any = null;
    let recipient: any, object: any;
    if (kind === 'return') {
        original = await one("SELECT * FROM documents WHERE id=? AND workspace=? AND kind='issue' AND status='posted'", b.original_id, c.workspace);
        if (!original)
            throw new Error('Исходная проведённая выдача не найдена');
        if (operationAt < original.operation_at)
            throw new Error('Возврат не может быть раньше исходной выдачи');
        recipient = { id: original.recipient_id, name: original.recipient_name };
        object = { id: original.object_id, name: original.object_name };
    }
    else {
        recipient = await one('SELECT * FROM recipients WHERE id=? AND workspace=? AND active=1', b.recipient_id, c.workspace);
        object = await one('SELECT * FROM objects WHERE id=? AND workspace=? AND active=1', b.object_id, c.workspace);
        if (!recipient || !object)
            throw new Error('Выберите активного получателя и объект затрат');
    }
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 200)
        throw new Error('Добавьте от 1 до 200 строк');
    const rows: any[] = [];
    const seen = new Set<string>();
    for (const l of b.lines) {
        let row: any;
        const qty = scaled(l.quantity, 3);
        if (qty <= 0)
            throw new Error('Количество должно быть больше нуля');
        if (kind === 'return') {
            const source = await one('SELECT * FROM lines WHERE id=? AND document_id=?', l.original_line_id, original.id);
            if (!source)
                throw new Error('Строка исходной выдачи не найдена');
            if (seen.has(source.id))
                throw new Error('Не повторяйте одну строку возврата');
            seen.add(source.id);
            const prior = await one("SELECT COALESCE(SUM(l.qty),0) qty,COALESCE(SUM(l.amount),0) amount FROM lines l JOIN documents d ON d.id=l.document_id WHERE l.original_line_id=? AND d.status='posted'", source.id);
            row = { ...source, id: crypto.randomUUID(), qty, amount: returnAmount(source as {
                    qty: number;
                    price: number;
                    amount: number;
                }, prior!.qty, prior!.amount, qty), original_line_id: source.id, reason: '' };
        }
        else {
            const r = await one('SELECT * FROM resources WHERE id=? AND workspace=? AND active=1', l.resource_id, c.workspace);
            if (!r)
                throw new Error('Выберите активный ресурс');
            const price = scaled(l.price, 2);
            const reason = String(l.reason || '').trim();
            if (price !== r.price && !reason)
                throw new Error(`Укажите причину изменения цены: ${r.name}`);
            if (price === 0 && (!l.zeroConfirmed || !reason))
                throw new Error(`Подтвердите нулевую цену и укажите причину: ${r.name}`);
            row = { id: crypto.randomUUID(), resource_id: r.id, name: r.name, code: r.code, group: r.group, unit: r.unit, qty, price, amount: lineAmount(qty, price), reason, original_line_id: null };
        }
        if (row.unit === 'шт.' && qty % 1000 !== 0)
            throw new Error('Для штук требуется целое количество');
        rows.push(row);
    }
    const total = rows.reduce((s, l) => s + l.amount, 0);
    if (!Number.isSafeInteger(total))
        throw new Error('Сумма документа слишком велика');
    const warnings = [];
    if (kind === 'issue') {
        const month = operationAt.slice(0, 7);
        for (const a of ['materials', 'fuel', 'gas']) {
            const delta = rows.filter(r => article(r.group) === a).reduce((s, l) => s + l.amount, 0);
            if (!delta)
                continue;
            const plan = await one('SELECT amount FROM budgets WHERE workspace=? AND object_id=? AND month=? AND article=?', c.workspace, object.id, month, a);
            if (plan?.amount != null) {
                const groups = a === 'materials' ? ['part', 'material'] : [a];
                const fact = await one(`SELECT COALESCE(SUM(CASE WHEN d.kind='return' THEN -l.amount ELSE l.amount END),0) total FROM documents d JOIN lines l ON l.document_id=d.id WHERE d.workspace=? AND d.object_id=? AND d.status='posted' AND substr(d.operation_at,1,7)=? AND l."group" IN (${groups.map(() => '?').join(',')})`, c.workspace, object.id, month, ...groups);
                if (fact!.total + delta > plan.amount)
                    warnings.push({ article: a, month, plan: plan.amount, fact: fact!.total, projected: fact!.total + delta, excess: fact!.total + delta - plan.amount });
            }
        }
    }
    if (preview)
        return { total, warnings };
    if (b.status === 'posted' && warnings.length && !b.budgetConfirmed)
        throw new HttpError(422, 'Ожидается превышение бюджета. Проверьте предупреждение и подтвердите проведение.');
    const id = before?.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const doc = { id, workspace: c.workspace, number: before?.number || `${kind === 'issue' ? 'В' : 'Р'}-${operationAt.slice(0, 4)}-${String(c.settings.revision + 1).padStart(6, '0')}`, kind, status: b.status === 'posted' ? 'posted' : 'draft', operation_at: operationAt, created_at: before?.created_at || now, recipient_id: recipient.id, object_id: object.id, recipient_name: recipient.name, object_name: object.name, author: before?.author || c.user.userId, author_name: before?.author_name || c.user.displayName, comment: String(b.comment || '').slice(0, 2000), reason: '', original_id: original?.id || null, total };
    const statements: D1PreparedStatement[] = [];
    if (before) {
        statements.push(stmt('DELETE FROM lines WHERE document_id=?', id));
        const keys = Object.keys(doc).filter(k => k !== 'id');
        statements.push(stmt(`UPDATE documents SET ${keys.map(k => k + '=?').join(',')},version=version+1 WHERE id=?`, ...keys.map(k => (doc as any)[k]), id));
    }
    else {
        const keys = Object.keys(doc);
        statements.push(stmt(`INSERT INTO documents(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...Object.values(doc)));
    }
    for (const row of rows)
        statements.push(stmt('INSERT INTO lines(id,document_id,resource_id,name,code,"group",unit,qty,price,amount,reason,original_line_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', row.id, id, row.resource_id, row.name, row.code, row.group, row.unit, row.qty, row.price, row.amount, row.reason, row.original_line_id));
    return transact(c, b.key, doc.status === 'posted' ? 'Проведён документ' : 'Сохранён черновик', id, statements, before, { ...doc, lines: rows }, doc.comment);
}
export async function cancelDocument(c: Context, b: any) {
    const doc = await one('SELECT * FROM documents WHERE id=? AND workspace=?', b.id, c.workspace);
    if (!doc)
        throw new HttpError(404, 'Документ не найден');
    if (doc.status === 'draft') {
        permit(c, ['admin', 'operator']);
        if (c.role !== 'admin' && doc.author !== c.user.userId)
            throw new HttpError(403, 'Это черновик другого пользователя');
        return transact(c, b.key, 'Удалён черновик', doc.id, [stmt('DELETE FROM lines WHERE document_id=?', doc.id), stmt('DELETE FROM documents WHERE id=?', doc.id)], doc, null);
    }
    permit(c, ['admin']);
    if (doc.status !== 'posted')
        throw new Error('Документ уже отменён');
    const reason = required(b.reason, 'Причина отмены');
    const linked = await one("SELECT id FROM documents WHERE original_id=? AND status<>'cancelled' LIMIT 1", doc.id);
    if (linked)
        throw new Error('Сначала отмените связанные возвраты и удалите их черновики');
    return transact(c, b.key, 'Отменён документ', doc.id, [stmt("UPDATE documents SET status='cancelled',reason=?,version=version+1 WHERE id=?", reason, doc.id)], doc, { ...doc, status: 'cancelled' }, reason);
}
export async function saveBudgets(c: Context, b: any) { permit(c, ['admin', 'finance']); if (b.expectedRevision !== c.settings.revision)
    throw new HttpError(409, 'Бюджет или учётные данные изменились. Закройте и снова откройте редактор бюджета.'); const object = await one('SELECT id FROM objects WHERE id=? AND workspace=?', b.object_id, c.workspace); if (!object)
    throw new Error('Объект не найден'); if (!Array.isArray(b.rows) || b.rows.length > 36)
    throw new Error('Некорректный бюджет'); const statements = [], before = []; const unique = new Set(); for (const row of b.rows) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || !['materials', 'fuel', 'gas'].includes(row.article))
        throw new Error('Некорректный месяц или статья');
    const key = row.month + row.article;
    if (unique.has(key))
        throw new Error('Статья повторяется');
    unique.add(key);
    const amount = row.amount === '' || row.amount == null ? null : scaled(row.amount, 2);
    before.push(await one('SELECT * FROM budgets WHERE workspace=? AND object_id=? AND month=? AND article=?', c.workspace, b.object_id, row.month, row.article));
    statements.push(stmt('INSERT INTO budgets(id,workspace,object_id,month,article,amount,author,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(workspace,object_id,month,article) DO UPDATE SET amount=excluded.amount,author=excluded.author,updated_at=excluded.updated_at', crypto.randomUUID(), c.workspace, b.object_id, row.month, row.article, amount, c.user.displayName, new Date().toISOString()));
} return transact(c, b.key, 'Изменён бюджет', b.object_id, statements, before, b.rows); }
export async function settings(c: Context, b: any) {
    permit(c, ['admin']);
    if (b.action === 'user') {
        if (c.workspace !== 'live')
            throw new HttpError(403, 'Рабочие права изменяются только в рабочей базе');
        const email = required(b.email, 'Email').toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            throw new Error('Введите корректный email');
        if (!['admin', 'operator', 'finance'].includes(b.role))
            throw new Error('Выберите роль');
        const before = await one('SELECT * FROM users WHERE email=?', email);
        if (before?.id === c.member.id && (b.active === false || b.role !== 'admin'))
            throw new Error('Нельзя лишить себя прав администратора');
        const id = before?.id || crypto.randomUUID();
        return transact(c, b.key, 'Изменён доступ пользователя', id, [stmt('INSERT INTO users(id,email,name,role,active) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,active=excluded.active,version=users.version+1', id, email, required(b.name, 'Имя'), b.role, b.active === false ? 0 : 1)], before, { email, role: b.role, name: b.name, active: b.active !== false });
    }
    const timezone = required(b.timezone, 'Часовой пояс');
    try {
        new Intl.DateTimeFormat('ru', { timeZone: timezone });
    }
    catch {
        throw new Error('Некорректный часовой пояс');
    }
    ;
    if (!['with_vat', 'without_vat'].includes(b.price_basis))
        throw new Error('Выберите базу стоимости');
    if (b.price_basis !== c.settings.price_basis || timezone !== c.settings.timezone) {
        const used = await one("SELECT id FROM documents WHERE workspace=? AND status<>'draft' LIMIT 1", c.workspace);
        if (used)
            throw new Error('После первой проведённой операции база цены и часовой пояс фиксированы. Нужен согласованный перенос данных.');
    }
    return transact(c, b.key, 'Изменены настройки', c.workspace, [stmt('UPDATE workspaces SET name=?,timezone=?,price_basis=? WHERE id=?', required(b.name, 'Предприятие'), timezone, b.price_basis, c.workspace)], c.settings, b);
}
