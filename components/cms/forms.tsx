'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Check, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input, Choice, Picker, Field, Button, Modal, Confirmation } from './ui';
import { articleNames, groupNames, objectTypes, roleNames, money, qtyFormat, lineAmount, scaled, Role } from '@/lib/domain';
export type Api = (view: string, params?: Record<string, any>) => Promise<any>;
export type Mutate = (data: any) => Promise<any>;
export function CatalogForm({ table, record, boot, mutate, onDone, onClose }: {
    table: string;
    record: any;
    boot: any;
    mutate: Mutate;
    onDone: () => void;
    onClose: () => void;
}) {
    const [f, setF] = useState<any>({ ...{ code: '', name: '', type: 'vehicle', group: 'part', unit: 'шт.', price: '', grade: '' }, ...record, price: record?.price != null ? String(record.price / 100) : '' });
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [duplicate, setDuplicate] = useState(false);
    const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
    const save = async (confirmDuplicate = false) => { setBusy(true); setError(''); try {
        await mutate({ ...f, action: 'catalog', table, confirmDuplicate });
        onDone();
    }
    catch (e: any) {
        setError(e.message);
        if (e.status === 422)
            setDuplicate(true);
    }
    finally {
        setBusy(false);
    } };
    const inp = (key: string, label: string, type = 'text') => <Input label={label} value={f[key]} onChange={v => set(key, v)} type={type}/>;
    return <Modal open onClose={onClose} title={record?.id ? 'Редактирование записи' : 'Новая запись'} description={table === 'recipients' ? 'Получатель и объект затрат выбираются независимо.' : undefined}><div className="form-grid">{inp('code', table === 'recipients' ? 'Табельный номер / код *' : 'Уникальный код *')}{inp('name', table === 'recipients' ? 'ФИО *' : 'Наименование *')}{table === 'objects' && <><Field label="Тип объекта *"><Choice label="Тип объекта" value={f.type} onChange={v => set('type', v)} options={Object.entries(objectTypes).map(([value, label]) => ({ value, label }))}/></Field>{f.type === 'vehicle' ? <>{inp('model', 'Марка / модель *')}{inp('plate', 'Госномер / инвентарный номер *')}{inp('vin', 'VIN')}</> : inp('address', 'Адрес / описание')}{inp('responsible', 'Ответственный')}</>}{table === 'recipients' && <>{inp('position', 'Должность')}{inp('department', 'Подразделение сотрудника')}{inp('phone', 'Телефон')}</>}{table === 'resources' && <><Field label="Группа *"><Choice label="Группа ресурса" value={f.group} onChange={v => set('group', v)} options={Object.entries(groupNames).filter(([v]) => record?.fuel ? ['fuel', 'gas'].includes(v) : true).map(([value, label]) => ({ value, label }))}/></Field><Field label="Единица *"><Choice label="Единица" value={f.unit} onChange={v => set('unit', v)} options={['шт.', 'л', 'кг', 'м', 'м³'].map(v => ({ value: v, label: v }))}/></Field>{inp('price', 'Учётная цена, ₽ *', 'number')}{['fuel', 'gas'].includes(f.group) && inp('grade', 'Вид / марка *')}{inp('sku', 'Артикул')}{inp('manufacturer', 'Производитель')}</>}{inp('comment', 'Комментарий')}</div>{error && <div className="error-box" role="alert">{error}</div>}<div className="actions mt-6 justify-end"><Button onClick={onClose}>Отмена</Button><Button primary disabled={busy} onClick={() => save(false)}><Save size={16}/>{busy ? 'Сохранение…' : 'Сохранить'}</Button></div><Confirmation open={duplicate} title="Возможное совпадение" description={error} onCancel={() => setDuplicate(false)} onConfirm={() => { setDuplicate(false); save(true); }}/></Modal>;
}
export function DocumentForm({ initial, boot, fuel, api, mutate, onDone, onClose, onQuickAdd }: {
    initial?: any;
    boot: any;
    fuel: boolean;
    api: Api;
    mutate: Mutate;
    onDone: () => void;
    onClose: () => void;
    onQuickAdd: (t: string) => void;
}) {
    const isReturn = initial?.kind === 'return';
    const [form, setForm] = useState<any>(initial ? { ...initial, lines: initial.lines.map((l: any) => ({ ...l, quantity: String(l.qty / 1000), price: String(l.price / 100) })) } : { operation_at: boot.now.slice(0, 16), recipient_id: '', object_id: '', kind: 'issue', comment: '', lines: [{ resource_id: '', quantity: '1', price: '' }] });
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [exit, setExit] = useState(false), [warnings, setWarnings] = useState<any[] | null>(null);
    const requestKey = React.useRef(crypto.randomUUID());
    const set = (k: string, v: any) => { setDirty(true); setWarnings(null); setForm((f: any) => ({ ...f, [k]: v })); };
    const rowSet = (i: number, k: string, v: any) => { const lines = [...form.lines]; lines[i] = { ...lines[i], [k]: v }; if (k === 'resource_id') {
        const r = boot.resources.find((r: any) => r.id === v);
        lines[i].price = r ? String(r.price / 100) : '';
    } set('lines', lines); };
    useEffect(() => { const f = (e: BeforeUnloadEvent) => { if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', f); return () => window.removeEventListener('beforeunload', f); }, [dirty]);
    const save = async (status: string, confirmed = false) => { setBusy(true); setError(''); const payload = { ...form, status, action: 'document', key: requestKey.current, budgetConfirmed: confirmed }; try {
        if (status === 'posted' && !confirmed) {
            const preview = await mutate({ ...payload, action: 'preview', key: undefined });
            if (preview.warnings?.length) {
                setWarnings(preview.warnings);
                return;
            }
        }
        await mutate(payload);
        onDone();
    }
    catch (e: any) {
        setError(e.message);
    }
    finally {
        setBusy(false);
    } };
    const total = form.lines.reduce((s: number, l: any) => { try {
        return s + lineAmount(scaled(l.quantity, 3), scaled(l.price, 2));
    }
    catch {
        return s;
    } }, 0);
    const active = (a: any[]) => a.filter((x: any) => x.active);
    const resources = active(boot.resources).filter((r: any) => !fuel || ['fuel', 'gas'].includes(r.group));
    return <><Modal open wide onClose={() => dirty ? setExit(true) : onClose()} title={isReturn ? 'Возврат по выдаче' : initial?.id ? 'Редактирование черновика' : fuel ? 'Выдать топливо / газ' : 'Новая выдача'} description={isReturn ? 'Количество — в пределах исходной выдачи. Цена и объект сохраняются.' : 'Один документ — один получатель и один объект затрат.'}><div className="form-grid"><Field label="Получатель / водитель *"><Picker items={boot.recipients} label="Найдите получателя" value={form.recipient_id} onChange={v => set('recipient_id', v)} disabled={isReturn}/>{boot.role === 'admin' && !isReturn && <button className="link" onClick={() => onQuickAdd('recipients')}>+ Добавить получателя</button>}</Field><Field label="Подразделение / объект *"><Picker items={active(boot.objects)} label="Найдите объект" value={form.object_id} onChange={v => set('object_id', v)} disabled={isReturn}/>{boot.role === 'admin' && !isReturn && <button className="link" onClick={() => onQuickAdd('objects')}>+ Добавить объект</button>}</Field><Input label={`Дата и время · ${boot.settings.timezone}`} type="datetime-local" value={form.operation_at.slice(0, 16)} onChange={v => set('operation_at', v)}/><Input label="Основание / комментарий" value={form.comment} onChange={v => set('comment', v)}/></div><div className="form-lines">{form.lines.map((l: any, i: number) => { const r = boot.resources.find((x: any) => x.id === l.resource_id); return <React.Fragment key={i}><div className="form-line"><Field label={isReturn ? `${l.name} · доступно ${qtyFormat(l.maxQty || l.qty)} ${l.unit}` : 'Ресурс *'}>{isReturn ? <div className="input muted">{l.name}</div> : <Picker label="Найдите ресурс" items={resources} value={l.resource_id} onChange={v => rowSet(i, 'resource_id', v)}/>}</Field><Input label={`Кол-во, ${l.unit || r?.unit || ''}`} type="number" min="0.001" step={r?.unit === 'шт.' ? '1' : '0.001'} value={l.quantity} onChange={v => rowSet(i, 'quantity', v)}/><Input label="Цена, ₽" type="number" min="0" step="0.01" disabled={isReturn} value={l.price} onChange={v => rowSet(i, 'price', v)}/><div className="amount num">{(() => { try {
        return money(lineAmount(scaled(l.quantity, 3), scaled(l.price, 2)), 2);
    }
    catch {
        return '—';
    } })()}</div><button className="link" aria-label="Удалить строку" onClick={() => set('lines', form.lines.filter((_: any, j: number) => j !== i))}><Trash2 size={17}/></button></div>{!isReturn && l.resource_id && (Number(l.price) !== r?.price / 100 || Number(l.price) === 0) && <div className="form-grid mb-4"><Input label="Причина изменения / нулевой цены *" value={l.reason || ''} onChange={v => rowSet(i, 'reason', v)}/>{Number(l.price) === 0 && <label className="flex gap-2 items-center text-sm"><Checkbox checked={l.zeroConfirmed || false} onCheckedChange={v => rowSet(i, 'zeroConfirmed', v === true)}/>Подтверждаю нулевую цену</label>}</div>}</React.Fragment>; })}{!isReturn && <div className="actions"><Button onClick={() => set('lines', [...form.lines, { resource_id: '', quantity: '1', price: '' }])}><Plus size={15}/>Добавить строку</Button>{boot.role === 'admin' && <button className="link" onClick={() => onQuickAdd('resources')}>Создать ресурс</button>}</div>}</div><div className="dialog-total"><span>Итого{isReturn ? ' к возврату' : ''}</span><span className="num">{money(total, 2)}</span></div>{isReturn && <p className="tiny muted mb-4">Сервер распределит копеечный остаток по исходной строке. Для топлива оформляйте возврат только при реальной обратной передаче.</p>}{warnings && <div className="notice warning block"><b className="flex gap-2 mb-2"><AlertTriangle size={17}/>Ожидается превышение бюджета</b>{warnings.map(w => <p key={w.article}>{articleNames[w.article]} · {w.month}: ожидаемый факт {money(w.projected)}, лимит {money(w.plan)}, превышение {money(w.excess)}.</p>)}<p className="mt-2">Выдачу можно провести после подтверждения.</p></div>}{error && <div className="error-box" role="alert">{error}</div>}<div className="actions justify-end"><Button onClick={() => dirty ? setExit(true) : onClose()}>Отмена</Button><Button disabled={busy} onClick={() => save('draft')}><Save size={16}/>Сохранить черновик</Button><Button primary disabled={busy} onClick={() => save('posted', !!warnings)}><Check size={16}/>{busy ? 'Проверка…' : warnings ? 'Подтвердить и провести' : 'Провести'}</Button></div></Modal><Confirmation open={exit} title="Закрыть без сохранения?" description="Изменения в документе будут потеряны. Можно вернуться и сохранить черновик." onCancel={() => setExit(false)} onConfirm={onClose}/></>;
}
export function BudgetForm({ object, month, api, mutate, onDone, onClose }: {
    object: any;
    month: string;
    api: Api;
    mutate: Mutate;
    onDone: () => void;
    onClose: () => void;
}) { const [revision, setRevision] = useState<number | null>(null); const [mode, setMode] = useState('month'), [f, setF] = useState<any>({ materials: '', fuel: '', gas: '' }), [allRows, setAllRows] = useState<any[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false); const [period, setPeriod] = useState(month); useEffect(() => { api('budget-edit', { id: object.id, year: period.slice(0, 4) }).then(result => { const rows = result.rows; setRevision(result.revision); setAllRows(rows); setF(Object.fromEntries(['materials', 'fuel', 'gas'].map(a => [a, rows.find((r: any) => r.month === period && r.article === a)?.amount == null ? '' : String(rows.find((r: any) => r.month === period && r.article === a).amount / 100)]))); }).catch(e => setError(e.message)); }, [period]); const copy = () => { const d = new Date(period + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); const prev = d.toISOString().slice(0, 7); api('budget-edit', { id: object.id, year: prev.slice(0, 4) }).then(result => { const rows = result.rows; setF(Object.fromEntries(['materials', 'fuel', 'gas'].map(a => { const r = rows.find((r: any) => r.month === prev && r.article === a); return [a, r?.amount == null ? '' : String(r.amount / 100)]; }))); }); }; const save = async () => { setBusy(true); try {
    const months = mode === 'month' ? [period] : Array.from({ length: 12 }, (_, i) => period.slice(0, 4) + '-' + String(i + 1).padStart(2, '0'));
    const rows = months.flatMap((m, i) => ['materials', 'fuel', 'gas'].map(a => { let amount = f[a]; if (mode === 'annual' && amount !== '') {
        const n = scaled(amount, 2);
        amount = String((Math.floor(n / 12) + (i < n % 12 ? 1 : 0)) / 100);
    } return { month: m, article: a, amount }; }));
    await mutate({ action: 'budget', object_id: object.id, rows, expectedRevision: revision });
    onDone();
}
catch (e: any) {
    setError(e.message);
}
finally {
    setBusy(false);
} }; return <Modal open onClose={onClose} title="Бюджет подразделения" description={object.name}><Tabs value={mode} onValueChange={setMode}><TabsList className="w-full mb-5"><TabsTrigger value="month">На месяц</TabsTrigger><TabsTrigger value="repeat">На 12 месяцев</TabsTrigger><TabsTrigger value="annual">Годовой план</TabsTrigger></TabsList></Tabs><Input type="month" label="Месяц / год" value={period} onChange={setPeriod}/><div className="form-grid mt-5">{Object.entries(articleNames).map(([a, name]) => <Input key={a} label={`${name}, ₽`} type="number" min="0" step="0.01" value={f[a]} onChange={v => setF({ ...f, [a]: v })}/>)}</div><p className="tiny muted mt-4">Пусто — бюджет не задан. Ноль — установлен нулевой лимит. {mode === 'annual' ? 'Годовая сумма распределится на 12 месяцев с сохранением копеек.' : mode === 'repeat' ? 'Указанные суммы будут записаны в каждый месяц выбранного года.' : ''}</p>{error && <div className="error-box">{error}</div>}<div className="actions mt-6 justify-between"><Button onClick={copy}>Из прошлого месяца</Button><Button primary disabled={busy} onClick={save}><Save size={16}/>Сохранить</Button></div></Modal>; }
