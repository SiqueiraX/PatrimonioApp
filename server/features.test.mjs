import test from 'node:test';
import assert from 'node:assert/strict';
import {execute} from './api.mjs';
import {hash,validateProduct,validateSale,scoped,entrySchedule,money} from './domain.mjs';
import {saleOptions,leadSummary,clientStatus} from '../shared/sales.mjs';
const condition=(id,entryMode,entryInstallments,commissionMode,commissionInstallments)=>({id,entryMode,entryInstallments,commissionMode,commissionInstallments});
function fixture(){return {demo:true,users:[{id:'g',name:'Gestor',email:'gestor@test.local',role:'Gestor',active:true,password:hash('SenhaTeste12345')},{id:'b',name:'Corretor',email:'corretor@test.local',role:'Corretor',active:true,password:hash('SenhaTeste12345')}],sessions:[],attempts:[],audit:[],developers:[{id:'dev',name:'Loteadora'}],products:[],sales:[],lands:[]};}
const req=cookie=>({headers:{cookie},socket:{remoteAddress:'test'}});
const run=(db,cookie,action,data)=>execute(db,req(cookie),{setHeader(){}},{action,data});
async function login(db,email){let cookie;await execute(db,req(),{setHeader:(k,v)=>cookie=v.split(';')[0]},{action:'login',email,password:'SenhaTeste12345'});return cookie;}
function product(db,name,opts){const p={id:name,...validateProduct({name,developerId:'dev',location:'Sinop',percent:4,payDay:31,active:true,saleOptions:opts},db)};db.products.push(p);return p;}
const sale=(p,optionId)=>({client:'Cliente',contact:'Contato',productId:p.id,optionId,leadSource:'TikTok',block:'1',lot:'2',date:'2026-01-12',value:100000.01,contract:'Assinado',signedAt:'2026-01-12',initial:10000.01,initialDue:'2026-01-31',paidAt:'',brokerId:'b'});
test('regras por produto: segue entrada, Grupo Sinop à vista, Morada 12x, Recanto 6x',()=>{const db=fixture();for(const [name,options,optionId,expected]of [
 ['Padrão',[condition('six','with',6,'entry',1)],'six',6],
 ['Grupo Sinop',[condition('six','with',6,'fixed',1),condition('none','none',0,'fixed',1)],'six',1],
 ['Morada Brasil',[condition('none','none',0,'fixed',12)],'none',12],
 ['Recanto dos Canários',[condition('none','none',0,'fixed',6)],'none',6]
]){const p=product(db,name,options),s=validateSale({...sale(p,optionId),rule:{percent:99,installments:99},commissionInstallments:99},db,db.users[1]);assert.equal(s.commissions.length,expected);assert.equal(s.rule.percent,4);assert.equal(s.commissions[0].due,'2026-02-28');assert.equal(money(s.commissions.reduce((a,p)=>a+p.amount,0)),400000);if(s.paymentPlan.entryMode==='none'){assert.equal(s.initial,0);assert.equal(s.initialDue,'');assert.equal(s.entryPayments.length,0);assert.equal(clientStatus(s,'2026-10-06'),'Sem entrada');}else{assert.equal(s.entryPayments.length,6);assert.equal(s.entryPayments[1].due,'2026-02-28');assert.equal(s.entryPayments[2].due,'2026-03-31');assert.equal(money(s.entryPayments.reduce((a,p)=>a+p.amount,0)),1000001);}}
});
test('condições inválidas e adulteradas são bloqueadas; produtos antigos preservam regras',()=>{const db=fixture();assert.throws(()=>product(db,'Inválido',[condition('x','none',0,'entry',1)]));assert.throws(()=>product(db,'Inválido',[condition('x','with',1.5,'entry',1)]));assert.throws(()=>product(db,'Inválido',[condition('x','with',3,'entry',1),condition('y','with',3,'fixed',1)]));assert.throws(()=>product(db,'Inválido',[]));const p=product(db,'Bom',[condition('six','with',6,'entry',1)]);assert.throws(()=>validateSale(sale(p,'forjado'),db,db.users[1]));assert.throws(()=>validateSale({...sale(p,'six'),leadSource:'Inventada'},db,db.users[1]));assert.throws(()=>validateSale({...sale(p,'six'),initial:0},db,db.users[1]));const old={id:'old',name:'Antigo',active:true,developerId:'dev',percent:3,installments:5,payDay:20};db.products.push(old);assert.equal(saleOptions(old)[0].commissionInstallments,5);const before=JSON.stringify(old);const s=validateSale(sale(old,'legacy'),db,db.users[1]);assert.equal(s.commissions.length,5);assert.equal(JSON.stringify(old),before);});
test('pagamento da entrada independente das comissões, conclusão e histórico preservado',async()=>{const db=fixture(),b=await login(db,'corretor@test.local'),g=await login(db,'gestor@test.local');const p=product(db,'Entrada',[condition('two','with',2,'entry',1)]);await run(db,g,'sale.create',sale(p,'two'));const s=db.sales[0],schedule=JSON.stringify(s.commissions);await assert.rejects(run(db,b,'sale.update',{...s,status:'Concluída'}));await run(db,b,'entry.pay',{saleId:s.id,id:s.entryPayments[0].id,paidAt:'2026-02-01'});assert.equal(clientStatus(s,'2026-03-01'),'Atrasado');assert.equal(s.paidAt,'');await run(db,b,'entry.pay',{saleId:s.id,id:s.entryPayments[1].id,paidAt:'2026-03-01'});assert.equal(clientStatus(s,'2026-03-02'),'Pago');assert.equal(s.paidAt,'2026-03-01');assert.equal(JSON.stringify(s.commissions),schedule);await run(db,b,'sale.update',{...s,status:'Concluída'});assert.equal(s.status,'Concluída');await run(db,g,'product.save',{...p,percent:7,saleOptions:[condition('none','none',0,'fixed',12)]});assert.equal(s.rule.percent,4);assert.equal(s.rule.installments,2);assert.equal(s.paymentPlan.entryInstallments,2);assert.equal(JSON.stringify(s.commissions),schedule);const no=product(db,'Sem entrada',[condition('none','none',0,'fixed',12)]);await run(db,g,'sale.create',sale(no,'none'));await run(db,b,'sale.update',{...db.sales[0],status:'Concluída'});assert.equal(db.sales[0].status,'Concluída');});
test('convite: só gestor, cargo e e-mail fixos, uso único, expiração, revogação e senha privada',async()=>{const db=fixture(),g=await login(db,'gestor@test.local'),b=await login(db,'corretor@test.local');await assert.rejects(run(db,b,'invite.create',{email:'new@test.local',role:'Gestor'}),e=>e.status===403);await assert.rejects(run(db,null,'invite.accept',{token:'sem-convite',name:'Intruso',password:'SenhaTeste12345'}));await assert.rejects(run(db,g,'user.save',{name:'Novo',email:'new@test.local',password:'SenhaTeste12345',role:'Corretor',active:true}));const r=await run(db,g,'invite.create',{email:'new@test.local',role:'Corretor'}),token=r.invitationToken;assert.equal(token.length,64);assert.equal(JSON.stringify(db.invitations).includes(token),false);assert.equal(JSON.stringify(scoped(db,db.users[0])).includes('tokenHash'),false);assert.deepEqual(scoped(db,db.users[1]).invitations,[]);assert.equal((await run(db,null,'invite.inspect',{token})).email,'new@test.local');await assert.rejects(run(db,null,'invite.accept',{token,name:'Novo',password:'curta'}));await run(db,null,'invite.accept',{token,name:'Novo',password:'SenhaTeste12345',email:'fake@test',role:'Gestor'});const created=db.users.at(-1);assert.equal(created.role,'Corretor');assert.equal(created.email,'new@test.local');assert.notEqual(created.password,'SenhaTeste12345');await assert.rejects(run(db,null,'invite.accept',{token,name:'Outro',password:'SenhaTeste12345'}));const newCookie=await login(db,'new@test.local');assert.equal((await run(db,newCookie,'state',{})).user.name,'Novo');const revoked=await run(db,g,'invite.create',{email:'revoked@test.local',role:'Corretor'});await run(db,g,'invite.revoke',{id:db.invitations[0].id});await assert.rejects(run(db,null,'invite.inspect',{token:revoked.invitationToken}));const expired=await run(db,g,'invite.create',{email:'expired@test.local',role:'Corretor'});db.invitations[0].expiresAt=Date.now()-1;await assert.rejects(run(db,null,'invite.accept',{token:expired.invitationToken,name:'Expirado',password:'SenhaTeste12345'}));const a=await run(db,g,'invite.create',{email:'again@test.local',role:'Corretor'});await run(db,g,'invite.create',{email:'again@test.local',role:'Corretor'});await assert.rejects(run(db,null,'invite.inspect',{token:a.invitationToken}));});
test('gráfico usa contagem agregada, exclui canceladas, preserva legadas e não expõe clientes',()=>{const db=fixture(),base={date:'2026-01-01',brokerId:'b',productId:'p',developerId:'d',status:'Em andamento',client:'Pessoa privada',contact:'Segredo',value:150000};db.sales=[{...base,leadSource:'Marketplace'},{...base,leadSource:'Marketplace'},{...base,brokerId:'g',leadSource:'Indicação'},{...base},{...base,leadSource:'TikTok',status:'Cancelada'}];const rows=leadSummary(db.sales);assert.equal(rows.reduce((a,r)=>a+r.count,0),4);assert.equal(rows.find(r=>r.source==='Marketplace').count,2);assert.equal(rows.find(r=>r.source==='Não informada').count,1);assert.equal(rows.some(r=>r.source==='TikTok'),false);const response=scoped(db,db.users[1]);assert.equal(response.sales.length,4);assert.equal(JSON.stringify(response.leadSummary).includes('Pessoa privada'),false);assert.equal(JSON.stringify(response.leadSummary).includes('Segredo'),false);});

