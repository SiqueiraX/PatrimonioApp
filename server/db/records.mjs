import {duplicateKey} from '../domain.mjs';
const snake=s=>s.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
const date=v=>v?String(v).slice(0,10):'';
const time=v=>v?new Date(v).getTime():undefined;
const nullable=v=>v===''||v===undefined?null:v;
// Every business field maps to a typed SQL column; no entity is stored as JSON.
function table(name,list,fields,{key=['id'],dates=[],times=[],numbers=[],aliases={}}={}){
 const mapping=fields.split(' ').filter(Boolean).map(field=>[field,aliases[field]||snake(field)]);
 return {name,list,key, mapping,
 encode:o=>Object.fromEntries(mapping.map(([field,column])=>[column,dates.includes(field)?nullable(o[field]):times.includes(field)?(o[field]?new Date(o[field]).toISOString():null):o[field]??null])),
 decode:r=>Object.fromEntries(mapping.map(([field,column])=>[field,dates.includes(field)?date(r[column]):times.includes(field)?time(r[column]):numbers.includes(field)?(r[column]===null?null:Number(r[column])):r[column] instanceof Date?r[column].toISOString():r[column]]))};
}
export const tables=[
 table('users','users','id name email password role active',{aliases:{password:'password_hash'}}),
 table('developers','developers','id name contact'),
 table('products','products','id developerId name location description mapUrl launch construction active percent payDay',{aliases:{percent:'commission_percent',payDay:'payment_day'},numbers:['percent','payDay']}),
 table('product_conditions','conditions','productId id entryMode entryInstallments commissionMode commissionInstallments',{key:['product_id','id'],numbers:['entryInstallments','commissionInstallments']}),
 table('product_photos','productPhotos','productId position dataUrl',{key:['product_id','position'],numbers:['position']}),
 table('lands','lands','id neighborhood block lot duplicateKey area condition price premium balance balanceDate owner contact address description notes paymentTerms paymentOptions brokerId availability',{dates:['balanceDate'],numbers:['area','price','premium','balance']}),
 table('land_photos','landPhotos','landId position dataUrl',{key:['land_id','position'],numbers:['position']}),
 table('sales','sales','id client contact productId productName developerId brokerId block lot date value contract signedAt leadSource optionId entryMode entryInstallments commissionMode commissionInstallments percent payDay initial initialDue paidAt notes status',{aliases:{date:'sale_date',percent:'commission_percent',payDay:'payment_day'},dates:['date','signedAt','initialDue','paidAt'],numbers:['value','entryInstallments','commissionInstallments','percent','payDay','initial']}),
 table('entry_installments','entries','id saleId number amount due paidAt',{dates:['due','paidAt'],numbers:['number','amount']}),
 table('commission_installments','commissions','id saleId number amount due received receivedAt',{dates:['due','receivedAt'],numbers:['number','amount','received']}),
 table('goals','goals','type period individual team updatedAt updatedBy',{key:['type','period'],numbers:['individual','team']}),
 table('invitations','invitations','id email role tokenHash createdAt createdBy createdByName expiresAt usedAt revokedAt',{times:['createdAt','expiresAt','usedAt','revokedAt']}),
 table('sessions','sessions','token userId expires',{key:['token_hash'],aliases:{token:'token_hash',expires:'expires_at'},times:['expires']}),
 table('login_attempts','attempts','id email ip at',{aliases:{at:'attempted_at'},times:['at']}),
 table('password_resets','passwordResets','tokenHash userId email passwordHash expiresAt',{key:['token_hash'],times:['expiresAt']}),
 table('reset_requests','resetRequests','id emailKey ipKey at',{aliases:{at:'requested_at'},times:['at']}),
 table('admin_recoveries','recoveries','requestHash',{key:['request_hash']}),
 ...[['audit_events','audit',''],['land_history','landHistory','landId'],['sale_history','saleHistory','saleId'],['commission_history','commissionHistory','commissionId']].map(([name,list,parent])=>table(name,list,`id ${parent} at author authorId action details`))
];
export const byName=Object.fromEntries(tables.map(t=>[t.name,t]));
export function empty(){return {demo:false,users:[],developers:[],products:[],lands:[],sales:[],goals:[],invitations:[],sessions:[],attempts:[],passwordResets:[],resetRequests:[],adminRecoveries:[],audit:[]};}
export function hydrate(rows){
 const lists=Object.fromEntries(tables.map(t=>[t.list,(rows[t.name]||[]).map(r=>t.decode(r))]));
 const db={...empty(),...lists};
 db.adminRecoveries=lists.recoveries.map(r=>r.requestHash);
 for(const p of db.products){p.saleOptions=lists.conditions.filter(o=>o.productId===p.id).map(({productId,...o})=>o);p.photos=lists.productPhotos.filter(o=>o.productId===p.id).sort((a,b)=>a.position-b.position).map(o=>o.dataUrl);}
 for(const l of db.lands){l.photos=lists.landPhotos.filter(o=>o.landId===l.id).sort((a,b)=>a.position-b.position).map(o=>o.dataUrl);l.history=lists.landHistory.filter(o=>o.landId===l.id).map(({landId,...o})=>o);delete l.duplicateKey;}
 for(const s of db.sales){s.rule={percent:s.percent,payDay:s.payDay,installments:s.commissionInstallments};s.paymentPlan={id:s.optionId,entryMode:s.entryMode,entryInstallments:s.entryInstallments,commissionMode:s.commissionMode,commissionInstallments:s.commissionInstallments};s.entryPayments=lists.entries.filter(o=>o.saleId===s.id).map(({saleId,...o})=>o);s.commissions=lists.commissions.filter(o=>o.saleId===s.id).map(({saleId,...o})=>({...o,history:lists.commissionHistory.filter(h=>h.commissionId===o.id).map(({commissionId,...h})=>h)}));s.history=lists.saleHistory.filter(o=>o.saleId===s.id).map(({saleId,...o})=>o);}
 return db;
}
export function flatten(db){
 const lists={...db,conditions:[],productPhotos:[],landPhotos:[],entries:[],commissions:[],landHistory:[],saleHistory:[],commissionHistory:[],recoveries:db.adminRecoveries.map(requestHash=>({requestHash}))};
 lists.lands=db.lands.map(l=>({...l,duplicateKey:duplicateKey(l)}));
 lists.sales=db.sales.map(s=>({...s,optionId:s.paymentPlan.id,...s.paymentPlan,id:s.id,percent:s.rule.percent,payDay:s.rule.payDay,commissionInstallments:s.rule.installments}));
 for(const p of db.products){lists.conditions.push(...p.saleOptions.map(o=>({...o,productId:p.id})));lists.productPhotos.push(...p.photos.map((dataUrl,position)=>({productId:p.id,position,dataUrl})));}
 for(const l of db.lands){lists.landPhotos.push(...l.photos.map((dataUrl,position)=>({landId:l.id,position,dataUrl})));lists.landHistory.push(...l.history.map(h=>({...h,landId:l.id})));}
 for(const s of db.sales){lists.entries.push(...s.entryPayments.map(p=>({...p,saleId:s.id})));lists.commissions.push(...s.commissions.map(p=>({...p,saleId:s.id})));lists.saleHistory.push(...s.history.map(h=>({...h,saleId:s.id})));for(const p of s.commissions)lists.commissionHistory.push(...p.history.map(h=>({...h,commissionId:p.id})));}
 return Object.fromEntries(tables.map(t=>[t.name,(lists[t.list]||[]).map(o=>t.encode(o))]));
}
