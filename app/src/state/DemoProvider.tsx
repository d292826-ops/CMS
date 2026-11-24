import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DemoState, Result } from '../domain/types.ts';
import { failure } from '../domain/types.ts';
import { createSeedState } from '../demo/seed.ts';
import { controlStorage, readControlCase, createControlDataset } from '../demo/control-cases.ts';
import type { ControlCase, DatasetId } from '../demo/control-cases.ts';
import { loadDemoState, resetDemoState, selectDemoUser } from './storage.ts';
import type { StoragePort } from './storage.ts';
import { restoreBackup, withAutomaticBackups } from './backups.ts';
import type { DemoBackup } from './backups.ts';

interface DemoContextValue {
  state: DemoState | null; status: 'loading' | 'ready' | 'error' | 'cancelled'; error: string | null; slow: boolean;
  mode: ControlCase; retry(): void; refresh(confirmParticipantChange?:boolean): Result<DemoState>; cancelLoad(): void; selectUser(id: string): boolean; reset(): boolean; clearError(): void;
  storage: StoragePort; accept(result: Result<DemoState>): boolean;
  backupStorage: StoragePort; restore(copy: DemoBackup, expectedRaw: string | null): Result<DemoState>;
  loadDataset(id: DatasetId, keepParticipant?:boolean): boolean;
}
const DemoContext = createContext<DemoContextValue | null>(null);
const browserStorage: StoragePort = withAutomaticBackups({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) });
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [status, setStatus] = useState<DemoContextValue['status']>('loading');
  const [error, setError] = useState<string | null>(null); const [slow, setSlow] = useState(false);
  const [mode, setMode] = useState(() => readControlCase(window.location.search));
  const sequence = useRef(0); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const port = controlStorage(browserStorage, mode);
  const load = useCallback(() => {
    const attempt = ++sequence.current; setStatus('loading'); setError(null); setSlow(false);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (sequence.current === attempt) setSlow(true); }, 10000);
    const read = () => {
      if (attempt !== sequence.current) return;
      const result = loadDemoState(controlStorage(browserStorage, mode), createSeedState);
      if (timer.current !== null) clearTimeout(timer.current); setSlow(false);
      if (result.ok) { setState(result.value); setStatus('ready'); }
      else { setError(result.message); setStatus('error'); }
    };
    if (mode === 'slow-load') setTimeout(read, 15000); else queueMicrotask(read);
  }, [mode]);
  useEffect(() => { load(); return () => { sequence.current++; if (timer.current !== null) clearTimeout(timer.current); }; }, [load]);
  const accept = (result: Result<DemoState>): boolean => {
    if (!result.ok) { setError(result.message); return false; }
    setState(result.value); setError(null); setStatus('ready'); return true;
  };
  const value: DemoContextValue = {
    state, status, error, slow, mode, storage: port, accept, retry: load,
    backupStorage: browserStorage,
    restore: (copy, expectedRaw) => {
      const result = restoreBackup(browserStorage, copy, expectedRaw);
      if (!result.ok) return result;
      sequence.current++; if (timer.current !== null) clearTimeout(timer.current);
      setSlow(false); setMode('normal'); accept(result);
      window.history.replaceState(null, '', window.location.pathname + '#/');
      window.dispatchEvent(new HashChangeEvent('hashchange')); return result;
    },
    refresh: (confirmParticipantChange=false) => {
      const result=loadDemoState(port,createSeedState);
      if(!result.ok){setError(result.message);return result;}
      if(state&&result.value.selected_user_id!==state.selected_user_id&&!confirmParticipantChange){
        return failure('PARTICIPANT_CHANGED','В другой вкладке выбран другой участник. Подтвердите отмену незавершённого ввода перед обновлением');
      }
      accept(result);return result;
    },
    clearError: () => setError(null),
    cancelLoad: () => { sequence.current++; if (timer.current !== null) clearTimeout(timer.current); setSlow(false); setStatus('cancelled'); },
    selectUser: id => accept(state ? selectDemoUser(port, state, id) : failure('NO_STATE', 'Сначала загрузите демонстрационные данные')),
    reset: () => {
      const result = resetDemoState(browserStorage, createSeedState, true);
      if (!accept(result)) return false;
      sequence.current++; setMode('normal');
      window.history.replaceState(null, '', window.location.pathname + '#/');
      window.dispatchEvent(new HashChangeEvent('hashchange')); return true;
    },
    loadDataset: (id,keepParticipant=false) => {
      const result = resetDemoState(browserStorage, () => {
        const example=createControlDataset(id);
        if(keepParticipant)example.selected_user_id=state?.selected_user_id??null;
        return example;
      }, true);
      if (!accept(result)) return false;
      sequence.current++; setMode('normal');
      window.history.replaceState(null, '', window.location.pathname + '#/'); window.dispatchEvent(new HashChangeEvent('hashchange')); return true;
    },
  };
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
export function useDemo(): DemoContextValue { const context = useContext(DemoContext); if (!context) throw new Error('DEMO_PROVIDER_MISSING'); return context; }