test('metas de VGV: somente gestor, valores válidos e configuração preservada por período',async()=>{
  const db=fixture(),g=await login(db,'gestor@test.local'),b=await login(db,'corretor@test.local');
  await assert.rejects(run(db,b,'goals.save',{type:'month',period:'2026-10',individual:500000,team:2000000}),e=>e.status===403);
  for(const invalid of [{type:'month',period:'2026-13',individual:1,team:1},{type:'year',period:'x',individual:1,team:1},{type:'month',period:'2026-10',individual:0,team:1},{type:'month',period:'2026-10',individual:1,team:-1}])await assert.rejects(run(db,g,'goals.save',invalid));
  await run(db,g,'goals.save',{type:'month',period:'2026-10',individual:500000,team:2000000});
  await run(db,g,'goals.save',{type:'year',period:'2026',individual:6000000,team:24000000});
  await run(db,g,'goals.save',{type:'month',period:'2026-11',individual:600000,team:2200000});
  await run(db,g,'goals.save',{type:'month',period:'2026-10',individual:550000,team:2100000});
  assert.equal(db.goals.length,3);assert.equal(db.goals.find(g=>g.period==='2026-10').individual,550000);
  assert.equal(db.goals.find(g=>g.period==='2026-11').individual,600000);assert.equal(db.goals.find(g=>g.period==='2026').individual,6000000);
  assert.equal(db.audit.filter(a=>a.action==='Metas atualizadas').length,4);
  const state=await run(db,b,'state',{});assert.equal(state.goals.length,3);assert.equal(state.goals[0].individual,550000);
});
test('andamento das metas: centavos, contratos assinados, cancelamentos, meses e privacidade',async()=>{
  const {goalActivity,goalProgress}=await import('../shared/goals.mjs');
  const db=fixture(),base={date:'2026-10-01',brokerId:'b',value:100000.01,contract:'Assinado',status:'Em andamento'};
  db.sales=[base,{...base,date:'2026-10-02',value:200000.02},{...base,date:'2026-09-01',value:50000},{...base,brokerId:'g',value:300000},{...base,status:'Cancelada',value:900000},{...base,contract:'Aguardando assinatura',value:800000},{...base,date:'2025-10-01',value:10}];
  db.goals=[{type:'month',period:'2026-10',individual:500000,team:1000000},{type:'year',period:'2026',individual:6000000,team:12000000}];
  const activity=goalActivity(db.sales,db.users[1]);
  assert.equal(activity.find(r=>r.month==='2026-10').individualCents.g,undefined);
  const month=goalProgress(activity,db.goals,'month','2026-10','b');assert.equal(month.individual,300000.03);assert.equal(month.team,600000.03);assert.equal(month.goal.individual,500000);
  const year=goalProgress(activity,db.goals,'year','2026','b');assert.equal(year.individual,350000.03);assert.equal(year.team,650000.03);
  const newBroker=goalProgress(activity,db.goals,'month','2026-10','new');assert.equal(newBroker.individual,0);assert.equal(newBroker.goal.individual,500000);
  assert.equal(goalProgress(activity,db.goals,'month','2027-01','b').goal,undefined);
  const managerActivity=goalActivity(db.sales,db.users[0]);assert.equal(goalProgress(managerActivity,db.goals,'month','2026-10','g').individual,300000);
});

