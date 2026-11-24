import {useEffect,useState} from 'react';
import {useDemo} from './state/DemoProvider.tsx';
import {navigate,useRoute} from './app/router.tsx';
import type {Route} from './app/router.tsx';
import {decodeId,getUnsavedWork,installNavigationGuard,safeInternalPath} from './app/navigation.ts';
import {log} from './shared/logger.ts';
import {AppShell} from './ui/AppShell.tsx';
import {Button,ConfirmDialog,StateMessage} from './ui/components.tsx';
import {StartPage} from './pages/StartPage.tsx';
import {IssuePage} from './pages/IssuePage.tsx';
import {DocumentPage} from './pages/DocumentPage.tsx';
import {WarehouseQueuePage} from './pages/WarehouseQueuePage.tsx';
import {RequestCreatePage} from './pages/RequestCreatePage.tsx';
import {MyRequestsPage} from './pages/MyRequestsPage.tsx';
import {RequestPage} from './pages/RequestPage.tsx';
import {CatalogPage} from './pages/CatalogPage.tsx';
import {ReturnPage} from './pages/ReturnPage.tsx';
import {VehiclePage} from './pages/VehiclePage.tsx';
import {NotFoundPage} from './pages/NotFoundPage.tsx';
import {AccessDeniedPage} from './pages/AccessDeniedPage.tsx';
import {useRequestDraft} from './state/RequestDraft.tsx';
import {useIssueDraft} from './state/IssueDraft.tsx';
import type {DatasetId} from './demo/control-cases.ts';
import {CONTROL_CASES,DATASETS} from './demo/control-cases.ts';
function CurrentScreen({route}:{route:Route}){
 const demo=useDemo();const id=decodeId(route.path.split('/')[2]??'');
 if(!demo.state?.selected_user_id)return <AccessDeniedPage/>;
 if(route.path==='/warehouse/requests')return <WarehouseQueuePage/>;
 if(/^\/requests\/[^/]+\/issue$/.test(route.path))return <IssuePage key={route.path} requestId={id}/>;
 if(/^\/documents\/[^/]+$/.test(route.path))return <DocumentPage key={route.path} documentId={id} back={route.query.get('back')?safeInternalPath(route.query.get('back')):null}/>;
 if(route.path==='/requests/new')return <RequestCreatePage itemId={route.query.get('item')}/>;
 if(route.path==='/requests')return <MyRequestsPage tab={route.query.get('tab')}/>;
 if(/^\/requests\/[^/]+$/.test(route.path))return <RequestPage key={route.path} requestId={id}/>;
 if(route.path==='/catalog')return <CatalogPage selectMode={route.query.get('select')==='request'} back={safeInternalPath(route.query.get('back'),route.query.get('select')==='request'?'/requests/new':demo.state.data.users.find(u=>u.id===demo.state?.selected_user_id)?.role==='WAREHOUSE'?'/warehouse/requests':'/requests')}/>;
 if(/^\/documents\/[^/]+\/return$/.test(route.path))return <ReturnPage key={route.path} issueId={id}/>;
 if(route.path==='/vehicles'||/^\/vehicles\/[^/]+$/.test(route.path))return <VehiclePage key={route.path+route.query.get('period')} vehicleId={id||null} period={route.query.get('period')} articleId={route.query.get('article')}/>;
 return <NotFoundPage/>;
}
export function App(){
 const demo=useDemo();const route=useRoute();const [draft,setDraft]=useState('');const requestDraft=useRequestDraft();const issueDraft=useIssueDraft();
 const [confirmation,setConfirmation]=useState<string|null>(null);const [dataset,setDataset]=useState<DatasetId>('baseline-november-2026');const [testCase,setTestCase]=useState<string>(demo.mode);
 const [pendingNavigation,setPendingNavigation]=useState<null|(()=>void)>(null);
 useEffect(()=>installNavigationGuard((to,proceed)=>{const work=getUnsavedWork(to);if(work.length)setPendingNavigation(()=>()=>{work.forEach(w=>w.discard());proceed();});else proceed();}),[]);
 useEffect(()=>{log('INFO','PAGE_OPENED');document.title='Отдел снабжения';},[route.path]);
 const chooseUser=(id:string)=>{if(draft||requestDraft.dirty||getUnsavedWork('role-change').length)setConfirmation('user:'+id);else demo.selectUser(id);};
 const confirm=()=>{
  let changed=false;
  if(confirmation==='reset')changed=demo.reset();
  else if(confirmation?.startsWith('user:'))changed=demo.selectUser(confirmation.slice(5));
  else if(confirmation==='dataset')changed=demo.loadDataset(dataset);
  else if(confirmation==='case'){getUnsavedWork('reload').forEach(w=>w.discard());window.location.assign(window.location.pathname+(testCase==='normal'?'':'?case='+encodeURIComponent(testCase))+'#/');}
  if(changed){setDraft('');requestDraft.clear();issueDraft.clear();getUnsavedWork('role-change').forEach(w=>w.discard());}
  setConfirmation(null);
 };
 const ready=demo.status==='ready';
 return <AppShell goStart={()=>navigate('/')}>
  {demo.mode!=='normal'&&<div className="control-banner">Контрольный пример: {CONTROL_CASES.find(i=>i.id===demo.mode)?.label}. <a href={window.location.pathname+'#/'}>Обычная демонстрация</a></div>}
  {demo.error&&<StateMessage title={ready?'Действие не выполнено':'Не удалось загрузить демонстрацию'} kind="error" actions={<><Button variant="secondary" onClick={demo.retry}>Повторить загрузку</Button>{!ready&&<Button onClick={()=>setConfirmation('reset')}>Восстановить исходный набор</Button>}</>}><p>{demo.error}</p></StateMessage>}
  {demo.status==='loading'&&<StateMessage title="Загружаем демонстрационные данные"><p>{demo.slow?'Загрузка длится больше 10 секунд. Можно повторить или отменить ожидание.':'Проверяем сохранённое состояние этого браузера…'}</p>{demo.slow&&<div className="actions"><Button onClick={demo.retry}>Повторить</Button><Button variant="secondary" onClick={demo.cancelLoad}>Отменить ожидание</Button></div>}</StateMessage>}
  {demo.status==='cancelled'&&<StateMessage title="Ожидание отменено" actions={<Button onClick={demo.retry}>Повторить загрузку</Button>}><p>Поздний ответ отменённой попытки не изменит данные.</p></StateMessage>}
  {ready&&(route.path==='/'?<StartPage chooseUser={chooseUser} reset={()=>setConfirmation('reset')} draft={draft} setDraft={setDraft}/>:<CurrentScreen route={route}/>)}
  {ready&&route.path==='/'&&<details className="control-panel"><summary>Учебные примеры</summary><label htmlFor="dataset">Подготовленный набор</label><select id="dataset" value={dataset} onChange={e=>setDataset(e.target.value as DatasetId)}>{DATASETS.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select><Button variant="secondary" onClick={()=>setConfirmation('dataset')}>Загрузить учебный пример</Button></details>}
  {import.meta.env.DEV&&<details className="control-panel"><summary>Примеры ошибок и загрузки</summary><label htmlFor="test-case">Контрольный пример</label><select id="test-case" value={testCase} onChange={e=>setTestCase(e.target.value)}>{CONTROL_CASES.map(i=><option value={i.id} key={i.id}>{i.label}</option>)}</select><Button variant="secondary" onClick={()=>setConfirmation('case')}>Открыть контрольный пример</Button></details>}
  {pendingNavigation&&<ConfirmDialog title="Уйти с незавершённой формы?" confirmLabel="Отменить ввод" cancelLabel="Остаться" onCancel={()=>setPendingNavigation(null)} onConfirm={()=>{const proceed=pendingNavigation;setPendingNavigation(null);proceed();}}><p>Несохранённый ввод будет отменён. Уже сохранённые операции не изменятся.</p></ConfirmDialog>}
  {confirmation&&<ConfirmDialog title={confirmation==='reset'?'Начать демонстрацию заново?':confirmation==='dataset'?'Загрузить учебный пример?':confirmation==='case'?'Открыть контрольный пример?':'Сменить участника?'} confirmLabel={confirmation==='reset'?'Восстановить исходный набор':confirmation==='dataset'?'Заменить демоданные':confirmation==='case'?'Открыть пример':'Отменить ввод и переключить'} cancelLabel={confirmation.startsWith('user:')?'Остаться':'Отмена'} onCancel={()=>setConfirmation(null)} onConfirm={confirm}><p>{confirmation==='dataset'?'Текущие учебные изменения будут заменены выбранным набором. Выбор участника сбросится.':confirmation==='reset'?'Учебные изменения заменятся исходным набором. Это действие нельзя отменить.':confirmation==='case'?'Страница перезагрузится. Сохранённые данные не удаляются.':'Несохранённый ввод будет отменён. Уже сохранённые операции останутся.'}</p></ConfirmDialog>}
 </AppShell>;
}
