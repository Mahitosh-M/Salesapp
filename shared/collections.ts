import type { Data } from "./schema";
export function addCollectionDays(date:string, days:number) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(days) || days<0) return null;
 const value=new Date(`${date}T00:00:00Z`);
 if (!Number.isFinite(value.getTime())) return null;
 value.setUTCDate(value.getUTCDate()+Math.round(days));
 return value.toISOString().slice(0,10);
}
export function collectionSchedule(invoices:Data[], payments:Data[], customer:Data, settings:Data) {
 const paid=new Map<string,number>();
 for (const p of payments) {
  const effect=Math.max(0,Number(p.amountAppliedToInvoice ?? p.amount)||0)+Math.max(0,Number(p.cashDiscount)||0);
  paid.set(p.invoiceId,(paid.get(p.invoiceId)||0)+effect);
 }
 const result:Data[]=[];
 for (const invoice of invoices) {
  const status=String(invoice.recordStatus || invoice.status || "").toLowerCase();
  const type=String(invoice.invoiceType||"").toLowerCase().replace(/[_-]/g," ");
  if (["draft","cancelled","canceled","deleted","void"].includes(status) || ["order","confirmed order","quotation","quote","return","sales return","credit note","inter shop","cogs","inventory"].includes(type)) continue;
  const amount=Math.round(Math.max(0,Number(invoice.totalSales)-(paid.get(invoice.id)||0))*100)/100;
  if (!(amount>0)) continue;
  const tier=invoice.tierAtInvoice || customer.tier || "Tier 4";
  const buffer=Number(invoice.bufferDaysAtInvoice ?? settings.paymentBuffers?.[tier] ?? (tier === "Tier 1" ? 3 : 0));
  const dueDate=invoice.savedDueDate || invoice.dueDate || addCollectionDays(invoice.date,Number(settings.creditDays?.[tier] ?? ({"Tier 1":15,"Tier 2":10} as Data)[tier] ?? 0));
  const cutoff=dueDate ? addCollectionDays(dueDate,buffer) : null;
  if (!cutoff) throw new Error(`Invoice ${invoice.invoiceNumber || invoice.id} has invalid due terms`);
  result.push({invoiceId:invoice.id, invoiceNumber:invoice.invoiceNumber || invoice.id, amount,dueDate,bufferDays:buffer,cutoffDate:cutoff});
 }
 return result;
}
export function collectionDue(invoices:Data[], today:string) {
 const due=invoices.filter(invoice=>invoice.amount>0 && invoice.cutoffDate < today);
 return {amount:Math.round(due.reduce((sum,invoice)=>sum+invoice.amount,0)*100)/100,invoices:due};
}
