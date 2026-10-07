const cash=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
export function propertyPath(kind,id){return '/imovel/'+(kind==='land'?'terreno':'empreendimento')+'/'+encodeURIComponent(id);}
export function propertyRoute(path){const m=path.match(/^\/imovel\/(terreno|empreendimento)\/([^/]+)\/?$/);if(!m)return null;try{return {kind:m[1]==='terreno'?'land':'product',id:decodeURIComponent(m[2])};}catch{return null;}}
export function propertyMessage(item,kind,company,origin){
 const link=new URL(propertyPath(kind,item.id),origin).href;
 const lines=['Olá! Separei esta oportunidade para você:', ''];
 if(kind==='land'){
  lines.push('*Terreno em '+item.neighborhood+'*','Quadra '+item.block+' · Lote '+item.lot,'Área: '+Number(item.area).toLocaleString('pt-BR')+' m²');
  if(item.address)lines.push('Localização: '+item.address);
  lines.push('Condição: '+item.condition);
  if(item.condition==='Ágio'){lines.push('Ágio: '+cash(item.premium),'Saldo devedor: '+(item.balance==null?'sob consulta':cash(item.balance)));if(item.balance!=null){if(item.balanceDate)lines.push('Referência do saldo: '+String(item.balanceDate).slice(0,10).split('-').reverse().join('/'));lines.push('Total estimado: '+cash(Number(item.premium)+Number(item.balance)));}}
  else lines.push('Valor: '+cash(item.price));
  if(item.paymentOptions?.length)lines.push('Pagamento: '+item.paymentOptions.join(' · '));
  if(item.paymentTerms)lines.push(item.paymentTerms);
 }else{lines.push('*'+item.name+'*');if(item.location)lines.push('Localização: '+item.location);if(item.launch)lines.push('Lançamento');if(item.construction)lines.push('Liberado para construir');}
 if(item.description)lines.push('',item.description);
 lines.push('','Veja fotos e detalhes:',link,'','Valores e disponibilidade sujeitos à confirmação.');if(company?.name)lines.push(company.name);
 return lines.join('\n');
}
