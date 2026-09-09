import { db, stmt, one } from '@/db';
import { localNow, lineAmount } from './domain';
export async function initialize(workspace = 'demo') {
    const key = (id: string) => workspace === 'demo' ? id : workspace + ':' + id;
    if (await one('SELECT id FROM workspaces WHERE id=?', workspace))
        return;
    const today = localNow().slice(0, 10), month = today.slice(0, 7), early = month + '-01';
    const past = new Date(month + '-01T00:00:00Z');
    past.setUTCMonth(past.getUTCMonth() - 1);
    const pm = past.toISOString().slice(0, 7);
    const s = [stmt('INSERT OR IGNORE INTO workspaces(id,name) VALUES(?,?)', workspace, 'Демонстрационная база')];
    if (workspace === 'demo') s.unshift(stmt('INSERT OR IGNORE INTO workspaces(id,name) VALUES(?,?)', 'live', 'Предприятие'));
    const people = [['p1', 'С01', 'Иванов Иван Иванович', 'Водитель'], ['p2', 'С02', 'Петров Пётр Петрович', 'Водитель'], ['p3', 'С03', 'Сидоров Алексей Сергеевич', 'Завхоз']];
    for (const [id, code, name, position] of people)
        s.push(stmt('INSERT OR IGNORE INTO recipients(id,workspace,code,name,position) VALUES(?,?,?,?,?)', key(id), workspace, code, name, position));
    const obs = [['o1', 'О01', 'КАМАЗ 65115', 'vehicle', 'КАМАЗ 65115', 'А111АА41'], ['o2', 'О02', 'ГАЗель', 'vehicle', 'ГАЗ 3302', 'В222ВВ41'], ['o3', 'О03', 'Административное здание', 'building', '', '']];
    for (const [id, code, name, type, model, plate] of obs)
        s.push(stmt('INSERT OR IGNORE INTO objects(id,workspace,code,name,type,model,plate) VALUES(?,?,?,?,?,?,?)', key(id), workspace, code, name, type, model, plate));
    const res = [['r1', 'М01', 'Фильтр масляный', 'part', 'шт.', 120000], ['r2', 'М02', 'Масло моторное', 'material', 'л', 45000], ['r3', 'М03', 'Краска', 'material', 'кг', 90000], ['r4', 'Т01', 'Дизельное топливо', 'fuel', 'л', 7500], ['r5', 'Т02', 'Бензин АИ-95', 'fuel', 'л', 6500], ['r6', 'Т03', 'Пропан-бутан', 'gas', 'л', 3500]] as const;
    for (const [id, code, name, g, unit, price] of res)
        s.push(stmt('INSERT OR IGNORE INTO resources(id,workspace,code,name,"group",unit,price,grade) VALUES(?,?,?,?,?,?,?,?)', key(id), workspace, code, name, g, unit, price, g === 'fuel' || g === 'gas' ? name : ''));
    const ops = [{ id: 'd1', n: 'В01', o: 0, date: early, rows: [[0, 2000], [1, 20000]] }, { id: 'd2', n: 'В02', o: 0, date: today, rows: [[3, 200000]] }, { id: 'd3', n: 'Р01', o: 0, date: today, rows: [[0, 1000]], ret: true }, { id: 'd4', n: 'В03', o: 1, date: early, rows: [[2, 2000]] }, { id: 'd5', n: 'В04', o: 1, date: today, rows: [[4, 80000]] }, { id: 'd6', n: 'В05', o: 2, date: early, rows: [[2, 10000]] }, { id: 'd7', n: 'В06', o: 2, date: today, rows: [[5, 150000]] }, { id: 'h1', n: 'В-П01', o: 0, date: pm + '-12', rows: [[3, 140000]] }, { id: 'h2', n: 'В-П02', o: 1, date: pm + '-17', rows: [[4, 60000]] }, { id: 'h3', n: 'В-П03', o: 2, date: pm + '-23', rows: [[2, 5000]] }];
    for (const op of ops) {
        const total = op.rows.reduce((v, [r, q]) => v + lineAmount(q, res[r][5]), 0);
        s.push(stmt('INSERT OR IGNORE INTO documents(id,workspace,number,kind,status,operation_at,created_at,recipient_id,object_id,recipient_name,object_name,author,author_name,comment,original_id,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', key(op.id), workspace, op.n, op.ret ? 'return' : 'issue', 'posted', op.date + (op.ret ? 'T15:00:00' : 'T09:00:00'), localNow(), key(people[op.o][0]), key(obs[op.o][0]), people[op.o][2], obs[op.o][2], 'demo-admin', 'Администратор (пример)', 'Демонстрационная операция', op.ret ? key('d1') : null, total));
        op.rows.forEach(([r, q], i) => s.push(stmt('INSERT OR IGNORE INTO lines(id,document_id,resource_id,name,code,"group",unit,qty,price,amount,original_line_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)', key(op.id + 'l' + i), key(op.id), key(res[r][0]), res[r][2], res[r][1], res[r][3], res[r][4], q, res[r][5], lineAmount(q, res[r][5]), op.ret ? key('d1l0') : null)));
    }
    const plans = [[900000, 1500000, 0], [300000, 700000, 0], [900000, 0, 600000]];
    for (const m of [month, pm])
        for (let o = 0; o < 3; o++)
            ['materials', 'fuel', 'gas'].forEach((a, i) => s.push(stmt('INSERT OR IGNORE INTO budgets(id,workspace,object_id,month,article,amount,author,updated_at) VALUES(?,?,?,?,?,?,?,?)', key(m + o + a), workspace, key(obs[o][0]), m, a, plans[o][i], 'Демонстрация', localNow())));
    await db().batch(s);
}
