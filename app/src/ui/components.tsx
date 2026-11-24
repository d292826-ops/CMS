import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {useDemo} from '../state/DemoProvider.tsx';
import {useRequestDraft} from '../state/RequestDraft.tsx';
import {useIssueDraft} from '../state/IssueDraft.tsx';
import {getUnsavedWork} from '../app/navigation.ts';
export interface CommandErrorDetails {code: string; message: string}
export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) { return <button {...props} className={`button button-${variant} ${className}`} />; }
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }
export function StateMessage({ title, children, kind = 'info', actions }: { title: string; children?: ReactNode; kind?: 'info' | 'error' | 'success'; actions?: ReactNode }) { return <section className={`state-message state-${kind}`} role={kind === 'error' ? 'alert' : 'status'}><h2>{title}</h2>{children && <div>{children}</div>}{actions && <div className="actions">{actions}</div>}</section>; }
export function Field({ label, htmlFor, error, children, hint }: { label: string; htmlFor: string; error?: string | null; children: ReactNode; hint?: string }) { return <div className={`field ${error ? 'field-error' : ''}`}><label htmlFor={htmlFor}>{label}</label>{children}{error && <p id={`${htmlFor}-error`} className="field-error-text">{error}</p>}{hint && <p className="hint">{hint}</p>}</div>; }
export function CommandErrorMessage({title, error, onClear, dismissible = false, children}: {
  title: string; error: CommandErrorDetails; onClear(): void; dismissible?: boolean; children?: ReactNode;
}) {
  const demo = useDemo();const requestDraft=useRequestDraft();const issueDraft=useIssueDraft();const [participantChanged,setParticipantChanged]=useState(false);
  const refresh=()=>{const result=demo.refresh();if(result.ok)onClear();else if(result.code==='PARTICIPANT_CHANGED')setParticipantChanged(true);};
  const confirmRefresh=()=>{const result=demo.refresh(true);setParticipantChanged(false);if(result.ok){getUnsavedWork('role-change').forEach(work=>work.discard());requestDraft.clear();issueDraft.clear();onClear();}};
  return <><StateMessage title={title} kind="error" actions={<>
    {error.code === 'REVISION_CONFLICT' && <Button onClick={refresh}>Обновить данные</Button>}
    {dismissible && <Button variant="ghost" onClick={onClear}>Закрыть сообщение</Button>}
  </>}><p>{error.message}</p>{children}</StateMessage>{participantChanged&&<ConfirmDialog title="В другой вкладке сменился участник" confirmLabel="Отменить ввод и обновить" cancelLabel="Остаться" onCancel={()=>setParticipantChanged(false)} onConfirm={confirmRefresh}><p>Будет выбран участник из сохранённого набора. Несохранённый ввод и подсказки будут очищены; чужой черновик не будет отправлен от его имени. Сохранённые документы не изменятся.</p></ConfirmDialog>}</>;
}
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Отмена', onConfirm, onCancel }: { title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; onConfirm(): void; onCancel(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => { ref.current?.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-title" onCancel={event => { event.preventDefault(); onCancel(); }}><h2 id="confirm-title">{title}</h2><div className="dialog-copy">{children}</div><div className="actions"><Button variant="secondary" autoFocus onClick={onCancel}>{cancelLabel}</Button><Button onClick={onConfirm}>{confirmLabel}</Button></div></dialog>;
}
