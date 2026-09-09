import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {streamWorkbook} from '../.test-output/server.mjs';
const started=performance.now();let peak=0;
async function* rows(){yield ['Тест объёма'];yield ['2026-09'];yield ['RUB'];yield ['Документ','Получатель','Объект','Ресурс','Количество','Единица','Цена','Сумма'];for(let i=0;i<100000;i++){if(i%1000===0)peak=Math.max(peak,process.memoryUsage().heapUsed);yield ['В-'+i,'Иванов Иван Иванович','КАМАЗ 65115','Дизельное топливо',10,'л',75,750]}yield ['ИТОГО','','','','','','',75000000]}
await pipeline(Readable.fromWeb(streamWorkbook(rows())),createWriteStream('.test-output/100k.xlsx'));
console.log(JSON.stringify({rows:100000,seconds:(performance.now()-started)/1000,peakHeapMB:peak/1024/1024}));
