import React,{useLayoutEffect,useRef} from 'react';
const formatter=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function MoneyInput({value,onChange,name,label,required,min,max,wide}){
 const input=useRef(),cursor=useRef(null);
 const displayed=value===''||value==null?'':formatter.format(Number(value));
 useLayoutEffect(()=>{if(cursor.current!==null&&input.current){const text=input.current.value;let pos=text.length,count=0;while(pos>0&&count<cursor.current){pos--;if(/\d/.test(text[pos]))count++;}input.current.setSelectionRange(pos,pos);cursor.current=null;}},[displayed]);
 return <label className={'field '+(wide?'wide':'')}><span>{label}{required?' *':''}</span><input ref={input} name={name} type="text" inputMode="numeric" value={displayed} placeholder="0,00" required={required} onChange={e=>{const raw=e.target.value,digits=raw.replace(/\D/g,'');cursor.current=raw.slice(e.target.selectionStart).replace(/\D/g,'').length;const next=digits?(Number(digits)/100).toFixed(2):'';onChange(next);e.target.setCustomValidity('');}} onBlur={e=>{const number=Number(value);e.target.setCustomValidity(value!==''&&value!=null&&((min!=null&&number<Number(min))||(max!=null&&number>Number(max)))?'Confira o valor informado.':'');}}/></label>;
}
