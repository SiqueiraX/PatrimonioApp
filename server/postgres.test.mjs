import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool,types} from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {execute} from './api.mjs';
import {runTransaction,initialize,Repository} from './db/postgres.mjs';
import {hydrate} from './db/records.mjs';
types.setTypeParser(1082,v=>v);
const connectionString=process.env.TEST_DATABASE_URL;
test('PostgreSQL: records, workflows, constraints, tenant isolation, rollback and concurrent payments',{skip:!connectionString},async()=>{
 const pool=new Pool({connectionString,max:8}),company='test-'+randomUUID();
 const env={COMPANY_ID:company,ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:'AdminPassword1234'};
 let adminCookie,brokerCookie;
 const run=async(action,data={},cookie=adminCookie,extra={},companyEnv=env)=>{
  const req={headers:{cookie,'x-real-ip':'test-'+company}},headers={};const res={setHeader:(k,v)=>headers[k]=v};const body={action,data,...extra};
  const result=await runTransaction(pool,db=>execute(db,req,res,body),{req,body,env:companyEnv});
  return {result,cookie:headers['Set-Cookie']?.split(';')[0]};
 };
 try{
  const info=await run('info');assert.equal(info.result.storage,'postgres-relational');
  adminCookie=(await run('login',{},null,{email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})).cookie;assert.ok(adminCookie);
  const inv=(await run('invite.create',{email:'broker@example.com',role:'Corretor'})).result;
  await run('invite.accept',{token:inv.invitationToken,name:'Corretor',password:'BrokerPassword123'},null);
  await assert.rejects(run('invite.accept',{token:inv.invitationToken,name:'Again',password:'BrokerPassword123'},null));
  brokerCookie=(await run('login',{},null,{email:'broker@example.com',password:'BrokerPassword123'})).cookie;
  let state=(await run('state')).result,broker=state.users.find(u=>u.role==='Corretor');assert.equal(state.users.length,2);
  const sqlUser=await pool.query('SELECT email,password_hash FROM patrimonio.users WHERE company_id=$1 AND id=$2',[company,broker.id]);assert.equal(sqlUser.rows[0].email,'broker@example.com');assert.notEqual(sqlUser.rows[0].password_hash,'BrokerPassword123');
  state=(await run('developer.save',{name:'Loteadora',contact:'Contato'})).result;
  const developerId=state.developers[0].id;
  state=(await run('product.save',{name:'Bairro',location:'Sinop',developerId,percent:4,payDay:20,active:true,saleOptions:[{id:'entry','entryMode':'with',entryInstallments:2,commissionMode:'entry',commissionInstallments:2}],photos:[]})).result;
  const product=state.products[0];assert.equal(product.saleOptions.length,1);
  const sale={client:'Cliente de teste',contact:'Contato',productId:product.id,optionId:'entry',leadSource:'TikTok',block:'1',lot:'2',date:'2026-01-10',value:100000.01,contract:'Assinado',signedAt:'2026-01-10',initial:10000.01,initialDue:'2026-01-31',brokerId:broker.id};
  state=(await run('sale.create',sale,brokerCookie)).result;const s=state.sales[0];assert.equal(s.commissions.length,2);assert.equal(s.entryPayments.length,2);assert.equal(s.rule.percent,4);assert.equal(s.entryPayments[1].due,'2026-02-28');
  const persisted=await pool.query('SELECT client,value FROM patrimonio.sales WHERE company_id=$1',[company]);assert.equal(persisted.rows.length,1);assert.equal(persisted.rows[0].value,'100000.01');
  const originalXmin=(await pool.query('SELECT xmin::text FROM patrimonio.products WHERE company_id=$1 AND id=$2',[company,product.id])).rows[0].xmin;
  await run('entry.pay',{saleId:s.id,id:s.entryPayments[0].id,paidAt:'2026-01-31'},brokerCookie);
  await run('entry.pay',{saleId:s.id,id:s.entryPayments[1].id,paidAt:'2026-02-28'},brokerCookie);
  const concurrent=await Promise.all([run('commission.receive',{saleId:s.id,id:s.commissions[0].id,amount:100,receivedAt:'2026-02-20'}),run('commission.receive',{saleId:s.id,id:s.commissions[0].id,amount:200,receivedAt:'2026-02-20'})]);assert.equal(concurrent.length,2);
  state=(await run('state')).result;assert.equal(state.sales[0].commissions[0].received,300);assert.equal(state.sales[0].paidAt,'2026-02-28');
  assert.equal((await pool.query('SELECT xmin::text FROM patrimonio.products WHERE company_id=$1 AND id=$2',[company,product.id])).rows[0].xmin,originalXmin);
  const oldSchedule=JSON.stringify(state.sales[0].commissions);
  await run('product.save',{...product,percent:7,saleOptions:[{id:'none',entryMode:'none',entryInstallments:0,commissionMode:'fixed',commissionInstallments:12}]});
  state=(await run('state')).result;assert.equal(state.sales[0].rule.percent,4);assert.equal(JSON.stringify(state.sales[0].commissions),oldSchedule);
  await run('sale.update',{id:s.id,contract:'Assinado',signedAt:'2026-01-10',status:'Concluída',leadSource:'TikTok',notes:'Concluída'},brokerCookie);
  await run('sale.create',{...sale,client:'Sem entrada',optionId:'none'},brokerCookie);
  state=(await run('goals.save',{type:'month',period:'2026-01',individual:500000,team:1500000})).result;assert.equal(state.goals[0].individual,500000);assert.equal(state.sales[0].commissions.length,12);
  await assert.rejects(run('goals.save',{type:'month',period:'2026-01',individual:1,team:1},brokerCookie),e=>e.status===403);
  const land={neighborhood:'Bairro',block:'1',lot:'1',area:300,condition:'Quitado',price:100000,owner:'Dono',contact:'Contato',brokerId:broker.id,availability:'Disponível',photos:[]};
  await run('land.save',land,brokerCookie);await assert.rejects(run('land.save',land,brokerCookie));
  const other={...env,COMPANY_ID:'other-'+company};await run('info',{},null,{},other);
  const otherCookie=(await run('login',{},null,{email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD},other)).cookie;
  const otherState=(await run('state',{},otherCookie,{},other)).result;assert.equal(otherState.sales.length,0);assert.equal(otherState.users.length,1);
  await assert.rejects(run('sale.update',{...s,status:'Concluída'},otherCookie,{},other),e=>e.status===404);
  await assert.rejects(run('state',{},adminCookie,{},other),e=>e.status===401);
  await assert.rejects(pool.query("INSERT INTO patrimonio.products(company_id,id,developer_id,name,location,launch,construction,active,commission_percent,payment_day) VALUES($1,'cross',$2,'Cross','X',false,false,true,4,20)",[other.COMPANY_ID,developerId]),e=>e.code==='23503');
  await assert.rejects(pool.query('UPDATE patrimonio.commission_installments SET received=amount+1 WHERE company_id=$1 AND id=$2',[company,s.commissions[0].id]),e=>e.code==='23514');
  // Optimistic revision check also catches direct SQL edits from a second connection.
  const c=await pool.connect();try{await c.query('BEGIN');const repo=new Repository(c,company),before=await repo.load(['developers']);const db=hydrate(before);db.developers[0].contact='App edit';await pool.query('UPDATE patrimonio.developers SET contact=$1 WHERE company_id=$2 AND id=$3',['Manual edit',company,developerId]);await assert.rejects(repo.save(before,db),e=>e.status===409);await c.query('ROLLBACK');}finally{c.release();}
  // Password tokens remain one-use under concurrent attempts, and revoke prior sessions.
  const token='a'.repeat(64),tokenHash=createHash('sha256').update(token).digest('hex');
  await pool.query("INSERT INTO patrimonio.password_resets(company_id,token_hash,user_id,email,password_hash,expires_at) SELECT company_id,$2,id,email,password_hash,now()+interval '30 minutes' FROM patrimonio.users WHERE company_id=$1 AND id=$3",[company,tokenHash,broker.id]);
  const resets=await Promise.allSettled([run('password.reset',{token,password:'ChangedPassword123'},null),run('password.reset',{token,password:'AnotherPassword123'},null)]);assert.equal(resets.filter(r=>r.status==='fulfilled').length,1);
  await assert.rejects(run('state',{},brokerCookie),e=>e.status===401);
  const branding={name:'Imobiliária Teste',logoUrl:'',primaryColor:'#26345b',backgroundColor:'#fafafa',accentColor:'#cc9900'};
  await assert.rejects(run('branding.save',branding,brokerCookie),e=>e.status===401||e.status===403);
  const branded=(await run('branding.save',{...branding,companyId:other.COMPANY_ID})).result;assert.equal(branded.company.name,branding.name);
  assert.deepEqual((await run('info',{},null)).result.company,branding);
  assert.notEqual((await run('info',{},null,{},other)).result.company.name,branding.name);
  await assert.rejects(run('branding.save',{...branding,primaryColor:'red;display:none'}));
  // Profile columns persist independently and credentials rotate the active session.
  const profileData={name:'Administrador atualizado',email:'profile@example.com',cpf:'529.982.247-25',creci:'12345-F/MT',photo:'data:image/png;base64,iVBORw0KGgo=',currentPassword:env.ADMIN_PASSWORD,newPassword:'ProfilePassword123'};
  const profileResult=await run('profile.save',profileData);assert.ok(profileResult.cookie);const oldAdmin=adminCookie;adminCookie=profileResult.cookie;
  const storedProfile=(await pool.query('SELECT name,email,cpf,creci,photo_data_url FROM patrimonio.users WHERE company_id=$1 AND id=$2',[company,'u1'])).rows[0];assert.equal(storedProfile.cpf,'52998224725');assert.equal(storedProfile.creci,profileData.creci);assert.equal(storedProfile.photo_data_url,profileData.photo);
  await assert.rejects(run('state',{},oldAdmin),e=>e.status===401);assert.equal((await run('state')).result.user.cpf,'52998224725');
  // Operator recovery resets only access, not the company's business records.
  const recovered={...env,ADMIN_EMAIL:'recovered@example.com',ADMIN_PASSWORD:'RecoveredPassword123',ADMIN_RECOVERY_ID:'operator-'+company};
  await run('info',{},null,{},recovered);
  await assert.rejects(run('state',{},adminCookie),e=>e.status===401);
  const recoveredCookie=(await run('login',{},null,{email:recovered.ADMIN_EMAIL,password:recovered.ADMIN_PASSWORD},recovered)).cookie;
  assert.equal((await run('state',{},recoveredCookie,{},recovered)).result.sales.length,2);
  // A new process/redeploy must never reseed an existing company or discard its rows.
  const coldPool=new Pool({connectionString});try{await initialize(coldPool,recovered);assert.equal((await coldPool.query('SELECT count(*)::int AS n FROM patrimonio.sales WHERE company_id=$1',[company])).rows[0].n,2);}finally{await coldPool.end();}
  const invalid={...env,COMPANY_ID:'invalid-'+company,ADMIN_PASSWORD:'short'};
  await assert.rejects(initialize(pool,invalid));assert.equal((await pool.query('SELECT id FROM patrimonio.companies WHERE id=$1',[invalid.COMPANY_ID])).rowCount,0);
  // Verify tables are typed records, with no JSON/JSONB document column.
  const jsonColumns=await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='patrimonio' AND data_type IN ('json','jsonb')");assert.equal(jsonColumns.rowCount,0);
 }finally{await pool.end();}
});
