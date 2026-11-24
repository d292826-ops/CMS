import type {DemoState} from './types.ts';
import type {FinanceSummary} from './finance.ts';
import {calculateVehicleResult, validPeriod} from './finance.ts';
import {sumMoney} from './money.ts';

export type ResultTone = 'profit' | 'loss' | 'zero' | 'unknown';
export interface ResultSlice {label:string; amount:number; percent:number; tone:'income'|'expense'|'profit'|'loss'}
export function resultBreakdown(summary:FinanceSummary):{tone:ResultTone;label:string;result:number|null;basis:string;note:string;slices:ResultSlice[]} {
  const {income,expenses,result}=summary;
  if(summary.status!=='COMPLETE'||income===null||expenses===null||result===null)
    return {tone:'unknown',label:'Недостаточно данных',result:null,basis:'Полный результат недоступен',note:'Неизвестные суммы не считаются нулевыми. Уточните состав расчёта.',slices:[]};
  const tone=result>0?'profit':result<0?'loss':'zero';
  const label=result>0?'В плюсе':result<0?'В минусе':'В ноль';
  if(income<0||expenses<0)return {tone,label,result,basis:'Результат с учётом возвратов',note:'Есть отрицательные корректировки. Круговое распределение для них не строится.',slices:[]};
  const basis=result>=0?income:expenses;
  const values=result>=0
    ? [{label:'Учтённые расходы',amount:expenses,tone:'expense' as const},{label:'Осталось после расходов',amount:result,tone:'profit' as const}]
    : [{label:'Покрыто доходами',amount:income,tone:'income' as const},{label:'Не покрыто доходами',amount:-result,tone:'loss' as const}];
  return {tone,label,result,basis:result>=0?'Как распределился доход':'Как покрываются расходы',
    note:basis===0?'Доходы и расходы за месяц равны нулю.':'По учтённым статьям выбранной машины за месяц.',
    slices:basis>0?values.map(v=>({...v,percent:v.amount/basis*100})):[]};
}

const ACTIVITIES = [
  {id:'delivery',label:'Перевозки и доставка'}, {id:'rental',label:'Аренда техники'},
  {id:'work',label:'Работы спецтехники'}, {id:'other',label:'Прочий доход'},
] as const;
export function incomeActivity(description:string|null) {
  const text=description?.toLowerCase()??'';
  if(/аренд/.test(text))return 'rental';
  if(/перевоз|достав|рейс/.test(text))return 'delivery';
  if(/работ|кран|экскават|машиночас|погруз|смена/.test(text))return 'work';
  return 'other';
}
export function incomeBreakdown(summary:FinanceSummary) {
  const rows=summary.articles.filter(a=>a.article.direction==='INCOME'&&a.article.included_in_result).flatMap(a=>a.rows);
  return ACTIVITIES.flatMap(activity=>{
    const group=rows.filter(row=>incomeActivity(row.description)===activity.id);
    if(!group.length)return [];
    const known=group.flatMap(row=>row.amount_minor===null?[]:[row.amount_minor]);
    const total=sumMoney(known);
    const complete=total.ok&&group.every(row=>row.amount_minor!==null);
    return [{...activity,count:group.length,amount:complete&&total.ok?total.value:null,knownPart:total.ok&&known.length?total.value:null}];
  });
}
export function vehicleTrend(state:DemoState,vehicleId:string,period:string) {
  if(!validPeriod(period))return [];
  const [year,month]=period.split('-').map(Number);const index=year*12+month-1;
  return [-2,-1,0].map(offset=>{
    const position=index+offset;
    const key=String(Math.floor(position/12)).padStart(4,'0')+'-'+String(position%12+1).padStart(2,'0');
    const calculated=calculateVehicleResult(state,vehicleId,key);
    return {period:key,income:calculated.ok?calculated.value.income:null,expenses:calculated.ok?calculated.value.expenses:null,result:calculated.ok?calculated.value.result:null};
  });
}
