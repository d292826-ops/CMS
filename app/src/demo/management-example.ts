import type {DemoState,Document,FinancialOperation} from '../domain/types.ts';

// A separate opt-in dataset. Existing baseline values and user actions stay untouched.
export function addManagementExample(state:DemoState):DemoState {
  state.data.vehicles=[
    {...state.data.vehicles[0],display_name:'КамАЗ 65115 · самосвал'},
    {...state.data.vehicles[1],display_name:'Автокран XCMG QY25K'},
    {id:'C',display_name:'Экскаватор Komatsu PC200',registration_number:'Е452РА41',vin:'XTEST000000000003',is_active:true},
  ];
  const profiles=[
    {id:'A',activities:['Доставка инертных материалов','Аренда самосвала на смену'],months:[[420000,85000,210000,45000,125000],[480000,90000,220000,55000,140000],[540000,120000,245000,65000,155000]]},
    {id:'B',activities:['Монтажные работы автокрана','Аренда автокрана на смену'],months:[[320000,200000,105000,55000,190000],[360000,240000,115000,70000,210000],[400000,280000,125000,95000,240000]]},
    {id:'C',activities:['Разработка котлована экскаватором','Аренда экскаватора на смену'],months:[[280000,70000,130000,45000,90000],[290000,60000,140000,100000,90000],[270000,80000,150000,180000,95000]]},
  ];
  const documents:Document[]=[];const operations:FinancialOperation[]=[];
  state.data.financial_coverage=[];
  for(const profile of profiles)for(let m=0;m<3;m++){
    const period='2026-'+String(9+m).padStart(2,'0');const date=period+'-15';
    const amounts=profile.months[m];
    const rows=[
      {article:'income',description:profile.activities[0],amount:amounts[0]},
      {article:'income',description:profile.activities[1],amount:amounts[1]},
      {article:'fuel',description:'Топливо за месяц',amount:amounts[2]},
      {article:'parts',description:'Запчасти и обслуживание',amount:amounts[3]},
      {article:'other',description:'Оплата труда, страхование и прочие учтённые затраты',amount:amounts[4]},
    ];
    for(const article of state.data.financial_articles){
      const id=`example-${profile.id}-${period}-${article.id}`;
      documents.push({id,kind:'SOURCE',number:`Демо-${profile.id}-${9+m}-${article.id}`,document_date:date,created_at:date+'T12:00:00+12:00',created_by_user_id:null,posting_state:'POSTED',posted_at:null,request_id:null,return_of_document_id:null,warehouse_id:null,vehicle_id:profile.id,vehicle_vin_snapshot:null,item_id:null,unit_id:null,quantity:null,recipient_user_id:null,unit_price_minor:null,amount_minor:null,discrepancy_comment:null,discrepancy_author_id:null,discrepancy_at:null});
      state.data.financial_coverage.push({id:'coverage-'+id,vehicle_id:profile.id,period_start:period+'-01',article_id:article.id,base_status:'COMPLETE',note:'Полнота только вымышленного примера для дашборда'});
      rows.filter(row=>row.article===article.id).forEach((row,index)=>operations.push({id:`row-${id}-${index}`,document_id:id,vehicle_id:profile.id,article_id:article.id,accounting_date:date,amount_minor:row.amount*100,description:row.description,item_id:null,quantity:null,unit_id:null,unit_price_minor:null}));
    }
  }
  state.data.documents=documents;state.data.financial_operations=operations;
  return state;
}
