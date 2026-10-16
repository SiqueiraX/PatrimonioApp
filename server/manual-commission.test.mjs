import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSale} from './domain.mjs';
test('product sale uses manual percent, count and first due without changing product',()=>{
 const product={id:'p',name:'Produto',active:true,developerId:'d',percent:9,payDay:10,saleOptions:[{id:'o',entryMode:'none',entryInstallments:0,commissionMode:'fixed',commissionInstallments:12}]};
 const db={products:[product],users:[{id:'b',active:true}],lands:[]};
 const s=validateSale({productId:'p',optionId:'o',brokerId:'b',client:'Cliente',contact:'123',block:'1',lot:'2',date:'2026-01-01',value:100000,contract:'Aguardando assinatura',leadSource:'Indicação',percent:3,installments:3,payDay:31,firstCommissionDue:'2026-01-31'},db,{role:'Gestor'});
 assert.equal(s.rule.percent,3);assert.equal(s.commissions.length,3);assert.equal(s.commissions.reduce((a,p)=>a+p.amount,0),3000);assert.deepEqual(s.commissions.map(p=>p.due),['2026-01-31','2026-02-28','2026-03-31']);assert.equal(product.percent,9);assert.equal(product.saleOptions[0].commissionInstallments,12);
});
