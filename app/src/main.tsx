import { createRoot } from 'react-dom/client';
import { DemoProvider } from './state/DemoProvider.tsx';
import { RequestDraftProvider } from './state/RequestDraft.tsx';
import { IssueDraftProvider } from './state/IssueDraft.tsx';
import { ErrorBoundary } from './ui/ErrorBoundary.tsx';
import { App } from './App.tsx';
import './styles/global.css';
const root = document.getElementById('root')!;
if (root.dataset.cancelled !== 'true') {
  root.dataset.ready = 'true'; document.dispatchEvent(new Event('demo:ready'));
  createRoot(root).render(<ErrorBoundary><DemoProvider><RequestDraftProvider><IssueDraftProvider><App/></IssueDraftProvider></RequestDraftProvider></DemoProvider></ErrorBoundary>);
}
