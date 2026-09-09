import { requireChatGPTUser } from './chatgpt-auth';
import App from '@/components/cms/app';
export const dynamic = 'force-dynamic';
export default async function Page() { await requireChatGPTUser('/'); return <App />; }
