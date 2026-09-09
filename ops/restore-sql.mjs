import {readFileSync,writeFileSync} from 'node:fs';
const [input,output]=process.argv.slice(2);
if(!input||!output){console.error('Usage: node ops/restore-sql.mjs backup.json restore.sql');process.exit(1)}
const data=JSON.parse(readFileSync(input,'utf8'));
if(data.format!=='cms-backup-v1')throw new Error('Unknown backup format');
const quote=x=>x==null?'NULL':typeof x==='number'?(Number.isSafeInteger(x)?String(x):(()=>{throw new Error('Invalid numeric value')})()):"'"+String(x).replaceAll("'","''")+"'";
const tables=['workspaces','users','recipients','objects','resources','documents','lines','budgets','audit','receipts'];
let sql='-- Restore only into a NEW EMPTY database after schema migrations. Never run against live data.\n';
for(const table of tables){const rows=data.tables[table];if(!Array.isArray(rows))throw new Error('Missing table '+table);for(const row of rows){const keys=Object.keys(row);if(!keys.every(k=>/^[a-z_]+$/.test(k)))throw new Error('Invalid column');sql+=`INSERT INTO "${table}" (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map(k=>quote(row[k])).join(',')});\n`}}
sql+='PRAGMA foreign_key_check;\n';
writeFileSync(output,sql,{mode:0o600});console.log(`Prepared ${output}; restore into a new empty database only.`);
