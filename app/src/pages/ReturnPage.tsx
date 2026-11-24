import {useState} from 'react';
import {useDemo} from '../state/DemoProvider.tsx';
import {selectedUser} from '../ui/projections.ts';
import {postFullReturn} from '../domain/returns.ts';
import {commitDemoCommand} from '../state/commands.ts';
import {currentStock} from '../domain/status.ts';
import {navigate} from '../app/router.tsx';
import {Button,Card,ConfirmDialog,StateMessage,CommandErrorMessage} from '../ui/components.tsx';
import {formatMoney,formatQuantity} from '../ui/format.ts';
import type {CommandErrorDetails} from '../ui/components.tsx';
export function ReturnPage({issueId}:{issueId:string}){
 const demo=useDemo();const [confirm,setConfirm]=useState(false);const [error,setError]=useState<CommandErrorDetails|null>(null);const [attempt]=useState(()=>crypto.randomUUID());
 if(!demo.state)return null;const state=demo.state;const user=selectedUser(state);const issue=state.data.documents.find(d=>d.id===issueId&&d.kind==='ISSUE');
 if(user?.role!=='WAREHOUSE'||!issue||issue.warehouse_id!==user.warehouse_id)return <StateMessage title="Возврат недоступен"><p>Выберите кладовщика исходного склада и проведённую выдачу.</p></StateMessage>;
 const existing=state.data.documents.find(d=>d.kind==='RETURN'&&d.return_of_document_id===issue.id);const item=state.data.items.find(i=>i.id===issue.item_id);const unit=state.data.units.find(u=>u.id===issue.unit_id);
 const post=()=>{const result=commitDemoCommand(demo.storage,state,current=>postFullReturn(current,{issueId,actorId:user.id,attemptId:attempt,occurredAt:new Date().toISOString()}),'RETURN_POSTED');setConfirm(false);if(!result.ok){setError(result);return;}demo.accept({ok:true,value:result.value.state});setError(null);};
 return <><div className="page-heading"><p className="eyebrow">Склад</p><h1>Полный возврат детали</h1><p>По выдаче {issue.number}</p></div>{error&&<CommandErrorMessage title="Возврат не сохранён" error={error} onClear={()=>setError(null)}><p>Проверьте состояние и повторите действие.</p></CommandErrorMessage>}{existing&&<StateMessage title="Возврат сохранён" kind="success"><p>Документ {existing.number}. Остаток: {formatQuantity(currentStock(state,issue.warehouse_id!,issue.item_id!))} {unit?.name}. Повторное проведение не требуется.</p></StateMessage>}<Card><h2>{item?.name} · {item?.article}</h2><p>Количество: {formatQuantity(issue.quantity)} {unit?.name}</p><p>Исходная стоимость: {formatMoney(issue.amount_minor)}</p><p>VIN: {issue.vehicle_vin_snapshot}</p><p>После подтверждения весь объём вернётся на склад. Расход уменьшится на исходную сумму по дате возврата. История выдачи останется.</p><div className="actions">{!existing&&issue.posting_state==='POSTED'&&<Button onClick={()=>setConfirm(true)}>Подтвердить полный возврат</Button>}<Button variant="secondary" onClick={()=>navigate(`/documents/${issue.id}`)}>К исходной выдаче</Button><Button variant="ghost" onClick={()=>navigate('/')}>Отмена</Button></div></Card>{confirm&&<ConfirmDialog title="Деталь фактически возвращена?" confirmLabel="Провести возврат" onCancel={()=>setConfirm(false)} onConfirm={post}><p>Подтвердите приём всех {formatQuantity(issue.quantity)} {unit?.name}. Частичный возврат здесь не оформляется.</p></ConfirmDialog>}</>;
}
