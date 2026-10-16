import {allocation,cents} from '../shared/finance.mjs';
import {fail,num,text,date,id,entrySchedule,today,audit} from './domain.mjs';
export function validateFinance(v,db){
 if(!v)return null;
 const f={};
 for(const role of ['gross','seller','captor']){
  const mode=v[role+'Mode'];if(!(role==='gross'?['sale','fixed']:['sale','fixed','commission']).includes(mode))fail('Base de cálculo da comissão inválida.');
  f[role+'Mode']=mode;f[role+'Value']=num(v[role+'Value'],`Valor de ${role}`,0,mode==='fixed'?999999999999:100);
  f[role+'Value']=mode==='fixed'?cents(f[role+'Value'])/100:Math.round(f[role+'Value']*1e6)/1e6;
  const count=v[role+'Count'];f[role+'Count']=count===''||count==null?null:num(count,'Parcelas',1,120);
  f[role+'Day']=num(v[role+'Day']??20,'Dia de pagamento',1,31);
  if(!Number.isInteger(f[role+'Day'])||(f[role+'Count']!==null&&!Number.isInteger(f[role+'Count'])))fail('Parcelas e dias devem ser inteiros.');
  f[role+'First']=date(v[role+'First'],'Primeiro vencimento',true);
 }
 f.captorId=text(v.captorId,'Captador',false);f.captorName=text(v.captorName,'Nome do captador externo',false);
 if(f.captorId){const u=db.users.find(u=>u.id===f.captorId);if(!u)fail('Captador não encontrado.');f.captorName=u.name;}
 if(f.sellerMode==='commission'&&f.captorMode==='commission'&&f.sellerValue+f.captorValue>100)fail('Os repasses ultrapassam 100% da comissão bruta.');
 return f;
}
export function policy(db,scope,entityId){return (db.financePolicies||[]).find(p=>p.scope===scope&&p.entityId===entityId)||null;}
export function savePolicy(db,scope,entityId,f){db.financePolicies||=[];db.financePolicies=db.financePolicies.filter(p=>p.scope!==scope||p.entityId!==entityId);if(f)db.financePolicies.push({...f,scope,entityId,productId:scope==='product'?entityId:null,landId:scope==='land'?entityId:null,saleId:scope==='sale'?entityId:null});}
export function prepareFinance(s,v,db,existing){
 const source=Object.hasOwn(v,'finance')?v.finance:existing?policy(db,'sale',existing.id):policy(db,s.saleType==='third_party'?'land':'product',s.landId||s.productId)||policy(db,'default','default');
 const f=validateFinance(source,db);if(!f){if(existing?.financeItems?.some(p=>p.received>0))fail('Não é possível remover uma divisão com pagamentos.');return {finance:null,financeItems:[]};}
 if(existing){const previous=policy(db,'sale',existing.id);if(previous?.captorId===f.captorId&&f.captorId)f.captorName=previous.captorName;}
 const values=allocation(s.value,f);if(values.agency<0)fail('Os repasses ultrapassam a comissão bruta.');if(values.captor>0&&!f.captorId&&!f.captorName)fail('Selecione o captador ou informe o parceiro externo.');
 const items=[];
 for(const role of ['gross','seller','captor']){
  const count=f[role+'Count']||s.rule.installments,day=f[role+'Day'];
  const [y,m]=s.date.split('-').map(Number),d=new Date(Date.UTC(y,m,1)),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  const first=f[role+'First']||`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;
  if(values[role]===0)continue;if(cents(values[role])<count)fail('O valor precisa permitir ao menos um centavo por parcela.');
  for(const p of entrySchedule(values[role],count,first)){
   if(!f[role+'First']){const monthDate=new Date(Date.UTC(y,m+p.number-1,1)),year=monthDate.getUTCFullYear(),month=monthDate.getUTCMonth(),lastDay=new Date(Date.UTC(year,month+1,0)).getUTCDate();p.due=`${year}-${String(month+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;}
   items.push({id:id(),saleId:s.id,kind:role,number:p.number,amount:p.amount,due:p.due,received:0,receivedAt:'',recipientId:role==='seller'?s.brokerId:role==='captor'?f.captorId:'',recipientName:role==='seller'?db.users.find(u=>u.id===s.brokerId).name:role==='captor'?f.captorName:'Imobiliária'});
  }
 }
 const old=existing?.financeItems||[];
 for(const p of items){const prior=old.find(o=>o.kind===p.kind&&o.recipientId===p.recipientId);if(prior&&p.recipientId)p.recipientName=prior.recipientName;}
 if(old.some(p=>p.received>0)){
  const shape=p=>[p.kind,p.number,cents(p.amount),p.due,p.recipientId,p.recipientName];
  const ordered=rows=>rows.map(shape).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))||a[1]-b[1]);
  if(JSON.stringify(ordered(old))!==JSON.stringify(ordered(items)))fail('Esta venda já tem movimentações financeiras. Preserve os valores, participantes e vencimentos da divisão.');
 }
 return {finance:f,financeItems:items.map(p=>{const oldItem=old.find(o=>o.kind===p.kind&&o.number===p.number);return oldItem?{...p,id:oldItem.id,received:oldItem.received,receivedAt:oldItem.receivedAt}:p;})};
}
export function settleFinance(db,user,v){
 const s=db.sales.find(s=>s.id===v.saleId),p=s?.financeItems?.find(p=>p.id===v.id);if(!p)fail('Parcela não encontrada.',404);if(s.status==='Cancelada')fail('Venda cancelada não aceita novos pagamentos.');
 const amount=num(v.amount,'Valor',0.01,(cents(p.amount)-cents(p.received))/100),at=date(v.receivedAt,'Data');if(cents(amount)<=0||cents(amount)>cents(p.amount)-cents(p.received))fail('Valor inválido.');if(at>today())fail('A data não pode estar no futuro.');
 p.received=(cents(p.received)+cents(amount))/100;p.receivedAt=at;
 const movement={id:id(),saleId:s.id,installmentId:p.id,kind:p.kind,amount:cents(amount)/100,date:at,authorId:user.id,author:user.name};db.financeMovements||=[];db.financeMovements.push(movement);
 s.history.unshift(audit(user,p.kind==='gross'?'Comissão bruta recebida':'Repasse pago',`${p.recipientName} · parcela ${p.number}: ${movement.amount.toFixed(2)} em ${at}`));return s;
}
export function financeProjection(db,user){
 const manager=user.role==='Gestor';
 return {financePolicies:manager?db.financePolicies||[]:[],financeMovements:manager?db.financeMovements||[]:[],financeDefaults:manager?policy(db,'default','default'):null};
}
export function projectSale(s,db,user){
 const f=policy(db,'sale',s.id);if(!f)return user.role==='Gestor'?s:{...s,history:(s.history||[]).map(h=>['Venda editada','Divisão financeira atualizada'].includes(h.action)?{...h,details:'Dados da venda atualizados.'}:h)};
 const own=(s.financeItems||[]).filter(p=>p.kind!=='gross'&&(user.role==='Gestor'||p.recipientId===user.id));
 const commissions=own.map(p=>({...p,history:[],number:p.number}));
 const result={...s,finance:user.role==='Gestor'?f:undefined,financeConfigured:true,grossCommission:allocation(s.value,f).gross,financeItems:user.role==='Gestor'?s.financeItems:own,commissions};
 if(user.role!=='Gestor'){result.history=[];result.notes='';result.rule={...s.rule,percent:s.value?own.reduce((a,p)=>a+p.amount,0)/s.value*100:0};}
 return result;
}

export function projectProduct(p,db,user){
 const f=policy(db,'product',p.id)||policy(db,'default','default');
 const sellerTerms=!f?null:f.sellerMode==='sale'?{mode:'sale',value:f.sellerValue}:f.sellerMode==='fixed'?{mode:'fixed',value:f.sellerValue}:f.grossMode==='sale'?{mode:'sale',value:Math.round(f.grossValue*f.sellerValue/100*1e6)/1e6}:{mode:'fixed',value:cents(f.grossValue*f.sellerValue/100)/100};
 return {...p,sellerTerms,...(user.role==='Gestor'?{finance:policy(db,'product',p.id)}:{})};
}
