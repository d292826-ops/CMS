export type IconName = 'package' | 'truck' | 'clipboard' | 'search' | 'check' | 'printer' | 'refresh' | 'shield';
const paths: Record<IconName, React.ReactNode> = {
  package: <><path d="m7.5 4.27 9 5.15M21 8l-9 5-9-5m9 5v9"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></>,
  truck: <><path d="M1 3h14v13H1zM15 8h4l3 4v4h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
  clipboard: <><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h6"/></>,
  search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
  check: <><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></>,
  printer: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15.5-6.4L21 8M21 3v5h-5M21 12A9 9 0 0 1 5.5 18.4L3 16M3 21v-5h5"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
};
export function Icon({ name }: { name: IconName }) { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>; }
