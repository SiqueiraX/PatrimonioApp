import {fail,text,photos} from './domain.mjs';
export function validateProfile(v){
 const name=text(v.name,'Nome');if(name.length>150)fail('Use até 150 caracteres no nome.');
 const email=text(v.email,'E-mail').toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Informe um e-mail válido.');
 const raw=String(v.cpf||'').trim(),cpf=raw.replace(/[.\-\s]/g,'');
 if(cpf){
  if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))fail('Informe um CPF válido.');
  for(let length=9;length<=10;length++){let sum=0;for(let i=0;i<length;i++)sum+=Number(cpf[i])*(length+1-i);const digit=(sum*10)%11%10;if(digit!==Number(cpf[length]))fail('Informe um CPF válido.');}
 }
 const creci=text(v.creci,'CRECI',false);if(creci.length>40)fail('Use até 40 caracteres no CRECI.');
 const photo=String(v.photo||'');if(photo.length>200000)fail('A foto de perfil ficou muito grande. Escolha uma imagem menor.');if(photo)photos([photo]);
 return {name,email,cpf,creci,photo};
}
