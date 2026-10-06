import {recoverAdmin} from './recovery.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {seed} from './seed.mjs';
let pool,queue=Promise.resolve();
const filename=process.env.DATA_FILE||path.resolve('.data/lotea.json');
export async function transaction(fn){
if(process.env.DATABASE_URL){if(!pool){const {Pool}=await import('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,max:3});}const c=await pool.connect();try{await c.query('BEGIN');await c.query('CREATE TABLE IF NOT EXISTS lotea_state (id integer PRIMARY KEY, data jsonb NOT NULL)');await c.query('SELECT pg_advisory_xact_lock(764239)');let r=await c.query('SELECT data FROM lotea_state WHERE id=1 FOR UPDATE');let db=r.rows[0]?.data||seed();recoverAdmin(db);const result=await fn(db);await c.query('INSERT INTO lotea_state(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[JSON.stringify(db)]);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
if(process.env.VERCEL||process.env.NODE_ENV==='production')throw Error('Banco de dados não configurado. Defina DATABASE_URL.');
const task=queue.then(async()=>{let db;try{db=JSON.parse(await fs.readFile(filename,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;db=seed();}recoverAdmin(db);const result=await fn(db);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename+'.tmp',JSON.stringify(db),{mode:0o600});await fs.rename(filename+'.tmp',filename);return result;});queue=task.catch(()=>{});return task;
}
