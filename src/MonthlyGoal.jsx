import React from 'react';
const cash=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
export default function MonthlyGoal({actual,target,label}){
 const configured=Number(target)>0,percent=configured?Math.max(0,actual/target*100):0,fill=Math.min(100,percent);
 const color=!configured?'#81909a':percent<=15?'#dc2626':percent<=30?'#ea580c':percent<=50?'#fb923c':percent<=75?'#f4c430':percent<100?'#86cf78':'#16a34a';
 return <section className="monthly-goal-band" aria-label="Meta mensal de VGV da imobiliária" style={{'--goal-color':color,'--goal-fill':fill+'%'}}>
 <div className="monthly-goal-water" aria-hidden="true"/>
 <div className="monthly-goal-caption"><span>META MENSAL DA IMOBILIÁRIA</span><strong>{label}</strong><small>{!configured?'Defina a meta na página Metas':percent>=100?'Meta batida!':`Faltam ${cash(Math.max(0,target-actual))}`}</small></div>
 <div className="monthly-goal-amount"><strong>{cash(actual)}</strong><span>realizados de {configured?cash(target):'uma meta ainda não definida'}</span></div>
 <div className="monthly-goal-ring" role="progressbar" aria-label="Progresso da meta mensal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={configured?fill:undefined} aria-valuetext={configured?`${percent.toLocaleString('pt-BR',{maximumFractionDigits:1})}% da meta`:'Meta não definida'}>
 <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="goal-ring-track" cx="50" cy="50" r="43"/><circle className="goal-ring-value" cx="50" cy="50" r="43" pathLength="100" strokeDasharray={`${fill} 100`}/></svg><strong>{configured?`${Math.floor(percent)}%`:'—'}</strong></div>
 </section>;
}
