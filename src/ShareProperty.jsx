import React,{useState} from 'react';
import {propertyPath,propertyMessage} from '../shared/sharing.mjs';
export default function ShareProperty({item,kind,company,available=true}){
 const [status,setStatus]=useState(''),[manual,setManual]=useState(''),[preview,setPreview]=useState(false);
 const link=new URL(propertyPath(kind,item.id),window.location.origin).href,message=propertyMessage(item,kind,company,window.location.origin);
 async function copy(text,label){try{await navigator.clipboard.writeText(text);setStatus(label==='Mensagem'?'Mensagem copiada!':'Link copiado!');setManual('');}catch{setStatus('Selecione e copie o texto abaixo.');setManual(text);}}
 if(!available)return <p className="form-help">Este imóvel não está disponível no site público. O compartilhamento será liberado quando estiver disponível.</p>;
 return <section className="property-share"><div className="actions"><button type="button" onClick={()=>copy(message,'Mensagem')}>Copiar mensagem para WhatsApp</button><button type="button" onClick={()=>copy(link,'Link')}>Copiar link do imóvel</button><button type="button" aria-expanded={preview} onClick={()=>setPreview(!preview)}>{preview?'Ocultar mensagem':'Ver mensagem'}</button></div>{status&&<p role="status">{status}</p>}{(preview||manual)&&<textarea aria-label="Mensagem para compartilhar" readOnly value={manual||message} onFocus={e=>e.target.select()}/>}</section>;
}
