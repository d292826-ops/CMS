import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ЦМС — учёт выдачи ресурсов', description: 'Материалы, топливо и газ. Выдача, расходы подразделений и контроль бюджета.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="ru"><body>{children}</body></html>; }
