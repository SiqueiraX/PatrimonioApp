export const LEAD_SOURCES = ['Indicação', 'Marketplace', 'Disparo em massa', 'Tráfego pago', 'TikTok', 'Base de contatos'];

// Existing products keep their old commission schedule until a manager edits them.
export function saleOptions(product) {
  if (Array.isArray(product?.saleOptions)) return product.saleOptions;
  return [{id:'legacy',entryMode:'with',entryInstallments:1,commissionMode:'fixed',commissionInstallments:Number(product?.installments || 1)}];
}
export function commissionCount(option) {
  return Number(option.commissionMode === 'entry' ? option.entryInstallments : option.commissionInstallments);
}
export function optionLabel(option) {
  return option.entryMode === 'none' ? 'Sem entrada' : Number(option.entryInstallments) === 1 ? 'Com entrada à vista' : `Com entrada em ${option.entryInstallments}x`;
}
export function commissionLabel(option) {
  return option.commissionMode === 'entry' ? `Comissão em ${commissionCount(option)}x, acompanha a entrada` : commissionCount(option) === 1 ? 'Comissão à vista no mês seguinte' : `Comissão fixa em ${commissionCount(option)}x`;
}
export function clientStatus(sale, today) {
  if (sale.paymentPlan?.entryMode === 'none') return 'Sem entrada';
  if (sale.entryPayments?.length) {
    if (sale.entryPayments.every(p => p.paidAt)) return 'Pago';
    return sale.entryPayments.some(p => !p.paidAt && p.due < today) ? 'Atrasado' : 'Aguardando';
  }
  return sale.paidAt ? 'Pago' : sale.initialDue < today ? 'Atrasado' : 'Aguardando';
}
// Team charts receive aggregate counts, never other brokers' client records.
export function leadSummary(sales) {
  const groups = new Map();
  for (const sale of sales) {
    if (sale.status === 'Cancelada') continue;
    const row = {date:sale.date,brokerId:sale.brokerId,productId:sale.productId,developerId:sale.developerId,source:sale.leadSource || 'Não informada'};
    const key = JSON.stringify(row);
    if (!groups.has(key)) groups.set(key, {...row, count:0});
    groups.get(key).count++;
  }
  return [...groups.values()];
}
