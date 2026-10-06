// Amounts are summed in cents to avoid floating-point drift in progress totals.
export function goalActivity(sales, user) {
  const months=new Map();
  for(const s of sales){
    if(s.status==='Cancelada'||s.contract!=='Assinado')continue;
    const month=s.date.slice(0,7),cents=Math.round(Number(s.value)*100);
    if(!months.has(month))months.set(month,{month,teamCents:0,individualCents:{}});
    const row=months.get(month);row.teamCents+=cents;
    if(user.role==='Gestor'||s.brokerId===user.id)row.individualCents[s.brokerId]=(row.individualCents[s.brokerId]||0)+cents;
  }
  return [...months.values()];
}
export function goalProgress(activity,goals,type,period,brokerId){
  const rows=activity.filter(r=>type==='month'?r.month===period:r.month.slice(0,4)===period);
  const goal=goals.find(g=>g.type===type&&g.period===period);
  return {goal,team:rows.reduce((a,r)=>a+r.teamCents,0)/100,individual:rows.reduce((a,r)=>a+(r.individualCents[brokerId]||0),0)/100};
}
