import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverAdmin,passwordRecovery} from './recovery.mjs';
import {hash,verify,scoped} from './domain.mjs';
const req={headers:{'x-real-ip':'test-ip'}};
const env={APP_URL:'https://example.com',RESEND_API_KEY:'test-only',EMAIL_FROM:'Lotea <test@example.com>'};
function fixture(){return {demo:false,users:[{id:'u1',name:'Admin',email:'admin@example.com',role:'Gestor',active:true,password:hash('OriginalPassword123')},{id:'u2',name:'Broker',email:'broker@example.com',role:'Corretor',active:true,password:hash('OriginalPassword123')}],sessions:[{userId:'u1',token:'old'},{userId:'u2',token:'other'}],attempts:[{email:'admin@example.com',ip:'test-ip',at:Date.now()}],audit:[],sales:[{id:'preserve'}],lands:[],products:[],developers:[]};}
const request=(db,email,options)=>passwordRecovery(db,req,{action:'password.request',data:{email}},options);
const use=(db,action,token,password)=>passwordRecovery(db,req,{action,data:{token,password}});
function delivery(){let sent=[];return {sent,send:async(url,options)=>{sent.push({url,options,body:JSON.parse(options.body)});return {ok:true};},token:()=>sent.at(-1).body.text.match(/token=([a-f0-9]{64})/)[1]};}
test('admin recovery: explicit one-time configuration, identity/data preserved, no replay on redeploy',()=>{
 const db=fixture(),original=db.users[0].password;recoverAdmin(db,{ADMIN_EMAIL:'new@example.com',ADMIN_PASSWORD:'ChangedPassword123'});assert.equal(db.users[0].password,original);
 const config={ADMIN_RECOVERY_ID:'recovery-1',ADMIN_EMAIL:' New@example.com ',ADMIN_PASSWORD:'ChangedPassword123'};recoverAdmin(db,config);
 assert.equal(db.users[0].email,'new@example.com');assert.equal(db.users[0].id,'u1');assert.ok(verify(config.ADMIN_PASSWORD,db.users[0].password));assert.deepEqual(db.sales,[{id:'preserve'}]);assert.equal(db.sessions.length,1);assert.equal(db.sessions[0].userId,'u2');assert.equal(db.attempts.length,0);
 db.users[0].password=hash('LaterPassword123');recoverAdmin(db,config);assert.ok(verify('LaterPassword123',db.users[0].password));recoverAdmin(db,{...config,ADMIN_RECOVERY_ID:'recovery-2'});db.users[0].password=hash('LaterPassword123');recoverAdmin(db,config);assert.ok(verify('LaterPassword123',db.users[0].password));assert.equal(db.audit.length,2);
 assert.throws(()=>recoverAdmin(db,{...config,ADMIN_RECOVERY_ID:'bad',ADMIN_EMAIL:'broker@example.com'}));assert.throws(()=>recoverAdmin(db,{...config,ADMIN_RECOVERY_ID:'bad',ADMIN_PASSWORD:'short'}));assert.equal(db.adminRecoveries.length,2);
 const demo=fixture();demo.demo=true;recoverAdmin(demo,config);assert.equal(demo.users[0].email,'admin@example.com');
});
test('recovery request: generic response, fixed trusted origin, hashed tokens, rate limits and no account changes',async()=>{
 const db=fixture(),mail=delivery(),options={env,send:mail.send},old=db.users[0].password;
 const known=await request(db,'ADMIN@example.com',options),unknown=await request(db,'unknown@example.com',options);assert.deepEqual(known,unknown);assert.equal(mail.sent.length,1);
 assert.equal(mail.sent[0].url,'https://api.resend.com/emails');assert.deepEqual(mail.sent[0].body.to,['admin@example.com']);assert.ok(mail.sent[0].body.text.includes('https://example.com/#/redefinir-senha?token='));
 assert.equal(JSON.stringify(db).includes(mail.token()),false);assert.equal(db.users[0].password,old);
 await request(db,'admin@example.com',options);await request(db,'admin@example.com',options);await request(db,'admin@example.com',options);assert.equal(mail.sent.length,3);
 const state=scoped({...db,sales:[]},db.users[0]);assert.equal('passwordResets' in state,false);assert.equal('resetRequests' in state,false);assert.equal('adminRecoveries' in state,false);
});
test('reset: token ownership, expiry, single use, sessions revoked, strong password and old links invalidated',async()=>{
 const db=fixture(),mail=delivery();await request(db,'admin@example.com',{env,send:mail.send});const token=mail.token();
 await assert.rejects(use(db,'password.reset','bad','NewPassword123'));await assert.rejects(use(db,'password.reset',token,'short'));
 await use(db,'password.inspect',token);assert.equal(db.passwordResets.length,1);
 await use(db,'password.reset',token,'NewPassword123');assert.ok(verify('NewPassword123',db.users[0].password));assert.equal(db.users[1].email,'broker@example.com');assert.equal(db.sessions.length,1);assert.equal(db.attempts.length,0);assert.equal(db.passwordResets.length,0);
 await assert.rejects(use(db,'password.reset',token,'Different12345'));
 await request(db,'admin@example.com',{env,send:mail.send});db.passwordResets[0].expiresAt=Date.now()-1;await assert.rejects(use(db,'password.inspect',mail.token()));
 await request(db,'admin@example.com',{env,send:mail.send});db.users[0].password=hash('ChangedByManager123');await assert.rejects(use(db,'password.reset',mail.token(),'AnotherPassword123'));
});
test('delivery unavailable: honest configuration error, generic provider failure, no token exposed or persisted',async()=>{
 const db=fixture();assert.equal((await request(db,'admin@example.com',{env:{}})).status,503);
 assert.equal((await request(db,'admin@example.com',{env:{...env,APP_URL:'http://evil.test'}})).status,503);
 const answer=await request(db,'admin@example.com',{env,send:async()=>({ok:false})});assert.equal(answer.ok,true);assert.equal(db.passwordResets.length,0);
});
