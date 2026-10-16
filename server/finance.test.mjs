import test from 'node:test';
import assert from 'node:assert/strict';
import {allocation,blankFinance,cents} from '../shared/finance.mjs';
import {validateFinance,prepareFinance,savePolicy,projectSale,settleFinance} from './finance.mjs';
import {scoped,hash} from './domain.mjs';
import {execute} from './api.mjs';
import {flatten,hydrate,empty} from './db/records.mjs';
const f=()=>({...blankFinance(),grossValue:4,sellerValue:45,captorValue:10,grossCount:3,sellerCount:2,captorCount:6,captorId:'b'});
function setup(){const db={...empty(),users:[{id:'g',name:'Gestor',role:'Gestor',active:true},{id:'b',name:'Corretor',role:'Corretor',active:true},{id:'other',name:'Outro',role:'Corretor',active:true}]};const s={id:'s',saleType:'third_party',client:'Teste',productName:'Bairro',date:'2026-01-10',value:200000,brokerId:'b',rule:{percent:0,installments:1,payDay:20},status:'Em andamento',commissions:[],entryPayments:[],paymentPlan:{id:'individual'},history:[]};return {db,s};}
test('divisão: 4% bruto, 45% vendedor, 10% captador; centavos exatos e parcelas independentes',()=>{const {db,s}=setup();const out=prepareFinance(s,{finance:f()},db);assert.deepEqual(allocation(s.value,out.finance),{gross:8000,seller:3600,captor:800,agency:3600});for(const [kind,count,total]of [['gross',3,8000],['seller',2,3600],['captor',6,800]]){const rows=out.financeItems.filter(p=>p.kind===kind);assert.equal(rows.length,count);assert.equal(rows.reduce((n,p)=>n+cents(p.amount),0),cents(total));}assert.equal(out.financeItems[0].due,'2026-02-20');const mixed={...f(),sellerMode:'sale',sellerValue:1.8,captorMode:'fixed',captorValue:500};assert.deepEqual(allocation(200000,mixed),{gross:8000,seller:3600,captor:500,agency:3900});});
test('validação rejeita excesso, destinatário ausente, parcelas fracionárias e datas inválidas',()=>{const {db,s}=setup();assert.throws(()=>validateFinance({...f(),sellerValue:95},db));assert.throws(()=>prepareFinance(s,{finance:{...f(),sellerMode:'fixed',sellerValue:9000}},db));assert.throws(()=>prepareFinance(s,{finance:{...f(),captorId:'',captorName:''}},db));assert.throws(()=>validateFinance({...f(),grossCount:2.5},db));assert.throws(()=>validateFinance({...f(),grossFirst:'2026-02-31'},db));assert.throws(()=>validateFinance({...f(),captorId:'foreign'},db));});
test('pagamentos parciais, captura pelo vendedor, privacidade e edição financeira protegida',()=>{const {db,s}=setup();const prepared=prepareFinance(s,{finance:f()},db);Object.assign(s,prepared);db.sales=[s];savePolicy(db,'sale',s.id,prepared.finance);const gross=s.financeItems.find(p=>p.kind==='gross');settleFinance(db,db.users[0],{saleId:s.id,id:gross.id,amount:100,receivedAt:'2026-02-20'});assert.equal(gross.received,100);assert.equal(db.financeMovements.length,1);assert.equal(s.financeItems.find(p=>p.kind==='seller').received,0);assert.throws(()=>settleFinance(db,db.users[0],{saleId:s.id,id:gross.id,amount:9000,receivedAt:'2026-02-20'}));assert.throws(()=>prepareFinance({...s,value:300000},{finance:f()},db,s));assert.throws(()=>prepareFinance(s,{finance:null},db,s));s.financeItems.reverse();assert.doesNotThrow(()=>prepareFinance(s,{finance:f()},db,s));const own=projectSale(s,db,db.users[1]);assert.equal(own.finance,undefined);assert.equal(own.financeItems.length,8);assert.equal(own.financeItems.some(p=>p.kind==='gross'),false);assert.equal(own.commissions.reduce((n,p)=>n+p.amount,0),4400);const scope=scoped(db,db.users[1]);assert.deepEqual(scope.financeMovements,[]);assert.deepEqual(scope.financePolicies,[]);assert.equal(scoped(db,db.users[2]).sales.length,0);s.status='Cancelada';assert.throws(()=>settleFinance(db,db.users[0],{saleId:s.id,id:gross.id,amount:10,receivedAt:'2026-02-20'}));assert.equal(gross.received,100);});
test('snapshot, herança, parceiro externo e persistência relacional',()=>{const {db,s}=setup();savePolicy(db,'default','default',f());const out=prepareFinance(s,{},db);Object.assign(s,out);db.sales=[s];savePolicy(db,'sale',s.id,out.finance);savePolicy(db,'default','default',{...f(),grossValue:10});assert.equal(prepareFinance(s,{},db,s).finance.grossValue,4);const restored=hydrate(flatten(db));assert.equal(restored.financePolicies.length,2);assert.equal(restored.sales[0].financeItems.length,11);assert.equal(prepareFinance(s,{finance:{...f(),captorId:'',captorName:'Parceiro externo'}},db).finance.captorName,'Parceiro externo');const legacy={...s,id:'old',financeItems:[]};assert.equal(prepareFinance(legacy,{},db,legacy).finance,null);});
test('API financeira restrita ao gestor',async()=>{const {db}=setup();db.users[1].email='broker@test.local';db.users[1].password=hash('TestPassword123');let cookie;const res={setHeader:(k,v)=>cookie=v.split(';')[0]},req={headers:{},socket:{remoteAddress:'test'}};await execute(db,req,res,{action:'login',email:db.users[1].email,password:'TestPassword123'});req.headers.cookie=cookie;for(const action of ['finance.defaults','finance.settle'])await assert.rejects(execute(db,req,res,{action,data:{finance:f()}}),e=>e.status===403);});

