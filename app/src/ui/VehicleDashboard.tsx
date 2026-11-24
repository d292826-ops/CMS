import type {DemoState} from '../domain/types.ts';
import type {FinanceSummary} from '../domain/finance.ts';
import {incomeBreakdown,resultBreakdown,vehicleTrend} from '../domain/dashboard.ts';
import {navigate} from '../app/router.tsx';
import {Button,Card} from './components.tsx';
import {formatMoney} from './format.ts';

const operationWord=(count:number)=>(new Intl.PluralRules('ru-RU').select(count)==='one'?'операция':new Intl.PluralRules('ru-RU').select(count)==='few'?'операции':'операций');
const compact=(value:number|null)=>value===null?'Нет данных':new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:1}).format(value/100)+' ₽';
export function VehicleDashboard({state,summary}:{state:DemoState;summary:FinanceSummary}) {
  const result=resultBreakdown(summary);const income=incomeBreakdown(summary);
  const trend=vehicleTrend(state,summary.vehicle.id,summary.period);
  const maximum=Math.max(1,...trend.flatMap(row=>[row.income,row.expenses].filter((v):v is number=>v!==null&&v>=0)));
  let offset=0;
  return <section className="vehicle-dashboard" aria-label="Визуальный дашборд машины" data-finance-dashboard>
    <div className="finance-visual-grid">
      <Card className="profit-visual">
        <div className="heading-row"><h2>Машина в плюсе?</h2><span className={'finance-badge finance-'+result.tone} data-profit-status>{result.label}</span></div>
        <p className="hint">{result.basis}</p>
        <div className="profit-ring">
          <svg viewBox="0 0 180 180" role="img" aria-label={result.result===null?'Недостаточно данных для круговой диаграммы':`${result.label}: ${formatMoney(result.result)}. ${result.slices.map(s=>s.label+': '+formatMoney(s.amount)).join('. ')}`}>
            <circle className="ring-track" cx="90" cy="90" r="73" fill="none" strokeWidth="16"/>
            {result.slices.map(slice=>{const start=offset;offset+=slice.percent;return slice.percent>0?<circle key={slice.label} className={'ring-slice ring-'+slice.tone} cx="90" cy="90" r="73" pathLength="100" fill="none" strokeWidth="16" strokeDasharray={`${slice.percent} ${100-slice.percent}`} strokeDashoffset={-start} transform="rotate(-90 90 90)"/>:null;})}
          </svg>
          <div className={'ring-center finance-'+result.tone}><span>Результат месяца</span><strong data-chart-result>{result.result===null?'Нет данных':(result.result>0?'+':'')+formatMoney(result.result)}</strong></div>
        </div>
        <ul className="chart-legend">{result.slices.map(slice=><li key={slice.label}><span><i className={'legend-dot ring-'+slice.tone}/>{slice.label}</span><strong>{formatMoney(slice.amount)}</strong></li>)}</ul>
        <p className="hint">{result.note}</p>
      </Card>
      <Card className="income-visual"><div className="heading-row"><h2>На чём заработала машина</h2></div><p className="hint">Источники дохода за выбранный месяц</p>
        {income.length===0?<p className="chart-empty">{summary.income===0?'В этом месяце доходов не было.':'Источники дохода не подготовлены.'}</p>:<div className="income-bars">{income.map((row,index)=>{
          const percent=summary.income!==null&&summary.income>0&&row.amount!==null?Math.max(0,Math.min(100,row.amount/summary.income*100)):null;
          return <div className="income-bar-row" key={row.id}><div className="heading-row"><span>{row.label}</span><strong>{formatMoney(row.amount)}</strong></div><div className="income-bar-track" aria-hidden="true"><span className={'income-fill income-fill-'+index} style={{width:(percent??0)+'%'}}/></div><p className="hint">{summary.income===0&&row.amount===0?'Доход по этому виду — 0 ₽.':percent===null?'Доля недоступна: часть сумм неизвестна.':Math.round(percent)+'% дохода'} · {row.count} {operationWord(row.count)}</p></div>;
        })}</div>}
        <div className="actions"><Button variant="ghost" onClick={()=>navigate(`/vehicles/${summary.vehicle.id}?period=${summary.period}&article=income`)}>Посмотреть доходные операции</Button></div>
      </Card>
    </div>
    <Card className="trend-visual"><div className="heading-row"><div><h2>Динамика за три месяца</h2><p className="hint">Доходы и учтённые расходы одной машины</p></div><div className="trend-legend"><span><i className="legend-dot ring-income"/>Доходы</span><span><i className="legend-dot ring-expense"/>Расходы</span></div></div>
      <div className="trend-chart">{trend.map(row=>{
        const noBars=row.income===null||row.expenses===null||row.income<0||row.expenses<0;
        return <div className="trend-month" key={row.period}>
          <div className="trend-bars" aria-label={`${row.period}: доходы ${formatMoney(row.income)}, расходы ${formatMoney(row.expenses)}`}>
            {noBars?<span className="trend-missing">{row.income!==null&&row.expenses!==null?'Есть возвраты':'Нет полных данных'}</span>:<><div className="trend-bar trend-income" style={{height:(row.income??0)/maximum*148+'px'}} title={'Доходы: '+formatMoney(row.income)}/><div className="trend-bar trend-expense" style={{height:(row.expenses??0)/maximum*148+'px'}} title={'Расходы: '+formatMoney(row.expenses)}/></>}
          </div>
          <strong className="trend-month-name">{new Intl.DateTimeFormat('ru-RU',{month:'short',timeZone:'UTC'}).format(new Date(row.period+'-01T12:00:00Z'))}</strong>
          <div className="trend-values"><span title={formatMoney(row.income)}>Доход: {compact(row.income)}</span><span title={formatMoney(row.expenses)}>Расход: {compact(row.expenses)}</span></div>
          <span className={'trend-result finance-'+(row.result===null?'unknown':row.result>0?'profit':row.result<0?'loss':'zero')} title={formatMoney(row.result)}>{row.result===null?'Нет результата':(row.result>0?'+':'')+compact(row.result)}</span>
        </div>;
      })}</div>
      <p className="hint">Отсутствие сведений не означает нулевые доходы. Сравнение использует тот же состав статей, что и финансовый разбор.</p>
    </Card>
  </section>;
}
