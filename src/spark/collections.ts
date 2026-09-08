import { salesDb } from "./db";
import { allRows } from "./targets";
import { collectionSchedule } from "../../shared/collections";
import type { Data } from "../../shared/schema";
export async function refreshCollectionSchedules() {
 const [customers,invoices,payments,settings]=await Promise.all([
  allRows("staffCustomers"),allRows("adminCis_invoices"),allRows("adminCis_payments"),allRows("adminCis_settings")]);
 const settingsRow=settings.find(row=>row.payload?.key === "erpSettings")?.payload || settings[0]?.payload || {};
 const invoiceMap=new Map<string,Data[]>(),paymentMap=new Map<string,Data[]>();
 for(const row of invoices){const d={...row.payload,id:row.id};invoiceMap.set(d.customerId,[...(invoiceMap.get(d.customerId)||[]),d]);}
 for(const row of payments){const d=row.payload;paymentMap.set(d.customerId,[...(paymentMap.get(d.customerId)||[]),d]);}
 for(const customer of customers){
  const source=await salesDb.doc(`adminCis_customers/${customer.id}`).get();
  const schedule=collectionSchedule(invoiceMap.get(customer.id)||[],paymentMap.get(customer.id)||[],source.data()?.payload||{},settingsRow);
  await salesDb.doc(`collectionSnapshots/${customer.id}`).set({invoices:schedule,branchId:customer.branchId||"",scheduleUpdatedAt:new Date().toISOString()},{merge:true});
 }
}

export async function refreshCollectionScheduleForCustomer(customerId: string) {
 const [customer,invoices,payments,settings,source]=await Promise.all([
  salesDb.doc(`staffCustomers/${customerId}`).get(), allRows("adminCis_invoices"),
  allRows("adminCis_payments"), allRows("adminCis_settings"),
  salesDb.doc(`adminCis_customers/${customerId}`).get(),
 ]);
 const settingsRow=settings.find(row=>row.payload?.key === "erpSettings")?.payload || settings[0]?.payload || {};
 const invoiceRows=invoices.filter(row=>row.payload?.customerId===customerId).map(row=>({...row.payload,id:row.id}));
 const paymentRows=payments.filter(row=>row.payload?.customerId===customerId).map(row=>row.payload);
 const schedule=collectionSchedule(invoiceRows,paymentRows,source.data()?.payload||{},settingsRow);
 await salesDb.doc(`collectionSnapshots/${customerId}`).set({invoices:schedule,branchId:customer.data()?.branchId||"",scheduleUpdatedAt:new Date().toISOString()},{merge:true});
}
