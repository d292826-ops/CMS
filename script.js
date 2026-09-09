/* Standalone XLSX writer and CMS demo. No runtime dependencies. */
"use strict";
var CMSExcel = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../../sites/cms-resources/lib/stream-xlsx.ts
  var stream_xlsx_exports = {};
  __export(stream_xlsx_exports, {
    streamWorkbook: () => streamWorkbook
  });
  var enc = new TextEncoder();
  var escapeXml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  var crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
    let c = i;
    for (let j = 0; j < 8; j++)
      c = c >>> 1 ^ (c & 1 ? 3988292384 : 0);
    return c >>> 0;
  });
  function crcUpdate(crc, b) {
    for (const n of b)
      crc = crcTable[(crc ^ n) & 255] ^ crc >>> 8;
    return crc >>> 0;
  }
  var column = (n) => {
    let r = "";
    for (n++; n; n = Math.floor((n - 1) / 26))
      r = String.fromCharCode(65 + (n - 1) % 26) + r;
    return r;
  };
  function xmlRow(values, i) {
    return `<row r="${i}">${values.map((v, j) => typeof v === "number" ? `<c r="${column(j)}${i}"><v>${v}</v></c>` : `<c r="${column(j)}${i}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`).join("")}</row>`;
  }
  var meta = {
    "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="\u041E\u0442\u0447\u0451\u0442" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
  };
  function streamWorkbook(rows) {
    async function* worksheet() {
      yield enc.encode('<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="15" width="22" customWidth="1"/></cols><sheetData>');
      let index = 0, buffer = "";
      for await (const row of rows) {
        buffer += xmlRow(row, ++index);
        if (buffer.length > 32768) {
          yield enc.encode(buffer);
          buffer = "";
        }
      }
      if (buffer)
        yield enc.encode(buffer);
      yield enc.encode("</sheetData></worksheet>");
    }
    async function* zip() {
      let offset = 0;
      const central = [];
      const sources = Object.entries(meta).map(([name, xml]) => [name, (async function* () {
        yield enc.encode(xml);
      })()]);
      sources.push(["xl/worksheets/sheet1.xml", worksheet()]);
      for (const [name, source] of sources) {
        const start = offset, n = enc.encode(name), head = new Uint8Array(30 + n.length), v2 = new DataView(head.buffer);
        v2.setUint32(0, 67324752, true);
        v2.setUint16(4, 20, true);
        v2.setUint16(6, 8, true);
        v2.setUint16(26, n.length, true);
        head.set(n, 30);
        yield head;
        offset += head.length;
        let crc = 4294967295, size = 0;
        for await (const chunk of source) {
          crc = crcUpdate(crc, chunk);
          size += chunk.length;
          offset += chunk.length;
          yield chunk;
        }
        crc = (crc ^ 4294967295) >>> 0;
        const descriptor = new Uint8Array(16), d = new DataView(descriptor.buffer);
        d.setUint32(0, 134695760, true);
        d.setUint32(4, crc, true);
        d.setUint32(8, size, true);
        d.setUint32(12, size, true);
        yield descriptor;
        offset += 16;
        const c = new Uint8Array(46 + n.length), h = new DataView(c.buffer);
        h.setUint32(0, 33639248, true);
        h.setUint16(4, 20, true);
        h.setUint16(6, 20, true);
        h.setUint16(8, 8, true);
        h.setUint32(16, crc, true);
        h.setUint32(20, size, true);
        h.setUint32(24, size, true);
        h.setUint16(28, n.length, true);
        h.setUint32(42, start, true);
        c.set(n, 46);
        central.push(c);
      }
      const centralStart = offset;
      for (const c of central) {
        yield c;
        offset += c.length;
      }
      const end = new Uint8Array(22), v = new DataView(end.buffer);
      v.setUint32(0, 101010256, true);
      v.setUint16(8, central.length, true);
      v.setUint16(10, central.length, true);
      v.setUint32(12, offset - centralStart, true);
      v.setUint32(16, centralStart, true);
      yield end;
    }
    const generator = zip();
    return new ReadableStream({ async pull(controller) {
      try {
        const r = await generator.next();
        if (r.done)
          controller.close();
        else
          controller.enqueue(r.value);
      } catch (e) {
        controller.error(e);
      }
    }, async cancel() {
      await generator.return(void 0);
    } });
  }
  return __toCommonJS(stream_xlsx_exports);
})();

