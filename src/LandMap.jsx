import React,{useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {coordinates,hasCoordinates} from '../shared/coordinates.mjs';
import './map.css';
const cash=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const pin=(count=1)=>L.divIcon({className:'company-map-pin',html:`<span>${count>1?'<b>'+count+'</b>':'<i></i>'}</span>`,iconSize:[38,46],iconAnchor:[19,44],popupAnchor:[0,-40]});
function MapCanvas({lands=[],onDetails,point,onPick}){
 const el=useRef(),map=useRef(),layer=useRef(),actions=useRef({onDetails,onPick}),[failed,setFailed]=useState(false);
 actions.current={onDetails,onPick};
 useEffect(()=>{
  const m=L.map(el.current,{scrollWheelZoom:false,maxZoom:19,minZoom:2}).setView([-14,-54],4);map.current=m;
  let disposed=false;
  m.attributionControl.addAttribution('<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> · <a href="/map-credits.txt" target="_blank" rel="noopener noreferrer">Estilo Positron</a>');
  Promise.all([import('maplibre-gl'),import('@maplibre/maplibre-gl-leaflet')]).then(([gl,plugin])=>{if(disposed)return;gl.setWorkerUrl(workerUrl);const base=plugin.maplibreGL({style:'/property-map-style.json',attributionControl:false}).addTo(m);base.getMaplibreMap().on('error',()=>{if(!disposed)setFailed(true);});}).catch(()=>{if(!disposed)setFailed(true);});
  layer.current=L.layerGroup().addTo(m);
  m.on('click',e=>actions.current.onPick?.({latitude:+e.latlng.lat.toFixed(7),longitude:+e.latlng.wrap().lng.toFixed(7)}));
  const resize=new ResizeObserver(()=>m.invalidateSize());resize.observe(el.current);
  return()=>{disposed=true;resize.disconnect();m.remove();map.current=null;};
 },[]);
 const key=JSON.stringify(onPick?point:lands.map(l=>[l.id,l.latitude,l.longitude,l.neighborhood,l.block,l.lot,l.area,l.condition,l.price,l.premium,l.photos?.[0]]));
 useEffect(()=>{
  const m=map.current,g=layer.current;if(!m||!g)return;g.clearLayers();
  if(onPick){if(hasCoordinates(point||{})){const p=coordinates(point),pos=[p.latitude,p.longitude];L.marker(pos,{icon:pin(),draggable:true,alt:'Localização do terreno',title:'Arraste para ajustar o terreno'}).on('dragend',e=>{const p=e.target.getLatLng().wrap();actions.current.onPick?.({latitude:+p.lat.toFixed(7),longitude:+p.lng.toFixed(7)});}).addTo(g);m.setView(pos,Math.max(m.getZoom(),15));}return;}
  const groups=new Map();for(const l of lands){if(!hasCoordinates(l))continue;const k=l.latitude+','+l.longitude;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(l);}
  for(const rows of groups.values()){
   const first=rows[0],content=document.createElement('div');content.className='land-map-popup';
   for(const l of rows){const card=document.createElement('section');if(l.photos?.[0]){const img=document.createElement('img');img.src=l.photos[0];img.alt='Terreno em '+l.neighborhood;card.append(img);}const name=document.createElement('strong');name.textContent=l.neighborhood;card.append(name);const meta=document.createElement('p');meta.textContent=`Quadra ${l.block} · Lote ${l.lot} · ${l.area} m²`;card.append(meta);const price=document.createElement('p');price.textContent=(l.condition==='Ágio'?'Ágio: ':'Valor: ')+cash(l.condition==='Ágio'?l.premium:l.price);card.append(price);const btn=document.createElement('button');btn.type='button';btn.textContent='Ver detalhes';btn.addEventListener('click',()=>actions.current.onDetails?.(l));card.append(btn);content.append(card);}
   L.marker([first.latitude,first.longitude],{icon:pin(rows.length),title:rows.length>1?rows.length+' terrenos neste ponto':first.neighborhood+' · Q'+first.block+' L'+first.lot,alt:rows.length>1?rows.length+' terrenos neste ponto':'Terreno em '+first.neighborhood}).bindPopup(content,{maxWidth:290,maxHeight:320}).addTo(g);
  }
  if(groups.size)m.fitBounds([...groups.values()].map(r=>[r[0].latitude,r[0].longitude]),{padding:[45,45],maxZoom:16});
 },[key]);
 return <div className="land-map-wrap">{failed&&<p role="status" className="map-warning">Parte do mapa não carregou. Você ainda pode consultar os terrenos na lista ou informar as coordenadas.</p>}<div ref={el} className="land-map" aria-label={onPick?'Mapa para marcar a localização do terreno':'Mapa dos terrenos disponíveis'}/><small className="map-help">{onPick?'Clique para marcar o ponto ou arraste o pin. Use + e − para aproximar.':'Clique nos pins para conhecer os terrenos. Use + e − para aproximar.'}</small></div>;
}
export default function LandMap(props){return <MapCanvas {...props}/>;}
export function LocationFields({value,onChange}){
 const [open,setOpen]=useState(false),[pair,setPair]=useState(''),[error,setError]=useState('');
 return <section className="wide location-fields"><h3>Localização no mapa público</h3><p className="form-help">Informe as coordenadas exatas ou marque no mapa. Sem localização, o terreno aparece apenas na lista.</p><div className="coordinate-fields"><label>Latitude<input aria-label="Latitude" inputMode="decimal" value={value.latitude??''} onChange={e=>onChange({latitude:e.target.value,longitude:value.longitude??''})}/></label><label>Longitude<input aria-label="Longitude" inputMode="decimal" value={value.longitude??''} onChange={e=>onChange({latitude:value.latitude??'',longitude:e.target.value})}/></label></div><div className="coordinate-paste"><label>Colar coordenadas<input aria-label="Colar coordenadas" placeholder="Ex.: -11.8642, -55.5031" value={pair} onChange={e=>setPair(e.target.value)}/></label><button type="button" onClick={()=>{try{const parts=pair.trim().split(/[;\s]+|,\s*/).filter(Boolean);if(parts.length!==2)throw Error('Cole latitude e longitude em graus decimais, separadas por vírgula.');onChange(coordinates({latitude:parts[0],longitude:parts[1]}));setError('');}catch(e){setError(e.message);}}}>Usar coordenadas</button></div>{error&&<p role="alert" className="error">{error}</p>}<div className="actions"><button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Fechar mapa':'Marcar no mapa'}</button><button type="button" onClick={()=>{onChange({latitude:null,longitude:null});setPair('');setError('');}}>Remover localização</button></div>{open&&<MapCanvas point={{latitude:value.latitude,longitude:value.longitude}} onPick={onChange}/>}</section>;
}
