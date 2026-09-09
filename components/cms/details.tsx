'use client';
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ArrowLeftRight, Pencil, Trash2, X, Download } from 'lucide-react';
import { Button, Loading, Input, Modal, Confirmation, T, Choice, Empty } from './ui';
import { DocumentTable, Panel, FuelTable, Trend } from './dashboard';
import { Api, Mutate } from './forms';
import { money, qtyFormat, groupNames, roleNames, budgetState, Role } from '@/lib/domain';
export function DocumentDetail({ id, boot, api, mutate, onClose, onEdit, onReturn, onChanged }: {
    id: string;
    boot: any;
    api: Api;
    mutate: Mutate;
    onClose: () => void;
    onEdit: (d: any) => void;
    onReturn: (d: any) => void;
    onChanged: () => void;
}) { const [d, setD] = useState<any>(null), [error, setError] = useState(''), [cancel, setCancel] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false); useEffect(() => { api('document', { id }).then(setD).catch(e => setError(e.message)); }, [id]); const canWrite = ['admin', 'operator'].includes(boot.role); const remove = async () => { setBusy(true); try {
    await mutate({ action: 'cancel', id, reason });
    onChanged();
    onClose();
}
catch (e: any) {
    setError(e.message);
    setCancel(false);
}
finally {
    setBusy(false);
} }; return <Sheet open onOpenChange={v => { if (!v)
    onClose(); }}><SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-6"><SheetHeader className="p-0"><SheetTitle>{d ? `${d.kind === 'return' ? 'Возврат' : 'Выдача'} ${d.number}` : 'Документ'}</SheetTitle><SheetDescription>История выдачи ресурсов</SheetDescription></SheetHeader>{error && <div className="error-box">{error}</div>}{!d ? <Loading /> : <><div className="sheet-info"><div><small>Дата операции</small>{d.operation_at.replace('T', ' ')}</div><div><small>Состояние</small>{d.status === 'posted' ? 'Проведён' : d.status === 'draft' ? 'Черновик' : 'Отменён'}</div><div><small>Получатель</small>{d.recipient_name}</div><div><small>Объект</small>{d.object_name}</div><div><small>Автор</small>{d.author_name}</div><div><small>Дата ввода</small>{new Date(d.created_at).toLocaleString('ru-RU', { timeZone: boot.settings.timezone })}</div></div>{d.comment && <div className="notice">{d.comment}</div>}{d.reason && <div className="notice warning">Причина отмены: {d.reason}</div>}<div className="table-wrap"><T.Table className="data-table"><T.TableHeader><T.TableRow>{['Ресурс', 'Количество', 'Цена', 'Сумма'].map(n => <T.TableHead key={n}>{n}</T.TableHead>)}</T.TableRow></T.TableHeader><T.TableBody>{d.lines.map((l: any) => <T.TableRow key={l.id}><T.TableCell>{l.name}<div className="doc-date">{l.code} · {groupNames[l.group]}</div>{l.reason && <div className="doc-date">Цена: {l.reason}</div>}</T.TableCell><T.TableCell>{qtyFormat(l.qty)} {l.unit}{l.returned_qty > 0 && <div className="doc-date">Возвращено: {qtyFormat(l.returned_qty)}</div>}</T.TableCell><T.TableCell>{money(l.price, 2)}</T.TableCell><T.TableCell>{money(l.amount, 2)}</T.TableCell></T.TableRow>)}</T.TableBody></T.Table></div><div className="dialog-total"><span>Итого</span><span>{money(d.total * (d.kind === 'return' ? -1 : 1), 2)}</span></div>{d.original_id && <button className="link mb-4" onClick={() => api('document', { id: d.original_id }).then(setD)}>Открыть исходную выдачу</button>}<div className="actions">{d.status === 'draft' && canWrite && (boot.role === 'admin' || d.author === boot.user.id) && <><Button primary onClick={() => onEdit(d)}><Pencil size={15}/>Редактировать</Button><Button className="danger" onClick={() => setCancel(true)}><Trash2 size={15}/>Удалить черновик</Button></>}{d.status === 'posted' && d.kind === 'issue' && canWrite && d.lines.some((l: any) => l.qty > l.returned_qty) && <Button primary onClick={() => onReturn(d)}><ArrowLeftRight size={16}/>Оформить возврат</Button>}{d.status === 'posted' && boot.role === 'admin' && <Button className="danger" onClick={() => setCancel(true)}>Отменить документ</Button>}</div>{cancel && <Modal open title={d.status === 'draft' ? 'Удалить черновик?' : 'Отмена проведённого документа'} onClose={() => setCancel(false)} description="Это действие сохраняется в истории изменений.">{d.status !== 'draft' && <Input label="Причина отмены *" value={reason} onChange={setReason}/>}<div className="actions mt-5 justify-end"><Button onClick={() => setCancel(false)}>Назад</Button><Button primary disabled={busy || d.status !== 'draft' && !reason.trim()} onClick={remove}>Подтвердить</Button></div></Modal>}</>}</SheetContent></Sheet>; }
