import test from 'node:test';
import assert from 'node:assert/strict';
import {publicProduct,publicLand} from './catalog.mjs';
import {matchesLand,landPrice,initial} from '../shared/catalog.mjs';
test('catalog allowlists exclude internal fields even when source grows',()=>{const privateFields={owner:'SECRET',contact:'SECRET',notes:'SECRET',history:['SECRET'],brokerId:'SECRET',password:'SECRET',percent:7,saleOptions:[{commissionInstallments:12}],newInternalField:'SECRET'};for(const project of [publicLand,publicProduct]){const result=project({...privateFields,id:'1',name:'Public',area:300,description:'Public description'});for(const key of Object.keys(privateFields))assert.equal(key in result,false);assert.ok(!JSON.stringify(result).includes('SECRET'));}});
test('public filters use total estimate for agio and exclude unknown balances in price ranges',()=>{const l={neighborhood:'Jardim',block:'2',lot:'7',address:'Rua A',area:200,condition:'Ágio',premium:40000,balance:60000};assert.equal(landPrice(l),100000);assert.ok(matchesLand(l,{...initial,q:'JARDIM',minArea:200,maxPrice:100000,minM2:500}));assert.equal(matchesLand(l,{...initial,maxM2:499}),false);assert.equal(matchesLand({...l,balance:null},{...initial,minPrice:1}),false);assert.ok(matchesLand({...l,balance:null},initial));assert.equal(matchesLand(l,{...initial,condition:'Quitado'}),false);});

test('neighborhood fallback normalizes names and gives precedence to lot photos',async()=>{
 const {neighborhoodPhotos}=await import('../shared/neighborhoods.mjs');
 const neighborhoods=[{name:'Jardim dos Ipês',photos:['bairro']}];
 assert.deepEqual(neighborhoodPhotos({neighborhood:'  JARDIM  DOS IPES ',photos:[]},neighborhoods),['bairro']);
 assert.deepEqual(neighborhoodPhotos({neighborhood:'Jardim dos Ipês',photos:['lote']},neighborhoods),['lote']);
 assert.deepEqual(neighborhoodPhotos({neighborhood:'Outro bairro'},neighborhoods),[]);
});
