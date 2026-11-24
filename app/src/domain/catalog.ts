import type {DemoState,Item} from './types.ts';import {currentStock} from './status.ts';
const normalize=(s:string)=>s.trim().toLocaleLowerCase('ru').replace(/\s+/g,' ').replace(/(^|\s)п-(?=\d)/g,'$1p-');
export function searchItems(items:Item[],query:string):Item[]{const words=normalize(query).split(' ').filter(Boolean);return items.filter(i=>i.is_active&&words.every(w=>normalize(i.name+' '+i.article+' '+i.id).includes(w)));}
export const getCurrentStock=currentStock;
export function getItemAvailability(state:DemoState,itemId:string){const item=state.data.items.find(i=>i.id===itemId);const unit=state.data.units.find(u=>u.id===item?.unit_id);return {item,unit,stock:currentStock(state,state.default_warehouse_id,itemId),error:unit?null:'Для детали не задана единица измерения'};}
