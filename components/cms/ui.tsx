'use client';
import React from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Empty as EmptyPrimitive, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
export const T = { Table, TableHeader, TableRow, TableHead, TableBody, TableCell };
export function Choice({ value, onChange, options, label, disabled = false }: {
    value: string;
    onChange: (v: string) => void;
    options: {
        value: string;
        label: string;
    }[];
    label?: string;
    disabled?: boolean;
}) { return <Select value={value || undefined} onValueChange={onChange} disabled={disabled}><SelectTrigger className="w-full h-10 bg-white text-foreground" aria-label={label}><SelectValue placeholder={label || 'Выберите'}/></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>; }
export function Picker({ items, value, onChange, label, disabled = false }: {
    items: any[];
    value: string;
    onChange: (v: string) => void;
    label: string;
    disabled?: boolean;
}) { const values = items.map(o => ({ id: o.id, label: [o.name, o.plate || o.code].filter(Boolean).join(' · ') })); const selected = values.find(o => o.id === value) || null; return <Combobox items={values} value={selected} onValueChange={(v: any) => onChange(v?.id || '')} itemToStringLabel={(o: any) => o.label} isItemEqualToValue={(a: any, b: any) => a.id === b.id} disabled={disabled}><ComboboxInput placeholder={label} aria-label={label} className="w-full h-10 bg-white"/><ComboboxContent><ComboboxEmpty>Не найдено</ComboboxEmpty><ComboboxList>{(o: any) => <ComboboxItem key={o.id} value={o}>{o.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>; }
export function Field({ label, children }: {
    label: string;
    children: React.ReactNode;
}) { return <div className="field"><label>{label}</label>{children}</div>; }
export function Input({ label, value, onChange, type = 'text', ...props }: {
    label: string;
    value: any;
    onChange: (v: string) => void;
    type?: string;
    [key: string]: any;
}) { return <Field label={label}><input aria-label={label} className="input" type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} {...props}/></Field>; }
export function Button({ children, onClick, primary = false, disabled = false, className = '', ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    primary?: boolean;
    disabled?: boolean;
    className?: string;
    [key: string]: any;
}) { return <button type="button" className={`btn ${primary ? 'primary' : ''} ${className}`} onClick={onClick} disabled={disabled} {...props}>{children}</button>; }
export function Modal({ open, onClose, title, description, children, wide = false }: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    wide?: boolean;
}) { return <Dialog open={open} onOpenChange={v => { if (!v)
    onClose(); }}><DialogContent className={wide ? 'sm:max-w-4xl' : 'sm:max-w-xl'}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description || ' '}</DialogDescription></DialogHeader><div className="modal-body">{children}</div></DialogContent></Dialog>; }
export function Confirmation({ open, title, description, onConfirm, onCancel }: {
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel: () => void;
}) { return <AlertDialog open={open} onOpenChange={v => { if (!v)
    onCancel(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={onCancel}>Вернуться</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Подтвердить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>; }
export function Empty({ text = 'Нет операций за выбранный период', description = 'Измените период или добавьте первую выдачу.' }: {
    text?: string;
    description?: string;
}) { return <EmptyPrimitive className="py-12"><EmptyTitle className="text-base">{text}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyPrimitive>; }
export function Loading() { return <div className="app-loading"><Loader2 className="spinning mx-auto mb-3" size={24}/><span className="muted text-sm">Загрузка данных…</span></div>; }
export function SearchBox({ value, onChange, placeholder = 'Поиск' }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) { return <div className="search"><Search size={16}/><input className="input" aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/></div>; }
export function BudgetBar({ percent, color = 'blue' }: {
    percent: number;
    color?: string;
}) { return <Progress value={Math.min(100, Math.max(0, percent))} aria-label={`Исполнение ${percent.toFixed(1)}%`} className={`h-1.5 bg-[#edf1f7] ${color === 'bad' ? '[&>div]:bg-[#dd7671]' : color === 'warn' ? '[&>div]:bg-[#ddb15d]' : '[&>div]:bg-[#5389e7]'}`}/>; }
export function Pager({ page, total, size, onChange }: {
    page: number;
    total: number;
    size: number;
    onChange: (n: number) => void;
}) { return <div className="pagination"><span>{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} из ${total}` : '0 записей'}</span><Button className="icon" disabled={page === 1} aria-label="Предыдущая страница" onClick={() => onChange(page - 1)}><ChevronLeft size={16}/></Button><Button className="icon" disabled={page * size >= total} aria-label="Следующая страница" onClick={() => onChange(page + 1)}><ChevronRight size={16}/></Button></div>; }
