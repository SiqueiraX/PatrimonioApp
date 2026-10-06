import {goalActivity} from '../shared/goals.mjs';
import {LEAD_SOURCES, saleOptions, commissionCount, leadSummary} from '../shared/sales.mjs';
import {randomUUID, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
export const id=()=>randomUUID();
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function text(v,name,required=true){let s=String(v??'').trim();if(required&&!s)fail(`${name}: campo obrigatório.`);if(s.length>10000)fail(`${name}: texto muito longo.`);return s;}
export function num(v,name,min=0,max=1e12,optional=false){if(optional&&(v===''||v==null))return null; if(v===''||v==null||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)fail(`${name}: informe um número entre ${min} e ${max}.`);return Number(v);}
export function date(v,name,optional=false){
  if(optional&&!v)return '';
  const parsed=new Date(String(v)+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==v)fail(`${name}: data inválida.`);
  return v;
}
export function choice(v,options,name){if(!options.includes(v))fail(`${name}: opção inválida.`);return v;}
export function hash(password){let salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function verify(password,stored){const [salt,digest]=stored.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(digest,'hex'));}
export const money=v=>Math.round((Number(v)+Number.EPSILON)*100);
export function rules(v){const percent=num(v.percent,'Percentual',0,100), installments=num(v.installments,'Parcelas',1,120),payDay=num(v.payDay,'Dia de pagamento',1,31);if(!Number.isInteger(installments)||!Number.isInteger(payDay))fail('Parcelas e dia de pagamento devem ser inteiros.');return {percent,installments,payDay};}
export function schedule(value,rule,saleDate){date(saleDate,'Data da venda');rules(rule);const total=money(Number(value)*rule.percent/100),base=Math.floor(total/rule.installments);const [year,month]=saleDate.split('-').map(Number);return Array.from({length:rule.installments},(_,i)=>{const d=new Date(Date.UTC(year,month+i,1)),y=d.getUTCFullYear(),m=d.getUTCMonth(),last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return {id:id(),number:i+1,amount:(i===rule.installments-1?total-base*i:base)/100,due:`${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(rule.payDay,last)).padStart(2,'0')}`,received:0,receivedAt:'',history:[]};});}
export const paymentStatus=(due,receivedAt,now=today())=>receivedAt?'Pago':due<now?'Atrasado':'Aguardando';
export const commissionStatus=(p,now=today())=>money(p.received)>=money(p.amount)?'Paga':p.due<now?'Atrasada':'Aguardando';
export function landPrice(l){return l.condition==='Quitado'?l.price:l.balance==null?null:Number(l.premium)+Number(l.balance);}
export const duplicateKey=l=>[l.neighborhood,l.block,l.lot].map(s=>String(s||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()).join('|');
export function photos(v){if(!v)return [];if(!Array.isArray(v)||v.length>5)fail('Use no máximo cinco fotos.');return v.map(s=>{if(typeof s!=='string'||s.length>650000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s))fail('Foto inválida. Use JPG, PNG ou WebP de até 450 KB.');return s;});}
export function validateLand(v,db,user){const condition=choice(v.condition,['Quitado','Ágio'],'Condição');let l={neighborhood:text(v.neighborhood,'Bairro'),block:text(v.block,'Quadra'),lot:text(v.lot,'Lote'),area:num(v.area,'Área',0.01,1e9),condition,price:condition==='Quitado'?num(v.price,'Valor total',0.01):null,premium:condition==='Ágio'?num(v.premium,'Ágio',0):null,balance:condition==='Ágio'?num(v.balance,'Saldo devedor',0,1e12,true):null,balanceDate:date(v.balanceDate,'Referência do saldo',true),owner:text(v.owner,'Proprietário'),contact:text(v.contact,'Contato'),address:text(v.address,'Localização',false),description:text(v.description,'Descrição',false),notes:text(v.notes,'Observações',false),paymentTerms:text(v.paymentTerms,'Condições de pagamento',false),paymentOptions:Array.isArray(v.paymentOptions)?v.paymentOptions.filter(x=>['Entrada','Parcelamento','Financiamento','Permuta'].includes(x)):[],brokerId:user.role==='Corretor'?user.id:text(v.brokerId,'Corretor'),availability:choice(v.availability,['Disponível','Reservado','Vendido','Inativo'],'Disponibilidade'),photos:photos(v.photos)};if(!db.users.some(u=>u.id===l.brokerId&&u.active))fail('Corretor não encontrado.');if(l.balance!==null&&!l.balanceDate)fail('Informe a data de referência do saldo devedor.');return l;}
export function validateOptions(options) {
  if(!Array.isArray(options)||!options.length||options.length>30)fail('Cadastre entre 1 e 30 condições de venda.');
  const ids=new Set(),combinations=new Set();
  return options.map(o=>{
    const optionId=text(o.id,'Identificador da condição');
    if(ids.has(optionId))fail('Condições com identificadores repetidos.');ids.add(optionId);
    const entryMode=choice(o.entryMode,['none','with'],'Tipo de entrada');
    const entryInstallments=entryMode==='none'?0:num(o.entryInstallments,'Parcelas da entrada',1,120);
    const commissionMode=choice(o.commissionMode,['entry','fixed'],'Forma de comissão');
    if(commissionMode==='entry'&&entryMode==='none')fail('Sem entrada exige uma quantidade fixa de parcelas de comissão.');
    const commissionInstallments=commissionMode==='entry'?entryInstallments:num(o.commissionInstallments,'Parcelas da comissão',1,120);
    if(!Number.isInteger(entryInstallments)||!Number.isInteger(commissionInstallments))fail('As quantidades de parcelas devem ser inteiras.');
    const key=entryMode+':'+entryInstallments;
    if(combinations.has(key))fail('Use uma única regra de comissão para cada opção de entrada.');combinations.add(key);
    return {id:optionId,entryMode,entryInstallments,commissionMode,commissionInstallments};
  });
}
export function validateProduct(v,db){
  if(!db.developers.some(d=>d.id===v.developerId))fail('Selecione uma loteadora.');
  const mapUrl=text(v.mapUrl,'Link do mapa',false);
  if(mapUrl&&!/^https?:\/\//i.test(mapUrl))fail('O link do mapa deve começar com https://.');
  const options=validateOptions(v.saleOptions);
  const rule=rules({...v,installments:commissionCount(options[0])});
  return {name:text(v.name,'Nome'),developerId:v.developerId,location:text(v.location,'Localização'),mapUrl,description:text(v.description,'Descrição',false),launch:!!v.launch,construction:!!v.construction,active:!!v.active,photos:photos(v.photos),percent:rule.percent,payDay:rule.payDay,saleOptions:options};
}
export function entrySchedule(amount,count,firstDue,firstPaidAt='') {
  date(firstDue,'Primeiro vencimento da entrada');
  const cents=money(amount),base=Math.floor(cents/count),[year,month,day]=firstDue.split('-').map(Number);
  return Array.from({length:count},(_,i)=>{
    const d=new Date(Date.UTC(year,month-1+i,1)),y=d.getUTCFullYear(),m=d.getUTCMonth();
    const due=`${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(day,new Date(Date.UTC(y,m+1,0)).getUTCDate())).padStart(2,'0')}`;
    return {id:id(),number:i+1,amount:(i===count-1?cents-base*i:base)/100,due,paidAt:i===0?firstPaidAt:''};
  });
}
export function validateSale(v,db,user){
  const p=db.products.find(p=>p.id===v.productId&&p.active);
  if(!p)fail('Selecione um produto ativo.');
  const brokerId=user.role==='Corretor'?user.id:v.brokerId;
  if(!db.users.some(u=>u.id===brokerId&&u.active))fail('Corretor inválido.');
  const option=saleOptions(p).find(o=>o.id===v.optionId);
  if(!option)fail('Selecione uma condição de venda disponível neste produto.');
  const leadSource=choice(v.leadSource,LEAD_SOURCES,'Origem do lead');
  const contract=choice(v.contract,['Aguardando assinatura','Assinado'],'Contrato'),saleDate=date(v.date,'Data da venda'),signedAt=date(v.signedAt,'Assinatura',true);
  const paidAt=option.entryMode==='none'?'':date(v.paidAt,'Pagamento',true);
  if(saleDate>today()||signedAt>today()||paidAt>today())fail('Datas de venda, assinatura e pagamento não podem estar no futuro.');
  if(contract==='Assinado'&&!signedAt)fail('Informe a data de assinatura.');
  const value=num(v.value,'Valor do lote',0.01);
  const initial=option.entryMode==='none'?0:money(num(v.initial,'Valor total da entrada',0.01,value))/100;
  const initialDue=option.entryMode==='none'?'':date(v.initialDue,'Primeiro vencimento da entrada');
  if(option.entryMode!=='none'&&money(initial)<option.entryInstallments)fail('O valor da entrada deve permitir pelo menos um centavo por parcela.');
  const rule=rules({percent:p.percent,payDay:p.payDay,installments:commissionCount(option)});
  const entryPayments=option.entryMode==='none'?[]:entrySchedule(initial,option.entryInstallments,initialDue,paidAt);
  return {client:text(v.client,'Cliente'),contact:text(v.contact,'Contato'),productId:p.id,productName:p.name,developerId:p.developerId,brokerId,block:text(v.block,'Quadra'),lot:text(v.lot,'Lote'),date:saleDate,value,contract,signedAt:contract==='Assinado'?signedAt:'',leadSource,paymentPlan:{...option},initial,initialDue,paidAt:entryPayments.length&&entryPayments.every(p=>p.paidAt)?paidAt:'',entryPayments,notes:text(v.notes,'Observações',false),status:'Em andamento',rule,commissions:schedule(value,rule,saleDate),history:[]};
}
export function audit(user,action,details=''){return {id:id(),at:new Date().toISOString(),author:user.name,authorId:user.id,action,details};}
export function scoped(db,user){const sales=user.role==='Gestor'?db.sales:db.sales.filter(s=>s.brokerId===user.id);return {user:{...publicUser(user),cpf:user.cpf||'',creci:user.creci||''},users:db.users.map(u=>user.role==='Gestor'?publicUser(u):({id:u.id,name:u.name,role:u.role,active:u.active})),developers:db.developers,products:db.products,lands:db.lands,sales,rankingSales:db.sales.filter(s=>s.status!=='Cancelada'&&s.contract==='Assinado').map(s=>({brokerId:s.brokerId,date:s.date,value:s.value,productId:s.productId,developerId:s.developerId})),goals:db.goals||[],goalActivity:goalActivity(db.sales,user),leadSummary:leadSummary(db.sales),invitations:user.role==='Gestor'?(db.invitations||[]).map(({tokenHash,...i})=>i):[],audit:user.role==='Gestor'?db.audit:[],demo:db.demo};}
export function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role,active:u.active,photo:u.photo||''};}

export function validateGoal(v){
  const type=choice(v.type,['month','year'],'Período da meta');
  const period=String(v.period||'');
  if(!(type==='month'?/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/:/^(20\d{2}|2100)$/).test(period))fail('Selecione um mês ou ano válido entre 2000 e 2100.');
  const individual=money(num(v.individual,'Meta individual',0.01))/100;
  const team=money(num(v.team,'Meta coletiva',0.01))/100;
  return {type,period,individual,team};
}