export function EntityDetail({ entity, kind, boot, api, filters, onClose, onDocument, onBudget }: {
    entity: any;
    kind: string;
    boot: any;
    api: Api;
    filters: any;
    onClose: () => void;
    onDocument: (id: string) => void;
    onBudget: (o: any) => void;
}) { const [localFilters, setLocalFilters] = useState(filters); const [d, setD] = useState<any>(null), [j, setJ] = useState<any>(null), [error, setError] = useState(''); useEffect(() => { const f = { ...localFilters, object: kind === 'objects' ? entity.id : 'all', recipient: kind === 'recipients' ? entity.id : 'all', page: 1 }; Promise.all([boot.role === 'operator' ? Promise.resolve(null) : api('dashboard', f), api('journal', f)]).then(([a, b]) => { setD(a); setJ(b); }).catch(e => setError(e.message)); }, [entity.id, localFilters]); const br = d?.budget?.rows?.find((r: any) => r.id === entity.id); const state = br ? budgetState(br.plan, br.fact, br.complete) : null; return <Sheet open onOpenChange={v => { if (!v)
    onClose(); }}><SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-6"><SheetHeader className="p-0 mb-5"><SheetTitle>{entity.name}</SheetTitle><SheetDescription>{entity.plate || entity.position || entity.address || entity.code} · {localFilters.from} — {localFilters.to}</SheetDescription></SheetHeader>{error && <div className="error-box">{error}</div>}{d && <><div className="stat mb-5"><div className="stat-title">Расходы за период</div><div className="stat-value">{money(d.totals.total)}</div><div className="stat-sub">{d.totals.issues} выдач · {d.totals.returns} возвратов</div></div>{br && <div className="notice block"><div className="flex justify-between gap-4"><span>Бюджет: {money(br.plan)} · остаток: {state?.remaining == null ? '—' : money(state.remaining)}</span>{!boot.guest && <button className="link" onClick={() => onBudget(entity)}>Изменить</button>}</div><p className="mt-2">{d.budget.label} · {state?.label}</p></div>}<Trend data={d} period={localFilters.period} onDrill={(from, to) => setLocalFilters({ ...localFilters, from, to, period: 'custom' })}/><div className="mt-5"><FuelTable data={d.fuel} onOpen={(object, resource) => setLocalFilters({ ...localFilters, object, resource })}/></div><div className="flex flex-wrap gap-4 my-5">{d.byGroup.map((g: any) => <span className="status neutral" key={g.group_name}>{groupNames[g.group_name]} · {money(g.total)}</span>)}</div></>}{j ? <><DocumentTable rows={j.rows} onOpen={onDocument}/>{j.total > j.size && <p className="tiny muted mt-3">Последние {j.size} документов из {j.total}. Полный список — в журнале с фильтром по {kind === 'objects' ? 'объекту' : 'получателю'}.</p>}</> : <Loading />}</SheetContent></Sheet>; }