test('PostgreSQL financeiro: política, snapshot, caixa independente, concorrência e isolamento',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const {Pool,types}=await import('pg');types.setTypeParser(1082,v=>v);const {randomUUID}=await import('node:crypto');const {runTransaction}=await import('./db/postgres.mjs');
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:6}),env={COMPANY_ID:'finance-'+randomUUID(),ADMIN_EMAIL:'finance@test.local',ADMIN_PASSWORD:'FinanceTest12345'};let cookie;
 const run=async(action,data={},extra={},session=cookie,environment=env)=>{const req={headers:{cookie:session}},body={action,data,...extra};let next;const result=await runTransaction(pool,db=>execute(db,req,{setHeader:(k,v)=>next=v.split(';')[0]},body),{req,body,env:environment});return {result,cookie:next};};
 try{
  cookie=(await run('login',{}, {email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})).cookie;
  let db=(await run('state')).result;const broker=db.user.id,finance={...f(),captorId:broker,grossFirst:'2026-02-28',sellerFirst:'2026-03-10'};
  await run('finance.defaults',{finance});
  const sale={saleType:'third_party',client:'Financeiro teste',contact:'Teste',productName:'Bairro',block:'1',lot:'2',value:200000,date:'2026-01-10',brokerId:broker,contract:'Assinado',signedAt:'2026-01-10',leadSource:'Indicação',entryMode:'none',percent:0,installments:1,payDay:20};
  db=(await run('sale.create',sale)).result;let s=db.sales[0];assert.equal(s.finance.grossValue,4);assert.equal(s.financeItems.length,11);const sid=s.id,gross=s.financeItems.find(p=>p.kind==='gross'),seller=s.financeItems.find(p=>p.kind==='seller');
  const pay=(id,amount)=>run('finance.settle',{saleId:sid,id,amount,receivedAt:'2026-03-01'});
  await pay(gross.id,100);db=(await run('state')).result;s=db.sales[0];assert.equal(s.financeItems.find(p=>p.id===gross.id).received,100);assert.equal(s.financeItems.find(p=>p.id===seller.id).received,0);
  await pay(seller.id,50);await run('finance.defaults',{finance:{...finance,grossValue:8}});db=(await run('state')).result;assert.equal(db.sales[0].finance.grossValue,4);assert.equal(db.financeMovements.length,2);
  await assert.rejects(run('sale.edit',{...sale,id:sid,value:300000,finance}),/movimentações/);await run('sale.edit',{...sale,id:sid,client:'Nome editado',finance});
  const results=await Promise.allSettled([pay(gross.id,2000),pay(gross.id,2000)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await assert.rejects(run('commission.receive',{saleId:sid,id:seller.id,amount:1,receivedAt:'2026-03-01'}));
  const otherEnv={...env,COMPANY_ID:'finance-other-'+randomUUID()};const other=(await run('login',{}, {email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD},null,otherEnv)).cookie;await assert.rejects(run('finance.settle',{saleId:sid,id:gross.id,amount:1,receivedAt:'2026-03-01'},{},other,otherEnv));
  const fresh=(await run('state')).result;assert.equal(fresh.financeMovements.length,3);assert.equal(fresh.sales[0].financeItems.find(p=>p.id===gross.id).received,2100);
  const devState=(await run('developer.save',{name:'Loteadora financeira',contact:'Teste'})).result;
  const productState=(await run('product.save',{name:'Produto financeiro',location:'Sinop',developerId:devState.developers[0].id,percent:0,payDay:20,active:true,saleOptions:[{id:'none',entryMode:'none',entryInstallments:0,commissionMode:'fixed',commissionInstallments:4}],finance:{...finance,grossValue:6},photos:[]})).result;
  const product=productState.products[0];assert.equal(product.finance.grossValue,6);
  const ps=(await run('sale.create',{...sale,saleType:'product',productId:product.id,optionId:'none'})).result.sales.find(s=>s.productId===product.id);assert.equal(ps.finance.grossValue,6);
  const ls=(await run('land.save',{neighborhood:'Bairro captado',block:'9',lot:'8',area:300,condition:'Quitado',price:200000,owner:'Teste',contact:'Teste',brokerId:broker,availability:'Disponível',finance:{...finance,grossValue:5}})).result.lands[0];assert.equal(ls.finance.grossValue,5);
  const landed=(await run('sale.create',{...sale,landId:ls.id})).result.sales.find(s=>s.landId===ls.id);assert.equal(landed.finance.grossValue,5);
  const json=await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='patrimonio' AND table_name LIKE 'finance_%' AND data_type IN ('json','jsonb')");assert.equal(json.rowCount,0);
 }finally{await pool.end();}
});

