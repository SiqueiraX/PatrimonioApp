import {neighborhoodKey} from '../shared/neighborhoods.mjs';
import {validateBrand} from './branding.mjs';
import {validateProfile} from './profile.mjs';
import {passwordRecovery,passwordValue} from './recovery.mjs';
import {LEAD_SOURCES, clientStatus} from '../shared/sales.mjs';
import {randomBytes,createHash} from 'node:crypto';
import {transaction} from './store.mjs';
import {id,fail,photos,text,num,date,choice,hash,verify,validateLand,validateProduct,validateSale,validateGoal,rules,scoped,publicUser,audit,duplicateKey,today,money} from './domain.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex');
function manager(u){if(u.role!=='Gestor')fail('Somente gestores podem realizar esta ação.',403);}
function ownedSale(db,u,sid){const s=db.sales.find(s=>s.id===sid);if(!s||u.role!=='Gestor'&&s.brokerId!==u.id)fail('Venda não encontrada.',404);return s;}
function event(db,u,action,details){db.audit.unshift(audit(u,action,details));}
export async function execute(db,req,res,body){
const now=Date.now();db.sessions=db.sessions.filter(s=>s.expires>now);db.attempts=(db.attempts||[]).filter(a=>a.at>now-15*60*1000);
const action=body.action;
db.invitations ||= [];

if(['password.request','password.inspect','password.reset'].includes(action))return passwordRecovery(db,req,body);
if(action==='info')return {demo:db.demo,registration:'invite'};
if(action==='invite.inspect'||action==='invite.accept'){
  const v=body.data||{},token=String(v.token||'');
  const invite=/^[a-f0-9]{64}$/.test(token)?db.invitations.find(i=>i.tokenHash===digest(token)&&!i.usedAt&&!i.revokedAt&&i.expiresAt>now):null;
  if(!invite)fail('Convite inválido, expirado ou já utilizado. Peça um novo link ao gestor.',400);
  if(action==='invite.inspect')return {email:invite.email,role:invite.role,expiresAt:invite.expiresAt};
  if(db.users.some(u=>u.email===invite.email))fail('Este e-mail já possui uma conta. Entre com sua senha.');
  const name=text(v.name,'Nome completo'),password=String(v.password||'');
  if(password.length<12||password.length>128)fail('Use uma senha de 12 a 128 caracteres.');
  const created={id:id(),name,email:invite.email,role:invite.role,active:true,password:hash(password)};
  db.users.push(created);invite.usedAt=now;
  event(db,created,'Conta criada por convite',`Convite de ${invite.createdByName}`);
  return {ok:true,email:created.email};
}
if(action==='login'){
const email=String(body.email||'').trim().toLowerCase(),ip=req.headers['x-real-ip']||req.socket?.remoteAddress||'local';if(db.attempts.filter(a=>a.email===email||a.ip===ip).length>=10)return {error:'Muitas tentativas. Aguarde 15 minutos.',status:429};
const user=db.users.find(u=>u.email===email&&u.active);if(!user||!verify(String(body.password||''),user.password)){db.attempts.push({email,ip,at:now});return {error:'E-mail ou senha incorretos.',status:401};}
const token=randomBytes(32).toString('hex');db.sessions.push({token:digest(token),userId:user.id,expires:now+12*60*60*1000});res.setHeader('Set-Cookie',`lotea_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.VERCEL?'; Secure':''}`);return scoped(db,user);
}
const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('lotea_session='))?.split('=')[1];const session=db.sessions.find(s=>s.token===digest(cookie||'')),user=db.users.find(u=>u.id===session?.userId&&u.active);if(!user)fail('Entre para acessar sua conta.',401);
if(action==='logout'){db.sessions=db.sessions.filter(s=>s!==session);res.setHeader('Set-Cookie','lotea_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return {ok:true};}
if(action==='state')return scoped(db,user);
const v=body.data||{};
if(action==='branding.save'){
 manager(user);db.company=validateBrand(v);event(db,user,'Identidade visual atualizada','Nome, logo e cores da empresa atualizados.');
}else if(action==='profile.save'){
 const valid=validateProfile(v),newPassword=v.newPassword?passwordValue(v.newPassword):'',sensitive=valid.email!==user.email||!!newPassword;
 if(sensitive){
  const ip=req.headers['x-real-ip']||req.socket?.remoteAddress||'local';
  if(db.attempts.filter(a=>a.email===user.email||a.ip===ip).length>=10)return {error:'Muitas tentativas. Aguarde 15 minutos.',status:429};
  if(String(v.currentPassword||'').length>128||!verify(String(v.currentPassword||''),user.password)){db.attempts.push({email:user.email,ip,at:now});return {error:'Senha atual incorreta. Nenhuma alteração foi salva.',status:400};}
 }
 if(db.users.some(u=>u.id!==user.id&&u.email===valid.email))fail('Este e-mail já está em uso.');
 Object.assign(user,valid);if(newPassword)user.password=hash(newPassword);
 if(sensitive){
  db.passwordResets=(db.passwordResets||[]).filter(r=>r.userId!==user.id);
  db.sessions=db.sessions.filter(s=>s.userId!==user.id);
  const token=randomBytes(32).toString('hex');db.sessions.push({token:digest(token),userId:user.id,expires:now+12*60*60*1000});
  res.setHeader('Set-Cookie',`lotea_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.VERCEL?'; Secure':''}`);
 }
 event(db,user,'Perfil atualizado',sensitive?'Dados de acesso atualizados e outras sessões encerradas.':'Dados pessoais atualizados.');
}else if(action==='goals.save'){
  manager(user);const valid=validateGoal(v);db.goals ||= [];
  const old=db.goals.find(g=>g.type===valid.type&&g.period===valid.period);
  event(db,user,'Metas atualizadas',JSON.stringify({antes:old||null,depois:valid}));
  const record={...valid,updatedAt:new Date().toISOString(),updatedBy:user.id};
  if(old)Object.assign(old,record);else db.goals.push(record);
}else if(action==='invite.create'){
  manager(user);
  const email=text(v.email,'E-mail').toLowerCase(),role=choice(v.role,['Corretor','Gestor'],'Cargo');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('E-mail inválido.');
  if(db.users.some(u=>u.email===email))fail('Este e-mail já possui uma conta.');
  for(const i of db.invitations)if(i.email===email&&!i.usedAt&&!i.revokedAt)i.revokedAt=now;
  const token=randomBytes(32).toString('hex');
  db.invitations.unshift({id:id(),email,role,tokenHash:digest(token),createdAt:now,createdBy:user.id,createdByName:user.name,expiresAt:now+7*86400000});
  event(db,user,'Convite criado',`${email} · ${role}`);
  return {...scoped(db,user),invitationToken:token};
}else if(action==='invite.revoke'){
  manager(user);const invite=db.invitations.find(i=>i.id===v.id);
  if(!invite||invite.usedAt)fail('Convite não disponível.');
  invite.revokedAt=now;event(db,user,'Convite revogado',invite.email);
}else if(action==='land.save'){
const old=db.lands.find(l=>l.id===v.id);if(v.id&&!old)fail('Terreno não encontrado.',404);if(old&&user.role!=='Gestor'&&old.brokerId!==user.id)fail('Você só pode editar os terrenos pelos quais é responsável.',403);const valid=validateLand(old&&!Object.hasOwn(v,'latitude')&&!Object.hasOwn(v,'longitude')?{...v,latitude:old.latitude,longitude:old.longitude}:v,db,user);if(db.lands.some(l=>l.id!==old?.id&&duplicateKey(l)===duplicateKey(valid)))fail('Já existe um terreno com esse bairro, quadra e lote.');if(old){const changes=[];for(const [k,label] of Object.entries({price:'Preço',premium:'Ágio',balance:'Saldo devedor',availability:'Disponibilidade',paymentTerms:'Condições de pagamento',paymentOptions:'Formas de pagamento'}))if(JSON.stringify(old[k])!==JSON.stringify(valid[k]))changes.push(`${label}: ${old[k]??'—'} → ${valid[k]??'—'}`);Object.assign(old,valid);old.history.unshift(audit(user,'Terreno atualizado',changes.join('\n')||'Dados cadastrais atualizados.'));}else db.lands.unshift({...valid,id:id(),history:[audit(user,'Terreno cadastrado')]});event(db,user,old?'Terreno atualizado':'Terreno cadastrado',`${valid.neighborhood} · Q${valid.block} L${valid.lot}`);
}else if(action==='land.activity'){const l=db.lands.find(l=>l.id===v.id);if(!l)fail('Terreno não encontrado.',404);l.history.unshift(audit(user,'Atividade',text(v.content,'Atividade')));
}else if(action==='land.import'){
if(!Array.isArray(v.rows)||v.rows.length>2000)fail('Importe até 2.000 registros por vez.');choice(v.strategy,['skip','update'],'Tratamento de duplicidades');let imported=0,updated=0,skipped=0,errors=[];for(let i=0;i<v.rows.length;i++){try{const raw=v.rows[i],valid=validateLand({...raw,brokerId:raw.brokerId||user.id,availability:raw.availability||'Disponível',photos:raw.photos||[]},db,user),old=db.lands.find(l=>duplicateKey(l)===duplicateKey(valid));if(old&&v.strategy==='skip'){skipped++;continue;}if(old){if(user.role!=='Gestor'&&old.brokerId!==user.id)fail('Sem permissão para atualizar este terreno.');const previous={...old};if(!Object.hasOwn(raw,'latitude')&&!Object.hasOwn(raw,'longitude')){valid.latitude=old.latitude;valid.longitude=old.longitude;}Object.assign(old,valid);old.history.unshift(audit(user,'Atualizado por importação',JSON.stringify({antes:previous,novo:valid},(key,value)=>key==='photos'||key==='history'?undefined:value)));updated++;}else{db.lands.unshift({...valid,id:id(),history:[audit(user,'Importado de planilha')]});imported++;}}catch(e){errors.push({row:i+2,message:e.message});}}event(db,user,'Planilha importada',`${imported} novos, ${updated} atualizados, ${skipped} ignorados, ${errors.length} erros.`);return {...scoped(db,user),importResult:{imported,updated,skipped,errors}};
}else if(action==='product.save'){manager(user);const valid=validateProduct(v,db),old=db.products.find(p=>p.id===v.id);if(v.id&&!old)fail('Produto não encontrado.',404);event(db,user,old?'Produto atualizado':'Produto cadastrado',JSON.stringify({antes:old,depois:valid},(key,value)=>key==='photos'?undefined:value));if(old)Object.assign(old,valid);else db.products.push({...valid,id:id()});
}else if(action==='neighborhood.save'){
 manager(user);db.neighborhoods ||= [];
 const name=text(v.name,'Bairro'),nameKey=neighborhoodKey(name),valid={name,nameKey,photos:photos(v.photos)},old=db.neighborhoods.find(n=>n.id===v.id);
 if(v.id&&!old)fail('Bairro não encontrado.',404);
 if(db.neighborhoods.some(n=>n.id!==v.id&&n.nameKey===nameKey))fail('Este bairro já está cadastrado. Edite suas fotos no cadastro existente.');
 if(old){for(const l of db.lands)if(neighborhoodKey(l.neighborhood)===old.nameKey)l.neighborhood=name;Object.assign(old,valid);}else db.neighborhoods.push({...valid,id:id()});
 event(db,user,old?'Bairro atualizado':'Bairro cadastrado',name);
}else if(action==='developer.save'){manager(user);const valid={name:text(v.name,'Nome'),contact:text(v.contact,'Contato')},old=db.developers.find(d=>d.id===v.id);if(v.id&&!old)fail('Loteadora não encontrada.',404);event(db,user,old?'Loteadora atualizada':'Loteadora cadastrada',JSON.stringify({antes:old,depois:valid}));if(old)Object.assign(old,valid);else db.developers.push({...valid,id:id()});
}else if(action==='sale.create'){const valid=validateSale(v,db,user);valid.id=id();valid.history.push(audit(user,'Venda registrada'));db.sales.unshift(valid);event(db,user,'Venda registrada',valid.client);
}else if(action==='sale.update'){
  const s=ownedSale(db,user,v.id);if(s.status==='Cancelada')fail('A venda está cancelada.');
  const contract=choice(v.contract,['Aguardando assinatura','Assinado'],'Contrato'),signedAt=date(v.signedAt,'Assinatura',true),status=choice(v.status,['Em andamento','Concluída'],'Situação');
  const paidAt=s.paymentPlan?s.paidAt:date(v.paidAt,'Pagamento',true);
  const leadSource=v.leadSource?choice(v.leadSource,LEAD_SOURCES,'Origem do lead'):(s.leadSource||'');
  if(contract==='Assinado'&&!signedAt)fail('Informe a data de assinatura.');
  if(signedAt>today()||paidAt>today())fail('A data não pode estar no futuro.');
  const payment=clientStatus({...s,paidAt},today());
  if(status==='Concluída'&&(contract!=='Assinado'||!['Pago','Sem entrada'].includes(payment)))fail('Para concluir, registre a assinatura e o pagamento de todas as parcelas da entrada.');
  const changes={contract,signedAt:contract==='Assinado'?signedAt:'',paidAt,status,leadSource,notes:text(v.notes,'Observações',false)};
  s.history.unshift(audit(user,'Venda atualizada',JSON.stringify({antes:{contract:s.contract,signedAt:s.signedAt,paidAt:s.paidAt,status:s.status,leadSource:s.leadSource},depois:changes})));Object.assign(s,changes);
}else if(action==='entry.pay'){
  const s=ownedSale(db,user,v.saleId);if(s.status==='Cancelada')fail('A venda está cancelada.');
  const p=s.entryPayments?.find(p=>p.id===v.id);if(!p)fail('Parcela da entrada não encontrada.',404);
  if(p.paidAt)fail('Esta parcela já foi registrada como paga.');
  const paidAt=date(v.paidAt,'Data do pagamento');if(paidAt>today())fail('O pagamento não pode estar no futuro.');
  p.paidAt=paidAt;
  s.paidAt=s.entryPayments.every(p=>p.paidAt)?s.entryPayments.map(p=>p.paidAt).sort().at(-1):'';
  s.history.unshift(audit(user,'Pagamento da entrada registrado',`Parcela ${p.number}: ${p.amount.toFixed(2)} em ${paidAt}`));
}else if(action==='sale.cancel'){manager(user);const s=ownedSale(db,user,v.id);if(s.status==='Cancelada')fail('Venda já cancelada.');s.status='Cancelada';s.history.unshift(audit(user,'Venda cancelada',text(v.reason,'Motivo')));event(db,user,'Venda cancelada',s.client);
}else if(action==='commission.receive'){manager(user);const s=ownedSale(db,user,v.saleId),p=s.commissions.find(p=>p.id===v.id);if(!p)fail('Parcela não encontrada.',404);if(s.status==='Cancelada')fail('Não é possível receber comissão de venda cancelada.');const amount=num(v.amount,'Valor recebido',0.01,p.amount-p.received),receivedAt=date(v.receivedAt,'Data do recebimento');if(receivedAt>today())fail('O recebimento não pode estar no futuro.');p.received=money(p.received+amount)/100;p.receivedAt=receivedAt;const ev=audit(user,'Recebimento registrado',`${amount.toFixed(2)} em ${receivedAt}`);p.history.unshift(ev);s.history.unshift({...ev,details:`Parcela ${p.number}: ${ev.details}`});event(db,user,'Comissão recebida',`${s.client}: ${amount.toFixed(2)}`);
}else if(action==='user.save'){manager(user);if(!v.id)fail('Para criar uma conta, gere um convite para o usuário.');const old=db.users.find(u=>u.id===v.id),valid={name:text(v.name,'Nome'),email:text(v.email,'E-mail').toLowerCase(),role:choice(v.role,['Gestor','Corretor'],'Cargo'),active:!!v.active};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valid.email))fail('E-mail inválido.');if(db.users.some(u=>u.id!==old?.id&&u.email===valid.email))fail('Este e-mail já está cadastrado.');if(v.id&&!old)fail('Usuário não encontrado.',404);if(old?.id===user.id&&(!valid.active||valid.role!=='Gestor'))fail('Você não pode desativar ou rebaixar sua própria conta.');if(!old||v.password){if(String(v.password||'').length<12)fail('A senha precisa ter pelo menos 12 caracteres.');valid.password=hash(v.password);}if(old){Object.assign(old,valid);db.sessions=db.sessions.filter(s=>s.userId!==old.id||s===session);}else db.users.push({...valid,id:id()});event(db,user,old?'Usuário atualizado':'Usuário cadastrado',valid.email);
}else fail('Ação não encontrada.',404);
return scoped(db,user);
}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');try{if(req.method!=='POST')fail('Método não permitido.',405);if(req.headers['sec-fetch-site']==='cross-site')fail('Origem não permitida.',403);if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host)fail('Origem não permitida.',403);}if(!String(req.headers['content-type']||'').includes('application/json'))fail('Formato de requisição inválido.',415);let body=req.body;if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4000000)fail('Arquivo muito grande. Reduza as fotos ou divida a importação.',413);}body=JSON.parse(raw||'{}');}else if(typeof body==='string')body=JSON.parse(body);const result=await transaction(db=>execute(db,req,res,body),{req,body});res.statusCode=result.status||200;res.end(JSON.stringify(result));}catch(e){res.statusCode=e.status||500;res.end(JSON.stringify({error:e.status?e.message:'Não foi possível concluir a operação. Verifique a configuração do servidor.'}));if(!e.status)console.error(e);}}