test('manager edits product sales and individual third-party commissions without losing receipts',async()=>{
 const db=fixture(),g=await login(db,'gestor@test.local'),b=await login(db,'corretor@test.local');
 const p=product(db,'Produto',[condition('none','none',0,'fixed',2)]);
 await assert.rejects(run(db,b,'sale.create',sale(p,'none')),e=>e.status===403);
 await run(db,g,'sale.create',sale(p,'none'));const s=db.sales[0];
 await assert.rejects(run(db,b,'sale.edit',{...sale(p,'none'),id:s.id}),e=>e.status===403);
 await run(db,g,'commission.receive',{saleId:s.id,id:s.commissions[0].id,amount:100,receivedAt:'2026-02-01'});
 p.percent=9;p.saleOptions=[];p.active=false;
 await run(db,g,'sale.edit',{...sale(p,'none'),id:s.id,value:200000,client:'Editado'});
 assert.equal(s.rule.percent,4);assert.equal(s.value,200000);assert.equal(s.commissions[0].received,100);assert.equal(s.commissions[0].history.length,1);
 await assert.rejects(run(db,g,'sale.edit',{...sale(p,'none'),id:s.id,value:100}),/menor que um recebimento/);
 const v={...sale(p,'none'),saleType:'third_party',productName:'Bairro',productId:null,entryMode:'with',entryInstallments:2,initial:10000,percent:6,installments:3,payDay:10};
 await run(db,g,'sale.create',v);const t=db.sales[0];assert.equal(t.productId,null);assert.equal(t.developerId,null);assert.equal(t.commissions.length,3);assert.equal(t.entryPayments.length,2);
 await run(db,g,'entry.pay',{saleId:t.id,id:t.entryPayments[0].id,paidAt:'2026-01-31'});
 await assert.rejects(run(db,g,'sale.edit',{...v,id:t.id,initial:20000}),/já paga/);
 await run(db,g,'sale.edit',{...v,id:t.id,client:'Novo nome',value:300000});assert.equal(t.client,'Novo nome');assert.equal(t.entryPayments[0].paidAt,'2026-01-31');
 await assert.rejects(run(db,g,'sale.create',{...v,landId:'missing'}),/Terreno não encontrado/);
});
