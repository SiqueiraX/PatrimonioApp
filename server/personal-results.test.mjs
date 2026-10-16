import test from 'node:test';
import assert from 'node:assert/strict';
import {personalResults} from '../shared/personal-results.mjs';
const sale=(v={})=>({id:'s',brokerId:'me',date:'2026-10-10',status:'Em andamento',contract:'Assinado',value:200000,commissions:[],...v});
const parcel=(v={})=>({amount:1000,received:100,due:'2026-10-20',...v});
test('meus resultados: vendas próprias assinadas, cancelamentos e período',()=>{
 const result=personalResults([sale(),sale({id:'pending',contract:'Aguardando assinatura'}),sale({brokerId:'other'}),sale({status:'Cancelada'}),sale({date:'2026-09-10'})],'me','2026-10');
 assert.equal(result.vgv,200000);assert.equal(result.lots,1);assert.equal(result.sales.length,2);
});
test('comissão pessoal usa vencimento e destinatário, incluindo captura sem somar bruto ou outros corretores',()=>{
 const result=personalResults([
  sale({date:'2026-08-10',commissions:[parcel(),parcel({due:'2026-11-20'})]}),
  sale({brokerId:'other',financeConfigured:true,financeItems:[parcel({kind:'gross',amount:10000}),parcel({kind:'seller',recipientId:'other',amount:3000}),parcel({kind:'captor',recipientId:'me',amount:500,received:50})]}),
  sale({brokerId:'other',commissions:[parcel()]}),
  sale({status:'Cancelada',commissions:[parcel()]})
 ],'me','2026-10');
 assert.equal(result.expected,1500);assert.equal(result.received,150);assert.equal(result.remaining,1350);
 assert.equal(result.lots,0);
});
test('meses vazios e valores em centavos',()=>{
 assert.equal(personalResults([],'me','2026-10').expected,0);
 const result=personalResults([sale({commissions:[parcel({amount:.1,received:0}),parcel({amount:.2,received:0})]})],'me','2026-10');
 assert.equal(result.expected,.3);assert.equal(result.remaining,.3);
});
