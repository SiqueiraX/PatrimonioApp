import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execute} from './api.mjs';
import {validateProfile} from './profile.mjs';
import {hash,verify,scoped} from './domain.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex');
const profile={name:'Meu Nome',email:'self@example.com',cpf:'529.982.247-25',creci:'12345-F/MT',photo:''};
function fixture(){return {users:[{id:'self',name:'Corretor',email:'self@example.com',password:hash('OriginalPassword123'),role:'Corretor',active:true},{id:'other',name:'Gestor',email:'other@example.com',password:hash('OtherPassword123'),role:'Gestor',active:true}],sessions:[{userId:'self',token:digest('current'),expires:Date.now()+100000},{userId:'self',token:digest('other-device'),expires:Date.now()+100000}],attempts:[],passwordResets:[{userId:'self',tokenHash:'reset',expiresAt:Date.now()+100000}],audit:[],sales:[],lands:[],products:[],developers:[]};}
const req={headers:{cookie:'lotea_session=current','x-real-ip':'local-test'}};
test('profile validates CPF, limits and photo types; optional fields can be cleared',()=>{
 assert.equal(validateProfile(profile).cpf,'52998224725');assert.equal(validateProfile({...profile,cpf:'',creci:''}).cpf,'');
 for(const cpf of ['11111111111','52998224724','529abc98224725','123'])assert.throws(()=>validateProfile({...profile,cpf}));
 assert.throws(()=>validateProfile({...profile,photo:'data:image/svg+xml;base64,PHN2Zz4='}));assert.throws(()=>validateProfile({...profile,creci:'a'.repeat(41)}));
});
test('self editing cannot change role, active state or another user; private identifiers omitted from directory/audit',async()=>{
 const db=fixture();const result=await execute(db,req,{setHeader(){}},{action:'profile.save',data:{...profile,id:'other',role:'Gestor',active:false}});
 assert.equal(db.users[0].role,'Corretor');assert.equal(db.users[0].active,true);assert.equal(db.users[1].name,'Gestor');assert.equal(result.user.cpf,'52998224725');assert.equal(db.sessions.length,2);
 assert.equal(result.users.some(u=>'cpf' in u||'creci' in u),false);assert.equal(JSON.stringify(db.audit).includes('52998224725'),false);
 assert.equal(scoped(db,db.users[1]).users.some(u=>'cpf' in u),false);
});
test('email/password changes need current password, enforce uniqueness, rotate session and invalidate reset tokens',async()=>{
 const db=fixture(),original=db.users[0].password;let cookie;
 const res={setHeader:(key,value)=>cookie=value};
 let result=await execute(db,req,res,{action:'profile.save',data:{...profile,email:'changed@example.com',currentPassword:'wrong'}});
 assert.equal(result.status,400);assert.equal(db.users[0].email,profile.email);assert.equal(db.users[0].password,original);assert.equal(db.attempts.length,1);
 await assert.rejects(execute(db,req,res,{action:'profile.save',data:{...profile,email:'other@example.com',currentPassword:'OriginalPassword123'}}));
 result=await execute(db,req,res,{action:'profile.save',data:{...profile,email:'changed@example.com',newPassword:'NewPassword12345',currentPassword:'OriginalPassword123'}});
 assert.equal(result.user.email,'changed@example.com');assert.ok(verify('NewPassword12345',db.users[0].password));assert.equal(db.sessions.length,1);assert.notEqual(db.sessions[0].token,digest('current'));assert.equal(db.passwordResets.length,0);assert.match(cookie,/HttpOnly/);
 await assert.rejects(execute(db,req,res,{action:'state'}),e=>e.status===401);
});
test('wrong current password attempts are limited and do not alter profile',async()=>{
 const db=fixture();for(let i=0;i<10;i++)await execute(db,req,{setHeader(){}},{action:'profile.save',data:{...profile,email:'new@example.com',currentPassword:'wrong'}});
 const result=await execute(db,req,{setHeader(){}},{action:'profile.save',data:{...profile,email:'new@example.com',currentPassword:'OriginalPassword123'}});assert.equal(result.status,429);assert.equal(db.users[0].email,profile.email);
});