/* ЦМС: автономная демонстрация. Все данные вымышлены; сетевых API нет. */
(function () {
  'use strict';
  const groupNames = {part:'Запчасти',material:'Материалы',fuel:'Жидкое топливо',gas:'Газ'};
  const articleNames = {materials:'Запчасти и материалы',fuel:'Жидкое топливо',gas:'Газ'};
  const typeNames = {vehicle:'Автомобиль',building:'Здание',department:'Подразделение'};
  const colors = {part:'#2563eb',material:'#60a5fa',materials:'#2563eb',fuel:'#14b8a6',gas:'#f59e0b'};
  const nav = [['dashboard','Обзор расходов','grid'],['journal','Выдача','box'],['fuel','Топливо и газ','fuel'],['objects','Подразделения','building'],['recipients','Водители и получатели','users'],['resources','Запчасти и материалы','box'],['budgets','Бюджеты','chart'],['reports','Отчёты','report']];
  const icons = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    box:'<path d="m12 3 9 5v8l-9 5-9-5V8Zm0 9v9M3 8l9 4 9-4M7 5l10 5"/>',
    fuel:'<path d="M3 21h12M5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M5 10h9M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V8l-4-4M19 5v4h3"/>',
    building:'<path d="M4 21V3h12v18M16 9h4v12M2 21h20M8 7h4M8 11h4M8 15h4M9 21v-3h2v3"/>',
    users:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a4 4 0 0 1 0 8m3 3a5 5 0 0 1 3 4v2"/>',
    chart:'<path d="M3 3v18h18M7 16v-4m5 4V7m5 9V4"/>',
    report:'<path d="M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.box}</svg>`;
  const esc = value => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (n,d=0) => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:d,maximumFractionDigits:d}).format(n/100);
  const quantity = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(n/1000);
  const iso = d => d.toISOString().slice(0,10);
  const localDay = (d=new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kamchatka',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const dateLabel = s => new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const monthLabel = s => new Date(s+'-01T12:00:00Z').toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'});
  const article = g => ['part','material'].includes(g)?'materials':g;
  const sum = (rows,key='amount') => rows.reduce((v,r)=>v+r[key],0);
  const lineAmount = (q,p) => Number((BigInt(q)*BigInt(p)+500n)/1000n);
  function periodRange(kind,anchor) {
    const d=new Date(anchor.slice(0,10)+'T12:00:00Z'),y=d.getUTCFullYear(),m=d.getUTCMonth();
    if(kind==='day')return [iso(d),iso(d)];
    if(kind==='week'){d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const end=new Date(d);end.setUTCDate(end.getUTCDate()+6);return [iso(d),iso(end)];}
    if(kind==='year')return [`${y}-01-01`,`${y}-12-31`];
    return [iso(new Date(Date.UTC(y,m,1,12))),iso(new Date(Date.UTC(y,m+1,0,12)))];
  }
  function monthsBetween(from,to){const out=[];const d=new Date(from.slice(0,7)+'-01T12:00:00Z');while(iso(d).slice(0,7)<=to.slice(0,7)&&out.length<120){out.push(iso(d).slice(0,7));d.setUTCMonth(d.getUTCMonth()+1);}return out;}
  function seed(today=localDay()) {
    const month=today.slice(0,7),past=new Date(month+'-01T12:00:00Z');past.setUTCMonth(past.getUTCMonth()-1);const pm=iso(past).slice(0,7);
    const recipients=[{id:'p1',code:'С01',name:'Иванов Иван Иванович',position:'Водитель'},{id:'p2',code:'С02',name:'Петров Пётр Петрович',position:'Водитель'},{id:'p3',code:'С03',name:'Сидоров Алексей Сергеевич',position:'Завхоз'}];
    const objects=[{id:'o1',code:'О01',name:'КАМАЗ 65115',type:'vehicle',model:'КАМАЗ 65115',plate:'А111АА41'},{id:'o2',code:'О02',name:'ГАЗель',type:'vehicle',model:'ГАЗ 3302',plate:'В222ВВ41'},{id:'o3',code:'О03',name:'Административное здание',type:'building',model:'',plate:''}];
    const resources=[['r1','М01','Фильтр масляный','part','шт.',120000],['r2','М02','Масло моторное','material','л',45000],['r3','М03','Краска','material','кг',90000],['r4','Т01','Дизельное топливо','fuel','л',7500],['r5','Т02','Бензин АИ-95','fuel','л',6500],['r6','Т03','Пропан-бутан','gas','л',3500]].map(([id,code,name,group,unit,price])=>({id,code,name,group,unit,price}));
    const ops=[['d1','В01',0,month+'-01',[[0,2000],[1,20000]]],['d2','В02',0,today,[[3,200000]]],['d3','Р01',0,today,[[0,1000]],'d1'],['d4','В03',1,month+'-01',[[2,2000]]],['d5','В04',1,today,[[4,80000]]],['d6','В05',2,month+'-01',[[2,10000]]],['d7','В06',2,today,[[5,150000]]],['h1','В-П01',0,pm+'-12',[[3,140000]]],['h2','В-П02',1,pm+'-17',[[4,60000]]],['h3','В-П03',2,pm+'-23',[[2,5000]]]];
    const documents=ops.map(([id,number,o,date,items,original_id])=>({id,number,kind:original_id?'return':'issue',status:'posted',date,operation_at:date+(original_id?'T15:00:00':'T09:00:00'),recipient_id:recipients[o].id,object_id:objects[o].id,recipient_name:recipients[o].name,object_name:objects[o].name,author_name:'Администратор (пример)',comment:'Демонстрационная операция',original_id:original_id||null,lines:items.map(([r,q],i)=>({...resources[r],id:id+'l'+i,resource_id:resources[r].id,qty:q,amount:lineAmount(q,resources[r].price)}))}));
    documents.forEach(d=>d.total=sum(d.lines));
    const plans=[[900000,1500000,0],[300000,700000,0],[900000,0,600000]];
    const budgets=[month,pm].flatMap(m=>objects.flatMap((o,i)=>['materials','fuel','gas'].map((a,j)=>({object_id:o.id,month:m,article:a,amount:plans[i][j]}))));
    return {today,month,recipients,objects,resources,documents,budgets};
  }
  function matches(v,filter){return !filter||filter==='all'||v===filter;}
  function filterLines(data,f,posted=true) {
    return data.documents.filter(d=>(!posted||d.status==='posted')&&d.date>=f.from&&d.date<=f.to&&matches(d.object_id,f.object)&&matches(d.recipient_id,f.recipient)&&matches(d.kind,f.kind)&&matches(d.status,f.status)&&matches(data.objects.find(o=>o.id===d.object_id).type,f.type)).flatMap(d=>d.lines.filter(l=>matches(l.resource_id,f.resource)&&(!f.group||f.group==='all'||l.group===f.group||article(l.group)===f.group)&&(!f.fuelOnly||['fuel','gas'].includes(l.group))).map(l=>({...l,document:d,amount:l.amount*(d.kind==='return'?-1:1),netQty:l.qty*(d.kind==='return'?-1:1)}))).filter(l=>!f.q||[l.name,l.document.number,l.document.recipient_name,l.document.object_name].join(' ').toLowerCase().includes(f.q.toLowerCase()));
  }
  function aggregate(data,f) {
    const lines=filterLines(data,f),ids=new Set(lines.map(l=>l.document.id)),docs=data.documents.filter(d=>ids.has(d.id));
    const byObject=data.objects.map(o=>({...o,total:sum(lines.filter(l=>l.document.object_id===o.id)),materials:sum(lines.filter(l=>l.document.object_id===o.id&&article(l.group)==='materials')),fuel:sum(lines.filter(l=>l.document.object_id===o.id&&l.group==='fuel')),gas:sum(lines.filter(l=>l.document.object_id===o.id&&l.group==='gas'))})).sort((a,b)=>b.total-a.total);
    const byPerson=data.recipients.map(p=>({...p,total:sum(lines.filter(l=>l.document.recipient_id===p.id)),issues:docs.filter(d=>d.recipient_id===p.id&&d.kind==='issue').length})).sort((a,b)=>b.total-a.total);
    return {lines,total:sum(lines),issues:docs.filter(d=>d.kind==='issue').length,returns:docs.filter(d=>d.kind==='return').length,byObject,byPerson,groups:Object.keys(articleNames).map(a=>({id:a,name:articleNames[a],total:sum(lines.filter(l=>article(l.group)===a))}))};
  }
  function budgetReport(data,f) {
    if((f.recipient&&f.recipient!=='all')||(f.resource&&f.resource!=='all')||['part','material'].includes(f.group))return {hidden:true,reason:'Для сравнения с бюджетом уберите фильтр получателя, конкретного ресурса или отдельной группы материалов.'};
    const months=monthsBetween(f.from,f.to),articles=['materials','fuel','gas'].includes(f.group)?[f.group]:['materials','fuel','gas'];
    const rows=data.objects.filter(o=>matches(o.id,f.object)&&matches(o.type,f.type)).map(o=>{
      const detail=months.flatMap(month=>articles.map(a=>{const p=data.budgets.find(b=>b.object_id===o.id&&b.month===month&&b.article===a);const range=periodRange('month',month+'-01');return {month,article:a,plan:p?p.amount:null,fact:sum(filterLines(data,{from:range[0],to:range[1],object:o.id,group:a}))};}));
      const filled=detail.filter(d=>d.plan!==null).length;
      return {...o,detail,plan:detail.reduce((a,b)=>a+(b.plan||0),0),fact:sum(detail,'fact'),filled,expected:detail.length,complete:filled===detail.length};
    });
    return {rows,months,plan:sum(rows,'plan'),fact:sum(rows,'fact'),complete:rows.every(r=>r.complete)};
  }
  function budgetStatus(plan,fact,complete=true){if(!complete||plan===null)return {label:'Бюджет задан частично',color:'gray',percent:null,remaining:null};return {label:fact>plan?'Превышен':plan>0&&fact/plan>=.8?'Близко к лимиту':'В пределах',color:fact>plan?'red':plan>0&&fact/plan>=.8?'amber':'green',percent:plan>0?fact/plan*100:null,remaining:plan-fact};}
  function journalRows(data,f){const lines=filterLines(data,f,false),ids=[...new Set(lines.map(l=>l.document.id))];return ids.map(id=>({...data.documents.find(d=>d.id===id),filteredTotal:sum(lines.filter(l=>l.document.id===id))})).sort((a,b)=>f.sort==='amount_desc'?b.filteredTotal-a.filteredTotal:f.sort==='amount_asc'?a.filteredTotal-b.filteredTotal:f.sort==='date_asc'?a.operation_at.localeCompare(b.operation_at):b.operation_at.localeCompare(a.operation_at));}
  function fuelRows(data,f){const lines=filterLines(data,{...f,fuelOnly:true});return data.objects.flatMap(o=>data.resources.filter(r=>['fuel','gas'].includes(r.group)).map(r=>{const ls=lines.filter(l=>l.resource_id===r.id&&l.document.object_id===o.id);return {object:o,resource:r,total:sum(ls),issued:sum(ls.filter(l=>l.document.kind==='issue'),'qty'),returned:sum(ls.filter(l=>l.document.kind==='return'),'qty')};})).filter(r=>r.issued||r.returned).sort((a,b)=>b.total-a.total);}
  function* exportRows(data,f){yield ['ЦМС — демонстрационный отчёт'];yield ['Период',f.from,f.to,'Часовой пояс','Asia/Kamchatka'];yield ['Вымышленные примеры. Учётные цены с НДС. Валюта RUB.'];yield ['Дата','Документ','Операция','Получатель','Объект','Ресурс','Группа','Количество со знаком','Единица','Цена, ₽','Сумма, ₽','Состояние'];const rows=filterLines(data,f,false).sort((a,b)=>b.document.operation_at.localeCompare(a.document.operation_at));for(const l of rows)yield [l.document.operation_at.replace('T',' '),l.document.number,l.document.kind==='return'?'Возврат':'Выдача',l.document.recipient_name,l.document.object_name,l.name,groupNames[l.group],l.netQty/1000,l.unit,l.price/100,l.amount/100,'Проведён'];yield ['ИТОГО','','','','','','','','','',sum(rows)/100];}
  const data=seed();
  const range=periodRange('month',data.today);
  const state={view:'dashboard',period:'month',from:range[0],to:range[1],object:'all',recipient:'all',group:'all',resource:'all',type:'all',kind:'all',status:'all',q:'',catalogSearch:'',sort:'date_desc',page:1,tab:'analytics',mobile:false};
  const effective=()=>({...state,fuelOnly:state.view==='fuel'});
  const pill=(label,color='gray')=>`<span class="pill ${color}">${esc(label)}</span>`;
  const empty=(message='Нет данных за выбранный период')=>`<div class="empty-state">${icon('report')}<h3>${esc(message)}</h3><p>Измените период или сбросьте фильтры.</p><button class="button" data-action="reset">Сбросить фильтры</button></div>`;
  const panel=(title,body,sub='',action='')=>`<section class="panel"><div class="panel-header"><div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div>${action}</div>${body}</section>`;
  const button=(text,action,cls='')=>`<button class="button ${cls}" data-action="${action}">${text}</button>`;
  const option=(value,label,selected)=>`<option value="${esc(value)}"${String(value)===String(selected)?' selected':''}>${esc(label)}</option>`;
  const select=(name,label,options,selected=state[name])=>`<div class="field"><label for="filter-${name}">${esc(label)}</label><select id="filter-${name}" data-filter="${name}">${options.map(([v,l])=>option(v,l,selected)).join('')}</select></div>`;
  const budgetBar=s=>`<div class="budget-track" aria-label="${s.percent===null?'Процент не рассчитан':esc(s.percent.toFixed(1)+'% бюджета')}"><div class="budget-fill ${s.color}" style="width:${s.percent===null?0:Math.max(0,Math.min(100,s.percent))}%"></div></div>`;
  function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
  function documentTable(docs,limit=20){if(!docs.length)return empty();return table(['Документ','Дата','Получатель','Подразделение','Сумма','Состояние'],docs.slice(0,limit).map(d=>`<tr><td><button class="text-link" data-document="${d.id}">${esc(d.number)}</button><div class="cell-sub">${d.kind==='return'?'Возврат':'Выдача'}</div></td><td>${dateLabel(d.date)}<div class="cell-sub">${d.operation_at.slice(11,16)}</div></td><td>${esc(d.recipient_name)}</td><td><button class="text-link" data-entity="${d.object_id}">${esc(d.object_name)}</button></td><td class="num">${money(d.filteredTotal??d.total*(d.kind==='return'?-1:1),2)}</td><td>${pill('Проведён','green')}</td></tr>`));}
  function statCard(label,value,note,kind='chart'){return `<div class="stat-card"><div class="stat-label">${esc(label)}<span class="stat-icon">${icon(kind)}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;}
  function rankings(rows,kind){const max=Math.max(1,...rows.map(r=>r.total));return `<div class="panel-body">${rows.map((r,i)=>`<div class="rank-row"><div class="rank-label"><span class="muted small">${String(i+1).padStart(2,'0')}</span><button class="text-link" data-entity="${r.id}">${esc(r.name)}</button><span class="rank-value">${money(r.total)}</span></div><div class="rank-track"><div class="rank-fill" style="width:${Math.max(0,r.total)/max*100}%"></div></div></div>`).join('')}</div>`;}
  function trend(stats){if(!stats.lines.length)return empty();const dates=[...new Set(stats.lines.map(l=>l.document.date.slice(0,state.period==='year'?7:10)))].sort();const values=dates.map(date=>sum(stats.lines.filter(l=>l.document.date.startsWith(date))));const max=Math.max(1,...values),min=Math.min(0,...values),w=680,h=230,left=65,bottom=195,top=20,span=w-left-20,bw=Math.min(58,span/dates.length*.52),scale=v=>bottom-(v-min)/(max-min)*(bottom-top),zero=scale(0);let svg='';for(let i=0;i<=4;i++){const y=bottom-(bottom-top)*i/4;svg+=`<line x1="${left}" y1="${y}" x2="660" y2="${y}" stroke="#e5ebf3"/><text x="${left-10}" y="${y+4}" text-anchor="end" fill="#687b93" font-size="11">${Math.round((min+(max-min)*i/4)/100).toLocaleString('ru-RU')}</text>`;}dates.forEach((d,i)=>{const x=left+span*(i+.5)/dates.length,valueY=scale(values[i]),barY=Math.min(zero,valueY),bh=Math.abs(zero-valueY);svg+=`<rect x="${x-bw/2}" y="${barY}" width="${bw}" height="${bh}" rx="5" fill="#2563eb"><title>${esc(d)}: ${esc(money(values[i]))}</title></rect><text x="${x}" y="218" text-anchor="middle" fill="#687b93" font-size="11">${esc(d.length===7?d.slice(5):d.slice(8)+'.'+d.slice(5,7))}</text>`;});return `<div class="panel-body"><div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Расходы по датам в рублях">${svg}</svg></div><div class="chart-legend"><span><i class="legend-dot" style="background:#2563eb"></i>Расходы за вычетом возвратов, ₽</span></div></div>`;}
  function dashboard(){const f=effective(),s=aggregate(data,f),b=budgetReport(data,f);const budgetNote=b.hidden?'Уберите несопоставимые фильтры':b.complete?`Остаток ${money(b.plan-b.fact)}`:'Бюджет заполнен частично';const cards=statCard('Расходы за период',money(s.total),`${s.issues} выдач · ${s.returns} возвратов`)+statCard('Запчасти и материалы',money(s.groups[0].total),'С учётом возвратов','box')+statCard('Топливо и газ',money(s.groups[1].total+s.groups[2].total),'Стоимость выданных ресурсов','fuel')+statCard('Бюджет выбранных месяцев',b.hidden?'—':money(b.plan),budgetNote,'chart');const budgetBody=b.hidden?`<div class="panel-body muted">${esc(b.reason)}</div>`:`<div class="panel-body">${b.rows.map(r=>{const bs=budgetStatus(r.plan,r.fact,r.complete);return `<div class="budget-summary"><div class="status-row"><button class="text-link" data-entity="${r.id}">${esc(r.name)}</button>${pill(bs.label,bs.color)}</div><div class="status-row small"><span>${money(r.fact)} <span class="muted">из ${money(r.plan)}</span></span><span>${bs.percent===null?'—':bs.percent.toFixed(1)+'%'}</span></div>${budgetBar(bs)}</div>`;}).join('')}</div>`;return `<div class="stats-grid">${cards}</div><div class="grid-two">${panel('Динамика расходов',trend(s),'По выбранному периоду')}${panel('Исполнение бюджета',budgetBody,'Факт полных месяцев / план',button('Все бюджеты','budgets','ghost'))}</div><div class="grid-two">${panel('Расходы по подразделениям',rankings(s.byObject,'objects'),'Рейтинг по стоимости')}${panel('Топ получателей',rankings(s.byPerson,'recipients'),'Рейтинг по сумме выдачи')}</div>${panel('Последние операции',documentTable(journalRows(data,f),5),'Выдачи и возвраты',button('Весь журнал','journal','ghost'))}`;}
  function pagination(total,size){const pages=Math.max(1,Math.ceil(total/size));return `<div class="pagination"><span class="muted small">${total} записей · страница ${state.page} из ${pages}</span><div class="button-row"><button class="button" data-page="${state.page-1}"${state.page<=1?' disabled':''}>Назад</button><button class="button" data-page="${state.page+1}"${state.page>=pages?' disabled':''}>Далее</button></div></div>`;}
  function journal(){const docs=journalRows(data,effective()),size=10;return `<div class="toolbar"><label class="sr-only" for="journal-search">Поиск по журналу</label><input class="search-input" id="journal-search" data-search="q" placeholder="Документ, получатель или ресурс" value="${esc(state.q)}">${select('sort','Сортировка',[['date_desc','Сначала новые'],['date_asc','Сначала старые'],['amount_desc','Сумма по убыванию'],['amount_asc','Сумма по возрастанию']])}</div><section class="panel">${documentTable(docs.slice((state.page-1)*size,state.page*size))}${pagination(docs.length,size)}</section>`;}
  function objectView(){const s=aggregate(data,effective()),b=budgetReport(data,effective());const rows=s.byObject.filter(o=>matches(o.id,state.object)&&matches(o.type,state.type)&&o.name.toLowerCase().includes(state.catalogSearch.toLowerCase()));return `<div class="toolbar"><label class="sr-only" for="catalog-search">Поиск подразделения</label><input class="search-input" id="catalog-search" data-search="catalogSearch" placeholder="Название подразделения" value="${esc(state.catalogSearch)}"></div><div class="object-grid">${rows.map(o=>{const budget=b.rows?.find(x=>x.id===o.id),bs=budget&&budgetStatus(budget.plan,budget.fact,budget.complete);return `<section class="object-card"><div class="object-meta">${icon(o.type==='vehicle'?'box':'building')}${esc(typeNames[o.type])}</div><h2><button class="text-link" data-entity="${o.id}">${esc(o.name)}</button></h2><div class="muted small">${esc(o.plate||o.code)}</div><div class="object-total">${money(o.total)}</div><div class="small muted">Расходы за выбранный период</div><div class="object-breakdown">${Object.keys(articleNames).map(a=>`<div class="status-row small"><span>${esc(a==='materials'?'Материалы':articleNames[a])}</span><b>${money(o[a])}</b></div>`).join('')}</div>${budget?`${pill(bs.label,bs.color)}${budgetBar(bs)}<div class="small muted">План ${money(budget.plan)} · факт месяца ${money(budget.fact)}</div>`:''}<button class="button" data-entity="${o.id}">Подробнее ${icon('arrow')}</button></section>`;}).join('')||empty()}</div>`;}
  function catalog(kind){const isFuel=state.view==='fuel';let rows=data[kind].filter(r=>[r.name,r.code,r.position].join(' ').toLowerCase().includes(state.catalogSearch.toLowerCase()));if(kind==='resources')rows=rows.filter(r=>isFuel?['fuel','gas'].includes(r.group):['part','material'].includes(r.group));const stats=aggregate(data,effective());const body=kind==='recipients'?table(['Код','ФИО','Должность','Расходы за период','Состояние'],rows.map(r=>`<tr><td class="muted">${r.code}</td><td><button class="text-link" data-entity="${r.id}">${esc(r.name)}</button></td><td>${esc(r.position)}</td><td class="num">${money(stats.byPerson.find(p=>p.id===r.id)?.total||0)}</td><td>${pill('Активен','green')}</td></tr>`)):table(['Код','Наименование','Группа','Единица','Цена','Состояние'],rows.map(r=>`<tr><td class="muted">${r.code}</td><td><button class="text-link" data-resource="${r.id}">${esc(r.name)}</button></td><td>${esc(groupNames[r.group])}</td><td>${esc(r.unit)}</td><td class="num">${money(r.price,2)}</td><td>${pill('Активен','green')}</td></tr>`));return `<div class="toolbar"><label class="sr-only" for="catalog-search">Поиск в справочнике</label><input class="search-input" id="catalog-search" data-search="catalogSearch" placeholder="${kind==='recipients'?'ФИО или код':'Название или код ресурса'}" value="${esc(state.catalogSearch)}"><span class="muted small">${rows.length} записей</span></div><section class="panel">${rows.length?body:empty('Записей не найдено')}</section>`;}
  function fuel(){const tabs=`<div class="section-tabs" role="group" aria-label="Раздел топлива">${[['analytics','Аналитика'],['journal','Выдачи'],['catalog','Справочник']].map(([v,l])=>`<button class="${state.tab===v?'active':''}" data-tab="${v}">${l}</button>`).join('')}</div>`;if(state.tab==='journal')return tabs+journal();if(state.tab==='catalog')return tabs+catalog('resources');const rows=fuelRows(data,effective());const cards=data.resources.filter(r=>['fuel','gas'].includes(r.group)).map(r=>{const ls=rows.filter(x=>x.resource.id===r.id);return `<div class="fuel-card"><div class="stat-label">${esc(r.name)}${icon('fuel')}</div><div class="stat-value">${quantity(ls.reduce((v,x)=>v+x.issued-x.returned,0))} <span class="small muted">${r.unit}</span></div><div class="stat-note">Стоимость: ${money(sum(ls,'total'))}</div></div>`;}).join('');const body=table(['Подразделение','Топливо','Выдано','Возвращено','Чистый объём','Стоимость'],rows.map(r=>`<tr><td><button class="text-link" data-entity="${r.object.id}">${esc(r.object.name)}</button></td><td>${esc(r.resource.name)}</td><td class="num">${quantity(r.issued)} ${r.resource.unit}</td><td class="num">${quantity(r.returned)} ${r.resource.unit}</td><td class="num">${quantity(r.issued-r.returned)} ${r.resource.unit}</td><td class="num">${money(r.total)}</td></tr>`));return tabs+`<div class="fuel-grid">${cards}</div>`+panel('Топливо и газ по подразделениям',rows.length?body:empty(),'Объёмы разных видов топлива показаны отдельно');}
  function budgets(){const b=budgetReport(data,effective());if(b.hidden)return `<div class="demo-notice">${esc(b.reason)}</div>`;const cards=b.rows.map(r=>{const s=budgetStatus(r.plan,r.fact,r.complete);return `<section class="object-card"><h2><button class="text-link" data-entity="${r.id}">${esc(r.name)}</button></h2>${pill(s.label,s.color)}<div class="object-total">${money(r.fact)}</div><p class="muted small">из ${money(r.plan)} бюджета</p>${budgetBar(s)}<div class="status-row small"><span>Остаток</span><strong>${s.remaining===null?'—':money(s.remaining)}</strong></div><div class="small muted">Заполнено статей: ${r.filled} / ${r.expected}</div></section>`;}).join('');const detail=b.rows.flatMap(r=>r.detail.map(d=>{const s=budgetStatus(d.plan,d.fact,d.plan!==null);return `<tr><td>${esc(r.name)}<div class="cell-sub">${esc(monthLabel(d.month))}</div></td><td>${esc(articleNames[d.article])}</td><td class="num">${d.plan===null?'Не задан':money(d.plan)}</td><td class="num">${money(d.fact)}</td><td class="num">${s.remaining===null?'—':money(s.remaining)}</td><td>${pill(s.label,s.color)}</td></tr>`;}));return `<div class="demo-notice">Бюджет сравнивается с расходами за полные выбранные месяцы. Незаполненная статья не равна нулевому лимиту.</div><div class="object-grid">${cards}</div>${panel('План и факт по статьям',detail.length?table(['Объект / месяц','Статья','Бюджет','Факт','Остаток','Состояние'],detail):empty())}`;}
  function reports(){const rows=filterLines(data,effective(),false).sort((a,b)=>b.document.operation_at.localeCompare(a.document.operation_at));const content=table(['Документ','Дата','Получатель','Подразделение','Ресурс','Количество','Цена','Сумма'],rows.map(l=>`<tr><td><button class="text-link" data-document="${l.document.id}">${esc(l.document.number)}</button><div class="cell-sub">${l.document.kind==='return'?'Возврат':'Выдача'}</div></td><td>${dateLabel(l.document.date)}</td><td>${esc(l.document.recipient_name)}</td><td>${esc(l.document.object_name)}</td><td>${esc(l.name)}<div class="cell-sub">${esc(groupNames[l.group])}</div></td><td class="num">${quantity(l.netQty)} ${l.unit}</td><td class="num">${money(l.price,2)}</td><td class="num">${money(l.amount,2)}</td></tr>`));return panel('Детальный отчёт',rows.length?content:empty(),`Строк: ${rows.length} · итог: ${money(sum(rows),2)}`);}
  function filterUI(){return `<section class="filters" aria-label="Фильтры"><div class="filters-main"><div class="period-tabs" role="group" aria-label="Период">${[['day','День'],['week','Неделя'],['month','Месяц'],['year','Год'],['custom','Период']].map(([p,l])=>`<button class="${state.period===p?'active':''}" data-period="${p}">${l}</button>`).join('')}</div><div class="filter-dates"><button class="button icon period-step" data-step="-1" aria-label="Предыдущий период">‹</button><div class="field"><label for="date-from">С</label><input id="date-from" type="date" data-filter="from" value="${state.from}"></div><div class="field"><label for="date-to">По</label><input id="date-to" type="date" data-filter="to" value="${state.to}"></div><button class="button icon period-step" data-step="1" aria-label="Следующий период">›</button></div></div><div class="filters-fields">${select('object','Подразделение',[['all','Все подразделения'],...data.objects.map(o=>[o.id,o.name])])}${select('recipient','Получатель',[['all','Все получатели'],...data.recipients.map(p=>[p.id,p.name])])}${select('group','Статья',[['all','Все статьи'],['materials','Запчасти и материалы'],['fuel','Жидкое топливо'],['gas','Газ']])}${select('resource','Ресурс',[['all','Все ресурсы'],...data.resources.map(r=>[r.id,r.name])])}${button('Сбросить','reset','ghost')}</div></section>`;}
  function render(){const title=nav.find(n=>n[0]===state.view)[1];const descriptions={dashboard:'Материалы, топливо и газ — в разрезе подразделений',journal:'История выдач и возвратов с учётными ценами',fuel:'Выданные объёмы и стоимость по каждому виду топлива',objects:'Автомобили, здания и другие объекты затрат',recipients:'Расходы по водителям и получателям',resources:'Демонстрационный справочник и учётные цены',budgets:'План, факт и остаток по каждой статье расходов',reports:'Детализация выдачи по строкам документов'};const views={dashboard,journal,fuel,objects:objectView,recipients:()=>catalog('recipients'),resources:()=>catalog('resources'),budgets,reports};const body=views[state.view]();document.getElementById('app').innerHTML=`<div class="app-shell${state.mobile?' sidebar-open':''}"><button class="mobile-scrim" data-action="menu" aria-label="Закрыть меню"></button><aside class="sidebar" aria-label="Главное меню"><a class="brand" href="#dashboard" data-nav="dashboard"><span class="brand-mark">${icon('box')}</span><span><span class="brand-title">ЦМС</span><span class="brand-sub">Учёт ресурсов</span></span></a><div class="nav-heading">Рабочее пространство</div><nav>${nav.map(([id,label,ic])=>`<button class="nav-button${state.view===id?' active':''}" data-nav="${id}"${state.view===id?' aria-current="page"':''}><span class="nav-icon">${icon(ic)}</span>${label}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="small">Открытая демонстрация</div><p>Вымышленные примеры<br>Без регистрации</p><div class="side-status">${icon('shield')} Только просмотр</div></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb"><button class="mobile-toggle button icon" data-action="menu" aria-label="Открыть меню" aria-expanded="${state.mobile}">${icon('menu')}</button><span>Предприятие</span>${icon('chevron')}<strong>${title}</strong></div><div class="topbar-right">${pill('Демоверсия','blue')}<span class="small muted">Гостевой доступ</span></div></header><main id="main-content" class="content"><div class="page-heading"><div><h1>${title}</h1><p>${descriptions[state.view]}</p></div><div class="heading-actions">${button(icon('download')+' Скачать Excel','export','primary')}</div></div><div class="demo-notice">${icon('shield')}<span>Примеры вымышлены, цены условные. Изучайте разделы, меняйте фильтры и скачивайте отчёты. Рабочие данные предприятия не подключены.</span></div>${filterUI()}<div id="view-content">${body}</div><footer class="footer"><span>ЦМС · Учёт выдачи ресурсов</span><span>₽ · Учётные цены с НДС · Камчатка (UTC+12)</span></footer></main></div></div>`;}
  function openDialog(title,body){const dialog=document.getElementById('detail-dialog');dialog.innerHTML=`<div class="dialog-header"><h2 id="detail-title">${esc(title)}</h2><button class="dialog-close button icon" data-action="close" aria-label="Закрыть">${icon('close')}</button></div>${body}`;if(!dialog.open)dialog.showModal();}
  function openDocument(id){const d=data.documents.find(x=>x.id===id);if(!d)return;const rows=d.lines.map(l=>`<tr><td>${esc(l.name)}<div class="cell-sub">${l.code} · ${esc(groupNames[l.group])}</div></td><td class="num">${quantity(l.qty)} ${l.unit}</td><td class="num">${money(l.price,2)}</td><td class="num">${money(l.amount,2)}</td></tr>`);openDialog(`${d.kind==='return'?'Возврат':'Выдача'} ${d.number}`,`<div class="detail-grid"><div><span class="small muted">Дата операции</span><p>${dateLabel(d.date)} · ${d.operation_at.slice(11,16)}</p></div><div><span class="small muted">Состояние</span><p>${pill('Проведён','green')}</p></div><div><span class="small muted">Получатель</span><p>${esc(d.recipient_name)}</p></div><div><span class="small muted">Подразделение</span><p>${esc(d.object_name)}</p></div></div><div class="detail-note">Демонстрационный документ. Автор: ${esc(d.author_name)}.</div>${table(['Ресурс','Количество','Цена','Сумма'],rows)}<div class="dialog-total"><span>${d.kind==='return'?'Уменьшение расходов':'Итого'}</span><strong>${money(d.total*(d.kind==='return'?-1:1),2)}</strong></div>${d.original_id?`<button class="button" data-document="${d.original_id}">Открыть исходную выдачу</button>`:''}`);}
  function openEntity(id){const object=data.objects.find(x=>x.id===id),person=data.recipients.find(x=>x.id===id),entity=object||person;if(!entity)return;const f={...effective(),...(object?{object:id}:{recipient:id})},s=aggregate(data,f),b=budgetReport(data,f),br=b.rows?.find(x=>x.id===id);openDialog(entity.name,`<p class="muted">${esc(entity.plate||entity.position||entity.code)} · ${dateLabel(state.from)} — ${dateLabel(state.to)}</p><div class="metric-grid">${statCard('Расходы за период',money(s.total),`${s.issues} выдач · ${s.returns} возвратов`)}${br?statCard('План выбранных месяцев',money(br.plan),br.complete?`Остаток: ${money(br.plan-br.fact)}`:'Заполнен частично'):''}</div><div class="detail-note">${s.groups.map(g=>`${esc(g.name)}: <b>${money(g.total)}</b>`).join(' · ')}</div>${documentTable(journalRows(data,f))}`);}
  function openResource(id){const r=data.resources.find(x=>x.id===id);if(!r)return;openDialog(r.name,`<div class="detail-grid"><div><span class="muted small">Код</span><p>${r.code}</p></div><div><span class="muted small">Группа</span><p>${esc(groupNames[r.group])}</p></div><div><span class="muted small">Единица</span><p>${r.unit}</p></div><div><span class="muted small">Учётная цена с НДС</span><p>${money(r.price,2)}</p></div></div><div class="modal-actions"><button class="button primary" data-resource-journal="${r.id}">Выдачи этого ресурса ${icon('arrow')}</button></div>`);}
  let toastTimer;
  function notify(message){const node=document.getElementById('toast');node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true;},4000);}
  function reset(){const dates=periodRange('month',data.today);Object.assign(state,{period:'month',from:dates[0],to:dates[1],object:'all',recipient:'all',group:'all',resource:'all',type:'all',kind:'all',status:'all',q:'',catalogSearch:'',page:1});render();}
  function navigate(view){if(!nav.some(n=>n[0]===view))return;state.view=view;state.page=1;state.q='';state.catalogSearch='';state.mobile=false;state.tab='analytics';history.replaceState(null,'','#'+view);render();}
  async function download(){try{async function* rows(){yield* exportRows(data,effective());}const blob=await new Response(CMSExcel.streamWorkbook(rows())).blob();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`CMS-demo-${state.from}-${state.to}.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Отчёт Excel скачан');}catch(error){console.error(error);notify('Не удалось скачать отчёт. Попробуйте ещё раз.');}}
  function shiftRange(period,from,to,direction){const d=new Date(from+'T12:00:00Z');if(period==='custom'){const end=new Date(to+'T12:00:00Z'),days=Math.round((end-d)/86400000)+1;d.setUTCDate(d.getUTCDate()+direction*days);end.setUTCDate(end.getUTCDate()+direction*days);return [iso(d),iso(end)];}if(period==='year')d.setUTCFullYear(d.getUTCFullYear()+direction);else if(period==='month')d.setUTCMonth(d.getUTCMonth()+direction);else d.setUTCDate(d.getUTCDate()+direction*(period==='week'?7:1));return periodRange(period,iso(d));}
  function stepPeriod(direction){[state.from,state.to]=shiftRange(state.period,state.from,state.to,direction);state.page=1;render();}
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&iso(new Date(value+'T12:00:00Z'))===value;}
  function bind(){document.addEventListener('click',event=>{const el=event.target.closest('button,a');if(!el)return;if(el.dataset.nav){event.preventDefault();navigate(el.dataset.nav);}else if(el.dataset.document)openDocument(el.dataset.document);else if(el.dataset.entity)openEntity(el.dataset.entity);else if(el.dataset.resource)openResource(el.dataset.resource);else if(el.dataset.resourceJournal){state.resource=el.dataset.resourceJournal;document.getElementById('detail-dialog').close();navigate('journal');}else if(el.dataset.period){state.period=el.dataset.period;if(state.period!=='custom')[state.from,state.to]=periodRange(state.period,data.today);state.page=1;render();}else if(el.dataset.step)stepPeriod(Number(el.dataset.step));else if(el.dataset.page){state.page=Number(el.dataset.page);render();}else if(el.dataset.tab){state.tab=el.dataset.tab;state.page=1;state.catalogSearch='';render();}else if(el.dataset.action==='reset')reset();else if(el.dataset.action==='export')download();else if(el.dataset.action==='close')document.getElementById('detail-dialog').close();else if(el.dataset.action==='menu'){state.mobile=!state.mobile;render();}else if(el.dataset.action)navigate(el.dataset.action);});
    document.addEventListener('change',event=>{const name=event.target.dataset.filter;if(!name)return;const value=event.target.value;if(name==='from'||name==='to'){if(!validDate(value)){notify('Укажите корректную дату');render();return;}const from=name==='from'?value:state.from,to=name==='to'?value:state.to;if(from>to){notify('Начало периода не может быть позже окончания');render();return;}if((Number(to.slice(0,4))-Number(from.slice(0,4)))*12+Number(to.slice(5,7))-Number(from.slice(5,7))>=120){notify('Выберите период короче 10 лет');render();return;}state.period='custom';}state[name]=value;state.page=1;render();});
    let searchTimer;document.addEventListener('input',event=>{const key=event.target.dataset.search;if(!key)return;const value=event.target.value,id=event.target.id,position=event.target.selectionStart;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state[key]=value;state.page=1;render();const next=document.getElementById(id);next?.focus();next?.setSelectionRange(position,position);},180);});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.mobile){state.mobile=false;render();}});
    const dialog=document.getElementById('detail-dialog');dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
    window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(nav.some(n=>n[0]===view)&&view!==state.view)navigate(view);});
  }
  const engine={seed,periodRange,shiftRange,monthsBetween,filterLines,aggregate,budgetReport,budgetStatus,journalRows,fuelRows,exportRows,validDate,lineAmount,localDay,esc,renderViews:{dashboard,journal,fuel,objectView,catalog,budgets,reports},state,data,streamWorkbook:CMSExcel.streamWorkbook};
  if(typeof module!=='undefined'&&module.exports)module.exports=engine;
  if(typeof document==='undefined')return;
  const initial=location.hash.slice(1);if(nav.some(n=>n[0]===initial))state.view=initial;
  bind();render();const requested=new URLSearchParams(location.search).get('document');if(requested)openDocument(requested);
})();
