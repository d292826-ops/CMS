'use client';
import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ArrowUpRight, Package, Fuel, Flame, Wallet, Truck, Building2, Users, ArrowRight, ChevronDown } from 'lucide-react';
import { money, groupNames, budgetState, qtyFormat, articleNames, objectTypes } from '@/lib/domain';
import { Button, Choice, BudgetBar, T, Empty } from './ui';
export function Panel({ title, sub, action, children, className = '' }: {
    title: string;
    sub?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) { return <section className={`panel ${className}`}><div className="panel-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{action}</div>{children}</section>; }
export function Stats({ data }: {
    data: any;
}) { const amount = (groups: string[]) => data.byGroup.filter((g: any) => groups.includes(g.group_name)).reduce((s: number, g: any) => s + g.total, 0); return <div className="stats">{[{ title: 'Расходы по выдаче', value: data.totals.total, icon: Wallet, sub: `${data.totals.issues} выдач · ${data.totals.returns} возвратов`, className: 'total' }, { title: 'Запчасти и материалы', value: amount(['part', 'material']), icon: Package, sub: 'За вычетом возвратов' }, { title: 'Жидкое топливо', value: amount(['fuel']), icon: Fuel, sub: 'Расход по выдаче' }, { title: 'Газ', value: amount(['gas']), icon: Flame, sub: 'Расход по выдаче' }].map(s => <div className={`stat ${s.className || ''}`} key={s.title}><div className="stat-title">{s.title}<span className="stat-icon"><s.icon size={17}/></span></div><div className="stat-value num">{money(s.value)}</div><div className="stat-sub">{s.sub}</div></div>)}</div>; }
export function Trend({ data, onDrill, period }: {
    data: any;
    onDrill: (from: string, to: string) => void;
    period: string;
}) { const map: Record<string, any> = {}; const from = new Date(data.from + 'T12:00:00Z'), to = new Date(data.to + 'T12:00:00Z'); const monthly = period === 'year'; for (let d = new Date(from), n = 0; d <= to && n < 370; n++) {
    const key = d.toISOString().slice(0, monthly ? 7 : 10);
    map[key] = { date: key, materials: 0, fuel: 0, gas: 0 };
    if (monthly)
        d.setUTCMonth(d.getUTCMonth() + 1);
    else
        d.setUTCDate(d.getUTCDate() + 1);
} for (const t of data.trend) {
    const key = t.date;
    map[key] ??= { date: key, materials: 0, fuel: 0, gas: 0 };
    map[key][t.group_name === 'part' || t.group_name === 'material' ? 'materials' : t.group_name] += t.total / 100;
} const rows = Object.values(map).sort((a, b) => a.date.localeCompare(b.date)); return <Panel title="Динамика расходов" sub="Стоимость выдач за вычетом возвратов"><div className="legend"><span style={{ '--dot': '#4d7dea' } as React.CSSProperties}>Материалы</span><span style={{ '--dot': '#5cbbbc' } as React.CSSProperties}>Топливо</span><span style={{ '--dot': '#e5b163' } as React.CSSProperties}>Газ</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={rows} margin={{ top: 10, right: 18, left: 0, bottom: 6 }} onClick={(e: any) => { if (e?.activeLabel) {
    const d = String(e.activeLabel);
    onDrill(d.length === 7 ? d + '-01' : d, d.length === 7 ? new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0).toLocaleDateString('sv-SE') : d);
} }}><defs><linearGradient id="blueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6b96f2" stopOpacity={.22}/><stop offset="95%" stopColor="#6b96f2" stopOpacity={.01}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f6" strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={v => monthly ? new Date(v + '-01').toLocaleDateString('ru-RU', { month: 'short' }) : v.slice(8)} tick={{ fontSize: 12, fill: '#8491a4' }} axisLine={false} tickLine={false} minTickGap={25}/><YAxis tickFormatter={v => `${v / 1000} тыс.`} tick={{ fontSize: 11, fill: '#8491a4' }} axisLine={false} tickLine={false} width={60}/><Tooltip formatter={(v: any, n: any) => [money(Number(v) * 100), articleNames[n]]} labelFormatter={v => String(v)} contentStyle={{ borderRadius: 10, border: '1px solid #e1e7ef', fontSize: 13 }}/><ReferenceLine y={0} stroke="#dce3ee"/><Area type="monotone" dataKey="materials" stroke="#4d7dea" fill="url(#blueFill)" strokeWidth={2}/><Area type="monotone" dataKey="fuel" stroke="#5cbbbc" fill="#5cbbbc" fillOpacity={.035} strokeWidth={2}/><Area type="monotone" dataKey="gas" stroke="#e5b163" fill="#e5b163" fillOpacity={.03} strokeWidth={2}/></AreaChart></ResponsiveContainer></div></Panel>; }
export function BudgetOverview({ data, onOpen, onObject }: {
    data: any;
    onOpen: () => void;
    onObject: (id: string) => void;
}) { if (!data)
    return null; if (data.hidden)
    return <Panel title="Исполнение бюджета"><div className="panel-body muted text-sm">{data.reason}</div></Panel>; const rows = data.rows || [], plan = rows.reduce((s: number, r: any) => s + r.plan, 0), fact = rows.reduce((s: number, r: any) => s + r.fact, 0), complete = rows.length > 0 && rows.every((r: any) => r.complete), filled = rows.reduce((s: number, r: any) => s + r.filled, 0), expected = rows.reduce((s: number, r: any) => s + r.expected, 0); return <Panel title="Контроль бюджета" sub={data.label} action={<button className="link" onClick={onOpen}>Все бюджеты <ArrowUpRight size={15}/></button>}><div className="panel-body"><div className="budget-summary"><div><small>{complete ? 'План' : 'Задано частично'}</small><b className="num">{money(plan)}</b></div><div><small>Факт</small><b className="num">{money(fact)}</b></div><div><small>Остаток</small><b className="num" style={{ color: complete && plan - fact < 0 ? '#bd5353' : '#418a70' }}>{complete ? money(plan - fact) : '—'}</b></div></div>{!complete && <p className="tiny muted">Бюджет задан частично · {filled} из {expected} статей / месяцев</p>}{rows.slice(0, 3).map((r: any) => { const s = budgetState(r.plan, r.fact, r.complete); return <div className="budget-row" key={r.id}><button onClick={() => onObject(r.id)}>{r.name}</button><span className={`status ${s.className}`}>{s.percent === null ? s.label : `${s.percent.toFixed(0)}% · ${s.label}`}</span><div className="track"><BudgetBar percent={s.percent ?? 0} color={s.className}/></div></div>; })}{rows.length === 0 && <Empty text="Бюджеты ещё не заданы" description="Добавьте объект и установите месячные лимиты."/>}</div></Panel>; }
export function Rankings({ data, kind, onOpen }: {
    data: any;
    kind: 'objects' | 'people';
    onOpen: (id: string) => void;
}) { const [top, setTop] = useState('10'); const rows = kind === 'objects' ? data.byObject : data.byPerson; const max = Math.max(1, ...rows.map((r: any) => Math.abs(r.total))); const shares = data.totals.total > 0 && data.byObject.every((r: any) => r.total >= 0); return <Panel title={kind === 'objects' ? 'Топ подразделений' : 'Топ получателей'} sub={kind === 'objects' ? 'По стоимости выданных ресурсов' : 'По стоимости полученного'} action={<Choice label="Размер рейтинга" value={top} onChange={setTop} options={[{ value: '5', label: 'Топ-5' }, { value: '10', label: 'Топ-10' }, { value: 'all', label: 'Все' }]}/>}><div className="panel-body">{!rows.length ? <Empty /> : rows.slice(0, top === 'all' ? undefined : Number(top)).map((r: any, i: number) => <button className="rank-row w-full text-left" key={r.id} onClick={() => onOpen(r.id)}><span className="tiny muted">{String(i + 1).padStart(2, '0')}</span><span className="rank-icon">{kind === 'people' ? <Users size={18}/> : r.type === 'vehicle' ? <Truck size={19}/> : <Building2 size={18}/>}</span><div><div className="rank-name">{r.name}</div><div className="rank-meta">{kind === 'people' ? `${r.issues} выдач · ${r.objects}` : r.plate || objectTypes[r.type]}</div><div className="rank-bar"><i style={{ width: `${Math.abs(r.total) / max * 100}%`, background: r.total < 0 ? '#dc8178' : undefined }}/></div></div><div className="rank-value num">{money(r.total)}<small>{shares ? `${(r.total / data.totals.total * 100).toFixed(1)}%` : '—'}</small></div></button>)}</div></Panel>; }
export function DocumentTable({ rows, onOpen }: {
    rows: any[];
    onOpen: (id: string) => void;
}) { return rows.length ? <div className="table-wrap"><T.Table className="data-table"><T.TableHeader><T.TableRow><T.TableHead>Документ / дата</T.TableHead><T.TableHead>Получатель</T.TableHead><T.TableHead>Подразделение</T.TableHead><T.TableHead>Ресурсы</T.TableHead><T.TableHead className="text-right">Сумма</T.TableHead><T.TableHead>Статус</T.TableHead></T.TableRow></T.TableHeader><T.TableBody>{rows.map(d => <T.TableRow key={d.id} className="row-link" onClick={() => onOpen(d.id)}><T.TableCell><button className="doc-number" onClick={() => onOpen(d.id)}>{d.number} {d.kind === 'return' && '↩'}</button><div className="doc-date">{d.operation_at.slice(0, 10).split('-').reverse().join('.')} · {d.operation_at.slice(11, 16)}</div></T.TableCell><T.TableCell>{d.recipient_name}<div className="doc-date">Автор: {d.author_name}</div></T.TableCell><T.TableCell>{d.object_name}</T.TableCell><T.TableCell><span className="text-[13px] muted">{(d.groups || '').split(',').map((g: string) => groupNames[g]).filter(Boolean).join(', ')}</span></T.TableCell><T.TableCell className="amount num" style={{ color: d.kind === 'return' ? '#428b70' : undefined }}>{money(d.filtered_total ?? d.total * (d.kind === 'return' ? -1 : 1), 2)}</T.TableCell><T.TableCell><span className={`status ${d.status === 'posted' ? '' : d.status === 'cancelled' ? 'bad' : 'neutral'}`}>{d.status === 'posted' ? 'Проведён' : d.status === 'cancelled' ? 'Отменён' : 'Черновик'}</span></T.TableCell></T.TableRow>)}</T.TableBody></T.Table></div> : <Empty />; }
export function FuelTable({ data, onOpen }: {
    data: any[];
    onOpen: (o: string, r: string) => void;
}) { return data?.length ? <div className="table-wrap"><T.Table className="data-table"><T.TableHeader><T.TableRow>{['Объект', 'Топливо / газ', 'Выдано', 'Возвраты', 'Чистый объём', 'Стоимость'].map(n => <T.TableHead key={n}>{n}</T.TableHead>)}</T.TableRow></T.TableHeader><T.TableBody>{data.map((r: any) => <T.TableRow key={r.object_id + r.resource_id} className="row-link" onClick={() => onOpen(r.object_id, r.resource_id)}><T.TableCell>{r.object_name}</T.TableCell><T.TableCell>{r.name}</T.TableCell><T.TableCell className="num">{qtyFormat(r.issued)} {r.unit}</T.TableCell><T.TableCell className="num">{qtyFormat(r.returned)} {r.unit}</T.TableCell><T.TableCell className="num">{qtyFormat(r.issued - r.returned)} {r.unit}</T.TableCell><T.TableCell className="amount">{money(r.total, 2)}</T.TableCell></T.TableRow>)}</T.TableBody></T.Table></div> : <Empty />; }
