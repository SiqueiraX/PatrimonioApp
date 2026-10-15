import React from 'react';
export default function NeighborhoodFilter({options,value=[],onChange}){
 return <details className="neighborhood-filter"><summary>{value.length?value.join(', '):'Todos os bairros / condomínios'}</summary><div className="neighborhood-options"><button type="button" onClick={()=>onChange([])}>Limpar seleção</button>{options.map(n=><label key={n}><input type="checkbox" checked={value.includes(n)} onChange={e=>onChange(e.target.checked?[...value,n]:value.filter(x=>x!==n))}/>{n}</label>)}</div></details>;
}