test('vencimentos no dia 31 voltam ao dia acordado após fevereiro',()=>{const {db,s}=setup();const prepared=prepareFinance(s,{finance:{...f(),grossDay:31}},db);assert.deepEqual(prepared.financeItems.filter(p=>p.kind==='gross').map(p=>p.due),['2026-02-28','2026-03-31','2026-04-30']);const explicit=prepareFinance(s,{finance:{...f(),grossDay:31,grossFirst:'2026-02-15'}},db);assert.deepEqual(explicit.financeItems.filter(p=>p.kind==='gross').map(p=>p.due),['2026-02-15','2026-03-15','2026-04-15']);});

test('dashboard recebe comissão bruta antes dos repasses e não presume bruto em vendas antigas',()=>{
 const {db,s}=setup();
 const prepared=prepareFinance(s,{finance:f()},db);
 Object.assign(s,prepared);
 savePolicy(db,'sale',s.id,prepared.finance);
 for(const user of db.users.slice(0,2)){
  const projected=projectSale(s,db,user);
  assert.equal(projected.grossCommission,8000);
  assert.equal(projected.commissions.reduce((sum,p)=>sum+p.amount,0),4400);
 }
 assert.equal(projectSale({...s,id:'legacy',financeItems:[]},db,db.users[0]).grossCommission,undefined);
});

test('comissão gerada inclui vendas simples sem inventar bruto e não duplica repasses',()=>{
 const {db,s}=setup();
 s.rule.percent=1.8;
 s.commissions=[{amount:1200.01,received:500},{amount:1200.02,received:1200.02},{amount:1199.97,received:0}];
 for(const user of db.users.slice(0,2)){
  const old=projectSale(s,db,user);
  assert.equal(old.generatedCommission,3600);
  assert.equal(old.commissionBasis,'registered');
  assert.equal(old.grossCommission,undefined);
 }
 const prepared=prepareFinance(s,{finance:f()},db);
 Object.assign(s,prepared);
 savePolicy(db,'sale',s.id,prepared.finance);
 for(const user of db.users.slice(0,2)){
  const sale=projectSale(s,db,user);
  assert.equal(sale.generatedCommission,8000);
  assert.equal(sale.commissionBasis,'gross');
  assert.equal(sale.grossCommission,8000);
 }
 assert.equal(s.commissions.reduce((n,p)=>n+p.amount,0),3600);
});
