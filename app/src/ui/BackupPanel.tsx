import { useEffect, useRef, useState } from 'react';
import { useDemo } from '../state/DemoProvider.tsx';
import { createSeedState } from '../demo/seed.ts';
import { loadDemoState, STORAGE_KEY } from '../state/storage.ts';
import { createBackup, MAX_BACKUP_BYTES, MAX_BACKUPS, parseBackup, readBackups, restartBackupHistory } from '../state/backups.ts';
import type { DemoBackup } from '../state/backups.ts';
import { Button, Card, ConfirmDialog, Field } from './components.tsx';

const date = (value: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Kamchatka', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
export function BackupPanel({ onRestored }: { onRestored(): void }) {
  const demo = useDemo();
  const [copies, setCopies] = useState<DemoBackup[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selected, setSelected] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState<{ copy: DemoBackup; expectedRaw: string | null } | null>(null);
  const [repair, setRepair] = useState(false);
  const attempt = useRef(0);
  const reload = () => {
    const result = readBackups(demo.backupStorage);
    setHistoryError(result.ok ? null : result.message); setCopies(result.ok ? result.value : []);
    setSelected(previous => result.ok && Number(previous) < result.value.length ? previous : '0');
  };
  useEffect(() => {
    reload();
    const changed = (event: StorageEvent) => { if (event.key === null || event.key.startsWith('supply-demo:')) reload(); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [demo.state?.revision]);
  useEffect(() => () => { attempt.current++; }, []);
  const prepare = (copy: DemoBackup) => {
    try { setPending({ copy, expectedRaw: demo.backupStorage.getItem(STORAGE_KEY) }); setError(null); setMessage(null); }
    catch { setError('Не удалось прочитать текущее состояние. Восстановление не начато'); }
  };
  const download = () => {
    setError(null); setMessage(null);
    const state = loadDemoState(demo.backupStorage, createSeedState);
    if (!state.ok) { setError(state.message); return; }
    const copy = createBackup(state.value);
    if (!copy.ok) { setError(copy.message); return; }
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(copy.value)], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url;
      link.download = 'otdel-snabzheniya-' + copy.value.created_at.replace(/[:.]/g, '-') + '.json';
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('JSON подготовлен для скачивания. Сохраните файл вне браузера и проверьте папку загрузок');
    } catch { setError('Не удалось подготовить скачивание. Повторите попытку; данные не изменены'); }
  };
  const fileSelected = async (file: File | undefined) => {
    const current = ++attempt.current; setError(null); setMessage(null); setPending(null);
    if (!file) { setReading(false); return; }
    if (file.size > MAX_BACKUP_BYTES) { setReading(false); setError('Файл больше 2 МБ. Выберите меньшую резервную копию'); return; }
    setReading(true);
    try {
      const result = parseBackup(await file.text());
      if (current !== attempt.current) return;
      if (!result.ok) setError(result.message); else prepare(result.value);
    } catch { if (current === attempt.current) setError('Файл не удалось прочитать. Попробуйте выбрать его ещё раз'); }
    finally { if (current === attempt.current) setReading(false); }
  };
  const restore = () => {
    if (!pending) return;
    const result = demo.restore(pending.copy, pending.expectedRaw);
    setPending(null);
    if (!result.ok) { setError(result.message); reload(); return; }
    onRestored(); reload(); setError(null); setMessage('Резервная копия восстановлена. Заявки, документы и остатки загружены; повторных проводок нет');
  };
  return <Card className="backup-panel">
    <h2>Резервные копии</h2>
    <p className="muted">Перед сохранением изменений создаётся автокопия. Храним до {MAX_BACKUPS} последних копий в этом браузере, в пределах 2 МБ.</p>
    <p className="hint">Очистка браузера удаляет и эту историю. Скачанный JSON храните отдельно: он возвращает ваши учебные изменения, а не исходный пример.</p>
    <div className="actions"><Button variant="secondary" onClick={download}>Скачать резервную копию JSON</Button><Button variant="ghost" onClick={reload}>Обновить список копий</Button></div>
    <Field label="Загрузить резервную копию JSON" htmlFor="backup-file" hint="Файл до 2 МБ. Сначала проверка и подтверждение; замены при выборе файла нет.">
      <input id="backup-file" type="file" accept=".json,application/json" disabled={reading} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void fileSelected(file); }}/>
    </Field>
    {reading && <p role="status">Проверяем резервную копию…</p>}
    {error && <p className="field-error-text" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {historyError ? <div><p className="field-error-text" role="alert">{historyError}</p><Button variant="secondary" onClick={() => setRepair(true)}>Начать новую историю копий</Button></div>
      : copies.length ? <><Field label="Автокопия перед изменением" htmlFor="backup-snapshot"><select id="backup-snapshot" value={selected} onChange={event => setSelected(event.target.value)}>{copies.map((copy, index) => <option key={index} value={index}>{date(copy.created_at)} · ревизия {copy.state.revision} · заявок {copy.state.data.requests.length}, документов {copy.state.data.documents.length}</option>)}</select></Field><Button variant="secondary" disabled={reading || !copies[Number(selected)]} onClick={() => { const copy = copies[Number(selected)]; if (copy) prepare(copy); }}>Восстановить выбранную автокопию</Button></>
      : <p className="hint">Автокопий пока нет. Они появятся перед следующим сохранением уже записанной демонстрации.</p>}
    {pending && <ConfirmDialog title="Восстановить резервную копию?" confirmLabel="Восстановить копию" onCancel={() => setPending(null)} onConfirm={restore}>
      <p>Копия от {date(pending.copy.created_at)}: заявок {pending.copy.state.data.requests.length}, документов {pending.copy.state.data.documents.length}. Текущее состояние и несохранённый ввод будут заменены.</p>
      <p>Корректное текущее состояние сначала сохранится в автокопиях. Получатель и выбранный участник вернутся из файла; это учебные роли.</p>
    </ConfirmDialog>}
    {repair && <ConfirmDialog title="Начать новую историю копий?" confirmLabel="Заменить повреждённую историю" onCancel={() => setRepair(false)} onConfirm={() => { const result = restartBackupHistory(demo.backupStorage); setRepair(false); if (!result.ok) setError(result.message); else { setError(null); reload(); } }}>
      <p>Повреждённая история автокопий будет заменена пустой. Сам набор демонстрации останется без изменений. Перед этим скачайте текущий набор в JSON.</p>
    </ConfirmDialog>}
  </Card>;
}
