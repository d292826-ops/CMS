import type { ReactNode } from 'react';
import { useDemo } from '../state/DemoProvider.tsx';
import { ROLE_NAMES, selectedUser, canSeeFinance } from './projections.ts';
import { navigate, parseRoute } from '../app/router.tsx';
import { Icon } from './icons.tsx';
export function AppShell({ children, goStart }: { children: ReactNode; goStart(): void }) {
  const route=parseRoute(window.location.hash);
  const { state } = useDemo(); const user = state ? selectedUser(state) : null;
  const section = route.path === '/' ? 'start' : route.path === '/catalog' ? 'catalog'
    : /^(\/warehouse|\/requests|\/documents)(\/|$)/.test(route.path) && user?.role === 'WAREHOUSE' ? 'warehouse'
    : /^(\/vehicles|\/documents|\/requests)(\/|$)/.test(route.path) && canSeeFinance(user) ? 'finance'
    : route.path === '/requests/new' ? 'new'
    : /^(\/requests|\/documents)(\/|$)/.test(route.path) ? 'requests' : null;
  const navProps = (name: string) => ({className: 'nav-item' + (section === name ? ' active' : ''), 'aria-current': section === name ? 'page' as const : undefined});
  return <div className="app-shell"><header className="topbar"><button className="brand" onClick={goStart}><span className="brand-icon"><Icon name="package" /></span><span>Отдел снабжения<small>Автопарк и спецтехника</small></span></button><div className="header-right"><span className="demo-label">Демонстрационные данные</span><ButtonSwitch/><div className="active-user">{user ? <><strong>{user.display_name}</strong><span>{ROLE_NAMES[user.role]} · {user.id}</span></> : <span>Участник не выбран</span>}</div></div></header><div className="workspace"><aside className="sidebar"><p className="sidebar-label">Рабочее пространство</p><button {...navProps('start')} onClick={goStart}><Icon name="clipboard" /> Начало демонстрации</button>{user?.role==='WAREHOUSE'&&<button {...navProps('warehouse')} onClick={()=>navigate('/warehouse/requests')}><Icon name="package"/>Очередь склада</button>}{user && ['MECHANIC','DRIVER'].includes(user.role) && <><button {...navProps('requests')} onClick={()=>navigate('/requests')}><Icon name="clipboard"/>Мои заявки</button><button {...navProps('new')} onClick={()=>navigate('/requests/new')}><Icon name="clipboard"/>Создать заявку</button></>}{user && !canSeeFinance(user) && <button {...navProps('catalog')} onClick={() => navigate('/catalog')}><Icon name="package"/>Номенклатура</button>}{canSeeFinance(user) && <button {...navProps('finance')} onClick={() => navigate('/vehicles/A?period=2026-11')}><Icon name="truck"/>Финансовый разбор</button>}<div className="sidebar-note"><Icon name="shield" /><p>Учебный сайт<br/><span>Все сведения вымышленные</span></p></div></aside><main id="main-content" className="main-content">{children}</main></div><footer className="footer">Отдел снабжения · Учебный проект<span>Данные сохраняются в этом браузере</span></footer></div>;
}

function ButtonSwitch(){return <button className="button button-ghost" onClick={()=>navigate('/')}>Выбрать участника</button>;}
