export function coordinates(v){
 const blank=x=>x==null||String(x).trim()==='';
 if(blank(v.latitude)&&blank(v.longitude))return {latitude:null,longitude:null};
 if(blank(v.latitude)||blank(v.longitude))throw Error('Informe latitude e longitude juntas ou deixe ambas vazias.');
 const parse=x=>typeof x==='number'?x:typeof x==='string'&&/^-?\d+(?:[.,]\d+)?$/.test(x.trim())?Number(x.trim().replace(',','.')):NaN;
 const latitude=parse(v.latitude),longitude=parse(v.longitude);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>85.05112878||Math.abs(longitude)>180)throw Error('Coordenadas inválidas. Use latitude entre -85,05112878 e 85,05112878 e longitude entre -180 e 180.');
 return {latitude,longitude};
}
export function hasCoordinates(v){try{const p=coordinates(v);return p.latitude!==null;}catch{return false;}}
