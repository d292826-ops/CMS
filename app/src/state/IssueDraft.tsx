import {createContext, useContext, useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {registerUnsavedWork} from '../app/navigation.ts';
import {useDemo} from './DemoProvider.tsx';

interface IssueDraft {requestId: string; actorId: string; recipientId: string}
interface IssueDraftContext {
  recipientFor(requestId: string): string | undefined;
  setRecipient(requestId: string, recipientId: string): void;
  clear(): void;
}
const Context = createContext<IssueDraftContext | null>(null);

// The catalogue detour must not detach the draft's navigation guard.
export function IssueDraftProvider({children}: {children: ReactNode}) {
  const {state} = useDemo();
  const [draft, setDraft] = useState<IssueDraft | null>(null);
  const release = useRef<null | (() => void)>(null);
  const clear = () => {release.current?.(); release.current = null; setDraft(null);};
  const actorId = state?.selected_user_id;
  const active = draft?.actorId === actorId ? draft : null;
  const savedRecipient = active && state?.data.documents.find(
    doc => doc.kind === 'ISSUE' && doc.request_id === active.requestId,
  )?.recipient_user_id;

  useEffect(() => {
    if (active && active.recipientId !== (savedRecipient ?? '')) {
      const path = '/requests/' + active.requestId + '/issue';
      release.current = registerUnsavedWork({
        allows: to => to === path || to === '/catalog?back=' + encodeURIComponent(path),
        discard: clear,
      });
    }
    return () => {release.current?.(); release.current = null;};
  }, [active, savedRecipient]);
  useEffect(() => {if (draft && draft.actorId !== actorId) clear();}, [actorId]);

  return <Context.Provider value={{
    recipientFor: requestId => active?.requestId === requestId ? active.recipientId : undefined,
    setRecipient: (requestId, recipientId) => {if (actorId) setDraft({requestId, recipientId, actorId});},
    clear,
  }}>{children}</Context.Provider>;
}
export function useIssueDraft() {
  const context = useContext(Context);
  if (!context) throw Error('ISSUE_DRAFT_PROVIDER_MISSING');
  return context;
}
