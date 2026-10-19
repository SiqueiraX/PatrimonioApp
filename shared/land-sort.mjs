const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
export function sortLands(lands,{key,direction}){
 if(!key)return lands;
 const sign=direction==='desc'?-1:1;
 const value=l=>key==='value'?(l.condition==='Ágio'?l.premium:l.price):l[key];
 return [...lands].sort((a,b)=>{
  if(key==='blockLot')return sign*(collator.compare(a.block||'',b.block||'')||collator.compare(a.lot||'',b.lot||''));
  const x=value(a),y=value(b),missing=v=>v==null||v==='';
  if(missing(x)||missing(y))return Number(missing(x))-Number(missing(y));
  return sign*(['area','value'].includes(key)?Number(x)-Number(y):collator.compare(x,y));
 });
}
