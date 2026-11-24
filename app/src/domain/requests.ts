import type {DemoState,Result} from './types.ts';import {failure,success} from './types.ts';import {parseQuantity} from './quantity.ts';import {isInstant} from './dates.ts';import type {CommandOutcome} from '../state/commands.ts';
export interface RequestInput {actorId:string;vehicleId:string;itemId:string;quantity:string;comment:string;attemptId:string;occurredAt:string}
export interface RequestFields {vehicle:string;item:string;quantity:string;comment:string}
export function validateRequestFields(state:DemoState,fields:RequestFields):Record<string,string>{
 const errors:Record<string,string>={};
 if(!state.data.vehicles.some(v=>v.id===fields.vehicle&&v.is_active))errors.vehicle='Выберите машину';
 const item=state.data.items.find(i=>i.id===fields.item&&i.is_active);
 const unit=state.data.units.find(u=>u.id===item?.unit_id);
 if(!item)errors.item='Выберите деталь из номенклатуры';else if(!unit)errors.item='Для детали не задана единица измерения';
 if(!fields.quantity)errors.quantity='Укажите количество больше нуля';else{const parsed=parseQuantity(fields.quantity,unit?.quantity_scale??3,true);if(!parsed.ok)errors.quantity=parsed.message;}
 if(fields.comment.length>2000)errors.comment='Комментарий — не больше 2000 символов';
 return errors;
}
export function validateRequest(state:DemoState,input:RequestInput):Result<{quantity:string;clerkId:string}>{
 const actor=state.data.users.find(u=>u.id===input.actorId);if(!actor?.is_active||!['MECHANIC','DRIVER'].includes(actor.role)||state.selected_user_id!==actor.id)return failure('ROLE_DENIED','Заявку создаёт механик или водитель');
 if(!state.data.vehicles.some(v=>v.id===input.vehicleId&&v.is_active))return failure('VEHICLE_MISSING','Выберите машину','vehicle');
 const item=state.data.items.find(i=>i.id===input.itemId&&i.is_active);if(!item)return failure('ITEM_MISSING','Выберите деталь из номенклатуры','item');
 const unit=state.data.units.find(u=>u.id===item.unit_id);if(!unit)return failure('UNIT_MISSING','Для детали не задана единица измерения','item');
 const quantity=parseQuantity(input.quantity,unit.quantity_scale,true);if(!quantity.ok)return {...quantity,field:'quantity'};
 const clerks=state.data.users.filter(u=>u.role==='WAREHOUSE'&&u.is_active&&u.is_default_clerk&&u.warehouse_id===state.default_warehouse_id);
 if(clerks.length!==1)return failure('CLERK_MISSING','Не удалось определить кладовщика для заявки');
 if(!isInstant(input.occurredAt))return failure('DATE_INVALID','Не удалось определить дату заявки');
 if(input.comment.length>2000)return failure('COMMENT_LONG','Комментарий — не больше 2000 символов','comment');
 return success({quantity:quantity.value,clerkId:clerks[0].id});
}
export function createRequest(state:DemoState,input:RequestInput):Result<CommandOutcome>{
 const existing=state.data.requests.find(r=>r.id===`request-${input.attemptId}`);if(existing&&existing.author_user_id===input.actorId&&state.selected_user_id===input.actorId)return success({state,entityId:existing.id,changed:false});
 const valid=validateRequest(state,input);if(!valid.ok)return valid;
 const next=structuredClone(state);const max=state.data.requests.reduce((m,r)=>Math.max(m,Number(r.number.match(/(\d+)$/)?.[1]??0)),0);const id=`request-${input.attemptId}`;
 next.data.requests.push({id,number:`З-${String(max+1).padStart(4,'0')}`,created_at:input.occurredAt,author_user_id:input.actorId,warehouse_id:state.default_warehouse_id,assigned_clerk_id:valid.value.clerkId,vehicle_id:input.vehicleId,item_id:input.itemId,quantity:valid.value.quantity,comment:input.comment.trim()||null,cancelled_at:null});return success({state:next,entityId:id,changed:true});
}
export function cancelRequest(state:DemoState,id:string,actorId:string,occurredAt:string):Result<CommandOutcome>{
 const request=state.data.requests.find(r=>r.id===id);if(!request||request.author_user_id!==actorId||state.selected_user_id!==actorId)return failure('ROLE_DENIED','Отменить заявку может её автор');
 if(state.data.documents.some(d=>d.kind==='ISSUE'&&d.request_id===id&&d.posting_state==='POSTED'))return failure('ALREADY_ISSUED','Выдача уже состоялась. Для изменения нужен фактический возврат');
 if(request.cancelled_at)return success({state,entityId:id,changed:false});if(!isInstant(occurredAt))return failure('DATE_INVALID','Проверьте дату отмены');const next=structuredClone(state);next.data.requests.find(r=>r.id===id)!.cancelled_at=occurredAt;return success({state:next,entityId:id,changed:true});
}
export function myRequests(state:DemoState,actorId:string){return state.data.requests.filter(r=>r.author_user_id===actorId).slice().sort((a,b)=>b.created_at.localeCompare(a.created_at));}
