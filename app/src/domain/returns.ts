import type { DemoState, Result } from './types.ts';
import {failure,success} from './types.ts';
import type {CommandOutcome} from '../state/commands.ts';
import {getAccountingDate,isInstant} from './dates.ts';
import {nextDocumentNumber} from './issue.ts';
export interface FullReturnInput {issueId:string;actorId:string;attemptId:string;occurredAt:string}
export function validateFullReturn(state:DemoState,input:FullReturnInput):Result<undefined>{
 const actor=state.data.users.find(u=>u.id===input.actorId);const issue=state.data.documents.find(d=>d.id===input.issueId);
 if(!actor?.is_active||actor.role!=='WAREHOUSE'||state.selected_user_id!==actor.id)return failure('ROLE_DENIED','Возврат подтверждает кладовщик');
 if(!issue||issue.kind!=='ISSUE'||issue.posting_state!=='POSTED')return failure('ISSUE_MISSING','Для возврата нужна проведённая выдача');
 if(issue.warehouse_id!==actor.warehouse_id)return failure('WAREHOUSE_DENIED','Выдача относится к другому складу');
 if(!isInstant(input.occurredAt)||Date.parse(input.occurredAt)<Date.parse(issue.posted_at!))return failure('DATE_INVALID','Дата возврата не может быть раньше выдачи');
 if(!state.data.stock_positions.some(p=>p.warehouse_id===issue.warehouse_id&&p.item_id===issue.item_id))return failure('STOCK_MISSING','Не найдена складская позиция');
 if(!state.data.financial_articles.some(a=>a.id==='parts'&&a.direction==='EXPENSE'))return failure('ARTICLE_MISSING','Состав складского расхода не определён');
 return success(undefined);
}
export function postFullReturn(state:DemoState,input:FullReturnInput):Result<CommandOutcome>{
 const valid=validateFullReturn(state,input);if(!valid.ok)return valid;
 const existing=state.data.documents.find(d=>d.kind==='RETURN'&&d.return_of_document_id===input.issueId);
 if(existing)return success({state,entityId:existing.id,changed:false});
 const next=structuredClone(state);const issue=next.data.documents.find(d=>d.id===input.issueId)!;
 const id=`return-${input.attemptId}`;const date=getAccountingDate(input.occurredAt);
 next.data.documents.push({...issue,id,kind:'RETURN',number:nextDocumentNumber(state,'RETURN'),document_date:date,created_at:input.occurredAt,created_by_user_id:input.actorId,posted_at:input.occurredAt,request_id:null,return_of_document_id:issue.id,discrepancy_comment:null,discrepancy_author_id:null,discrepancy_at:null});
 const position=next.data.stock_positions.find(p=>p.warehouse_id===issue.warehouse_id&&p.item_id===issue.item_id)!;
 next.data.stock_movements.push({id:`movement-${id}`,stock_position_id:position.id,document_id:id,quantity_delta:issue.quantity!,occurred_at:input.occurredAt});
 next.data.financial_operations.push({id:`expense-${id}`,document_id:id,vehicle_id:issue.vehicle_id,article_id:'parts',accounting_date:date,amount_minor:issue.amount_minor===null?null:-issue.amount_minor,description:'Полный возврат по выдаче',item_id:issue.item_id,quantity:issue.quantity,unit_id:issue.unit_id,unit_price_minor:issue.unit_price_minor});
 return success({state:next,entityId:id,changed:true});
}
