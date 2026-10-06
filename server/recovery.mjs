import {randomBytes,createHash} from 'node:crypto';
import {hash,fail,audit} from './domain.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const validEmail=value=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const generic={ok:true,message:'Se houver uma conta ativa com esse e-mail, você receberá um link de recuperação. Confira também o spam. Por segurança, novos pedidos podem levar até uma hora.'};
export function passwordValue(value){const password=String(value||'');if(password.length<12||password.length>128)fail('Use uma senha de 12 a 128 caracteres.');return password;}
export function clearAccess(db,user,emails=[user.email]){
  db.sessions=db.sessions.filter(s=>s.userId!==user.id);
  db.passwordResets=(db.passwordResets||[]).filter(r=>r.userId!==user.id);
  db.attempts=db.attempts.filter(a=>!emails.includes(a.email));
}
// Explicit operator action, never a fallback login with environment credentials.
// Consumed IDs are retained so an old deployment cannot replay a completed reset.
export function recoverAdmin(db,env=process.env){
  const request=String(env.ADMIN_RECOVERY_ID||'').trim();
  if(!request||db.demo)return;
  const key=digest(request);db.adminRecoveries ||= [];
  if(db.adminRecoveries.includes(key))return;
  const user=db.users.find(u=>u.id==='u1'&&u.role==='Gestor');
  const email=String(env.ADMIN_EMAIL||'').trim().toLowerCase();
  if(!user||!validEmail(email)||db.users.some(u=>u.id!==user.id&&u.email===email))throw Error('Recuperação administrativa: confira a conta inicial e ADMIN_EMAIL.');
  const password=passwordValue(env.ADMIN_PASSWORD),previousEmail=user.email;
  user.password=hash(password);user.email=email;user.active=true;
  clearAccess(db,user,[previousEmail,email]);
  // Operator recovery also clears stale IP locks from attempts with mistyped emails.
  db.attempts=[];
  db.adminRecoveries.push(key);
  db.audit.unshift(audit(user,'Acesso administrativo recuperado','Recuperação única solicitada pela configuração do servidor.'));
}
function mailConfig(env){
  if(!env.RESEND_API_KEY||!env.EMAIL_FROM||!env.APP_URL)return null;
  try{const url=new URL(env.APP_URL);if(url.protocol!=='https:'||url.username||url.password)return null;return {key:env.RESEND_API_KEY,from:env.EMAIL_FROM,origin:url.origin};}catch{return null;}
}
export async function passwordRecovery(db,req,body,{env=process.env,send=fetch,now=Date.now()}={}){
  const v=body.data||{};
  db.passwordResets=(db.passwordResets||[]).filter(r=>r.expiresAt>now);
  if(body.action==='password.request'){
    const config=mailConfig(env);
    if(!config)return {error:'A recuperação por e-mail ainda não foi configurada. Entre em contato com o administrador.',status:503};
    const email=String(v.email||'').trim().toLowerCase();
    if(!validEmail(email))fail('Informe um e-mail válido.');
    const ip=String(req.headers['x-real-ip']||req.socket?.remoteAddress||'local'),emailKey=digest(email),ipKey=digest(ip);
    db.resetRequests=(db.resetRequests||[]).filter(r=>r.at>now-60*60*1000);
    if(db.resetRequests.length>=100||db.resetRequests.filter(r=>r.emailKey===emailKey).length>=3||db.resetRequests.filter(r=>r.ipKey===ipKey).length>=10)return generic;
    db.resetRequests.push({emailKey,ipKey,at:now});
    const user=db.users.find(u=>u.email===email&&u.active);
    if(!user)return generic;
    const token=randomBytes(32).toString('hex'),tokenHash=digest(token);
    const link=`${config.origin}/#/redefinir-senha?token=${token}`;
    const record={tokenHash,userId:user.id,email:user.email,passwordHash:user.password,expiresAt:now+30*60*1000};
    try{
      const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`password-reset-${tokenHash}`},body:JSON.stringify({from:config.from,to:[user.email],subject:'Redefina sua senha · Lotea',text:`Foi solicitada uma nova senha para sua conta.\n\nAbra este link em até 30 minutos:\n${link}\n\nSe você não fez este pedido, ignore este e-mail. Sua senha permanece a mesma.`}),signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error('provider');
      db.passwordResets.push(record);
    }catch{console.error('password_reset_delivery_failed');}
    // Never disclose whether an address exists or delivery was attempted.
    return generic;
  }
  const token=String(v.token||'');
  const record=/^[a-f0-9]{64}$/.test(token)?db.passwordResets.find(r=>r.tokenHash===digest(token)):null;
  const user=record&&db.users.find(u=>u.id===record.userId&&u.active&&u.email===record.email&&u.password===record.passwordHash);
  if(!user)fail('Link inválido ou expirado. Solicite uma nova recuperação de senha.');
  if(body.action==='password.inspect')return {ok:true};
  user.password=hash(passwordValue(v.password));
  clearAccess(db,user);
  // A valid reset proves control of the account and releases this browser's IP lock.
  const ip=req.headers['x-real-ip']||req.socket?.remoteAddress||'local';
  db.attempts=db.attempts.filter(a=>a.ip!==ip);
  db.audit.unshift(audit(user,'Senha redefinida','Recuperação por link de uso único. Sessões anteriores encerradas.'));
  return {ok:true};
}
