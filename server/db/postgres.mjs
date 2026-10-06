import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {hash,fail,scoped} from '../domain.mjs';
import {recoverAdmin} from '../recovery.mjs';
import {tables,byName,hydrate,flatten,empty} from './records.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex');
const business=['developers','products','product_conditions','product_photos','lands','land_photos','sales','entry_installments','commission_installments','goals','land_history','sale_history','commission_history'];
const security=['users','sessions','login_attempts','invitations','password_resets','reset_requests','admin_recoveries'];
const initializations=new WeakMap();
export async function initialize(pool,env=process.env){
 const companyId=env.COMPANY_ID||'main';let pending=initializations.get(pool);if(!pending){pending=new Map();initializations.set(pool,pending);}if(pending.has(companyId))return pending.get(companyId);
 const promise=(async()=>{const c=await pool.connect();try{
  await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(764240)");
  await c.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
  await c.query('CREATE TABLE IF NOT EXISTS patrimonio.schema_versions (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const created=await c.query('INSERT INTO patrimonio.companies(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[companyId,env.COMPANY_NAME||'Minha imobiliária']);
  if(created.rowCount){
   const email=String(env.ADMIN_EMAIL||'').trim().toLowerCase(),password=String(env.ADMIN_PASSWORD||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>128)throw Error('Configure ADMIN_EMAIL e ADMIN_PASSWORD (12 a 128 caracteres) para inicializar a empresa.');
   await c.query('INSERT INTO patrimonio.users(company_id,id,name,email,password_hash,role,active) VALUES($1,$2,$3,$4,$5,$6,true)',[companyId,'u1',env.ADMIN_NAME||'Administrador',email,hash(password),'Gestor']);
   if(env.ADMIN_RECOVERY_ID)await c.query('INSERT INTO patrimonio.admin_recoveries(company_id,request_hash) VALUES($1,$2)',[companyId,digest(String(env.ADMIN_RECOVERY_ID).trim())]);
  }
  const version=await c.query('INSERT INTO patrimonio.schema_versions(version) VALUES(2) ON CONFLICT DO NOTHING RETURNING version');
  // The owner authorized discarding all legacy demo data. Never touch unrelated tables.
  if(version.rowCount)await c.query('DROP TABLE IF EXISTS public.lotea_state');
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}})();
 pending.set(companyId,promise);try{await promise;}catch(e){pending.delete(companyId);throw e;}
}
function selected(action){
 if(action==='state')return [...business,'users','sessions','invitations','audit_events'];
 if(action==='login')return [...security,'audit_events'];
 if(action==='info')return [];
 if(action.startsWith('invite.')||action.startsWith('password.')||action==='logout'||action==='user.save')return [...security,'audit_events'];
 if(action==='goals.save')return ['users','sessions','goals','audit_events'];
 if(action==='developer.save')return ['users','sessions','developers','audit_events'];
 if(action==='product.save')return ['users','sessions','developers','products','product_conditions','product_photos','audit_events'];
 if(action.startsWith('land.'))return ['users','sessions','lands','land_photos','land_history','audit_events'];
 if(action.startsWith('sale.')||action==='entry.pay'||action==='commission.receive')return ['users','sessions','developers','products','product_conditions','product_photos','sales','entry_installments','commission_installments','sale_history','commission_history','audit_events'];
 return ['users','sessions'];
}
export class Repository {
 constructor(client,companyId){this.c=client;this.companyId=companyId;}
 async query(sql,values=[]){return this.c.query(sql,[this.companyId,...values]);}
 async load(names,body={}){
  const rows={};
  for(const name of [...new Set(names)]){
   let suffix='',args=[];
   if(name==='audit_events')suffix=' ORDER BY at DESC,id DESC LIMIT 500';
   else if(name.endsWith('_history'))suffix=' ORDER BY at DESC,id DESC';
   else if(name==='sales')suffix=' ORDER BY created_at DESC,id DESC';
   else if(name==='entry_installments'||name==='commission_installments')suffix=' ORDER BY number';
   else if(name==='login_attempts')suffix=" AND attempted_at>now()-interval '15 minutes'";
   else if(name==='reset_requests')suffix=" AND requested_at>now()-interval '1 hour'";
   // Mutations load only the affected sale and its children. Dashboard loads the company's view.
   const sid=body.action==='sale.create'?null:body.data?.saleId||body.data?.id;
   if((body.action?.startsWith('sale.')||body.action==='entry.pay'||body.action==='commission.receive')&&['sales','entry_installments','commission_installments','sale_history','commission_history'].includes(name)){
    if(body.action==='sale.create')suffix=' AND false';
    else if(name==='commission_history'){suffix=' AND commission_id IN (SELECT id FROM patrimonio.commission_installments WHERE company_id=$1 AND sale_id=$2)'+suffix;args=[sid||''];}
    else {suffix=` AND ${name==='sales'?'id':'sale_id'}=$2`+suffix;args=[sid||''];}
   }
   rows[name]=(await this.query(`SELECT *,xmin::text AS _revision FROM patrimonio.${name} WHERE company_id=$1${suffix}`,args)).rows;
  }
  return rows;
 }
 async save(before,db){
  const after=flatten(db),key=(t,r)=>JSON.stringify(t.key.map(k=>r[k]));
  // Delete children first, and only rows present in this transaction's loaded set.
  for(const t of [...tables].reverse()){
   const next=new Set(after[t.name].map(r=>key(t,r)));
   for(const old of before[t.name]||[])if(!next.has(key(t,old))){const where=t.key.map((k,i)=>`${k}=$${i+2}`).join(' AND ');const result=await this.query(`DELETE FROM patrimonio.${t.name} WHERE company_id=$1 AND ${where} AND xmin::text=$${t.key.length+2}`,[...t.key.map(k=>old[k]),old._revision]);if(!result.rowCount)fail('Este registro foi alterado por outra pessoa. Atualize a página e tente novamente.',409);}
  }
  for(const t of tables){
   const previous=new Map((before[t.name]||[]).map(r=>[key(t,r),r]));
   for(const row of after[t.name]){
    const old=previous.get(key(t,row));
    if(old){
     const normalized=t.encode(t.decode(old));
     const changed=Object.keys(row).filter(k=>!t.key.includes(k)&&JSON.stringify(row[k])!==JSON.stringify(normalized[k]));
     if(!changed.length)continue;
     const values=changed.map(k=>row[k]),where=t.key.map((k,i)=>`${k}=$${values.length+i+2}`).join(' AND ');
     const result=await this.query(`UPDATE patrimonio.${t.name} SET ${changed.map((k,i)=>`${k}=$${i+2}`).join(',')} WHERE company_id=$1 AND ${where} AND xmin::text=$${values.length+t.key.length+2}`,[...values,...t.key.map(k=>row[k]),old._revision]);
     if(!result.rowCount)fail('Este registro foi alterado por outra pessoa. Atualize a página e tente novamente.',409);
    }else{
     const keys=Object.keys(row).filter(k=>!(k==='id'&&row[k]===null));
     await this.query(`INSERT INTO patrimonio.${t.name}(company_id,${keys.join(',')}) VALUES($1,${keys.map((_,i)=>'$'+(i+2)).join(',')})`,keys.map(k=>row[k]));
    }
   }
  }
 }
}
export async function runTransaction(pool,fn,{req={headers:{}},body={action:'state'},env=process.env}={}){
 await initialize(pool,env);const c=await pool.connect(),companyId=env.COMPANY_ID||'main',action=body.action||'';
 try{
  await c.query(action==='state'?'BEGIN ISOLATION LEVEL REPEATABLE READ':'BEGIN');const repo=new Repository(c,companyId);
  const recoveryPending=env.ADMIN_RECOVERY_ID&&!(await repo.query('SELECT 1 FROM patrimonio.admin_recoveries WHERE company_id=$1 AND request_hash=$2',[digest(String(env.ADMIN_RECOVERY_ID).trim())])).rowCount;
  const authAction=action==='login'||action==='logout'||action==='user.save'||action.startsWith('invite.')||action.startsWith('password.');
  const locks=[];
  if(authAction||recoveryPending)locks.push('security');
  if(action.startsWith('sale.')||action==='entry.pay'||action==='commission.receive')locks.push(action==='sale.create'?'product:'+body.data?.productId:'sale:'+(body.data?.saleId||body.data?.id));
  if(action==='product.save')locks.push('product:'+(body.data?.id||'new'));
  if(action.startsWith('land.'))locks.push('lands');
  if(action==='goals.save')locks.push('goal:'+body.data?.type+':'+body.data?.period);
  if(action==='developer.save')locks.push('developer:'+(body.data?.id||'new'));
  for(const lock of locks.sort())await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[companyId+':'+lock]);
  if(recoveryPending){const rows=await repo.load([...security,'audit_events']),db=hydrate(rows);recoverAdmin(db,env);await repo.save(rows,db);}
  if(action==='info'){await c.query('COMMIT');return {demo:false,registration:'invite',storage:'postgres-relational',schemaVersion:2};}
  const publicActions=['login','invite.inspect','invite.accept','password.request','password.inspect','password.reset'];
  if(!publicActions.includes(action)){
   const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('lotea_session='))?.split('=')[1];
   const principal=await repo.query('SELECT u.id FROM patrimonio.sessions s JOIN patrimonio.users u ON u.company_id=s.company_id AND u.id=s.user_id WHERE s.company_id=$1 AND s.token_hash=$2 AND s.expires_at>now() AND u.active FOR SHARE OF u',[digest(cookie||'')]);
   if(!principal.rowCount)fail('Entre para acessar sua conta.',401);
  }
  if(authAction){
   await repo.query("DELETE FROM patrimonio.login_attempts WHERE company_id=$1 AND attempted_at<now()-interval '15 minutes'");
   await repo.query("DELETE FROM patrimonio.reset_requests WHERE company_id=$1 AND requested_at<now()-interval '1 hour'");
   await repo.query('DELETE FROM patrimonio.sessions WHERE company_id=$1 AND expires_at<now()');
   await repo.query('DELETE FROM patrimonio.password_resets WHERE company_id=$1 AND expires_at<now()');
  }
  const rows=await repo.load(selected(action),body),db=hydrate(rows);
  const result=await fn(db);
  if(action!=='state')await repo.save(rows,db);
  // Keep the existing UI response contract; ordinary writes affect only changed rows.
  // Full dashboard projection is a read, scoped to the server-selected company.
  let response=result;
  if(result.user&&action!=='state'){
   const state=hydrate(await repo.load([...business,'users','invitations','audit_events']));
   response={...result,...scoped(state,state.users.find(u=>u.id===result.user.id))};
  }
  await c.query('COMMIT');return response;
 }catch(e){await c.query('ROLLBACK');if(e.code==='40001'||e.code==='40P01')fail('Os dados mudaram durante esta operação. Atualize a página e tente novamente.',409);if(e.code==='23505')fail('Já existe um registro com esses dados. Atualize a página e confira o cadastro.',409);if(e.code==='23503'||e.code==='23514')fail('Os dados não respeitam os vínculos ou regras do banco. Confira os campos informados.',400);throw e;}finally{c.release();}
}
