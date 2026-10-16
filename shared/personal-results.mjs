import {cents} from './finance.mjs';

// Earnings follow installment due dates, independently of the sale month.
export function personalResults(sales,userId,month){
 const active=sales.filter(s=>s.status!=='Cancelada');
 const ownSales=active.filter(s=>s.brokerId===userId&&s.date.slice(0,7)===month);
 const signed=ownSales.filter(s=>s.contract==='Assinado');
 const installments=active.flatMap(s=>s.financeConfigured
  ?(s.financeItems||[]).filter(p=>p.kind!=='gross'&&p.recipientId===userId)
  :s.brokerId===userId?(s.commissions||[]):[]
 ).filter(p=>p.due?.slice(0,7)===month);
 const expected=installments.reduce((n,p)=>n+cents(p.amount),0);
 const received=installments.reduce((n,p)=>n+cents(p.received||0),0);
 return {sales:ownSales,vgv:signed.reduce((n,s)=>n+cents(s.value),0)/100,lots:signed.length,expected:expected/100,received:received/100,remaining:Math.max(0,expected-received)/100};
}
