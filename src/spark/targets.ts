import { FieldPath } from "./db";
import { salesDb } from "./db";
import { type Data, targetMetrics } from "../../shared/schema";
export async function allRows(
  name: string,
  where?: [string, import("firebase/firestore").WhereFilterOp, any],
): Promise<Data[]> {
  let cursor: string | undefined;
  const rows: Data[] = [];
  do {
    let q = salesDb.collection(name).orderBy(FieldPath.documentId()).limit(100);
    if (where) q = q.where(...where);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    rows.push(...snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    if (snap.size < 100) break;
    cursor = snap.docs.at(-1)!.id;
  } while (true);
  return rows;
}
const completeSales = (s: Data | undefined): number | null =>
  s?.needsBackfill === false &&
  typeof s.totalSales === "number" &&
  Number.isFinite(s.totalSales) &&
  s.totalSales >= 0
    ? s.totalSales
    : null;
export async function rebuildTargets(month: string) {
  const [settings, mappings, monthly, business, invoice, salesOrders, incentivePlans, payments] = await Promise.all([
    allRows("targets", ["month", "==", month]),
    allRows("monthlyAssignments", ["month", "==", month]),
    allRows("adminCis_customerMonthlySnapshots", [
      "payload.month",
      "==",
      month,
    ]),
    salesDb.doc(`adminCis_businessMonthlySnapshots/${month}`).get(),
    salesDb.doc(`adminInvoiceTargets/${month}`).get(),
    allRows("staffSalesOrders", ["month", "==", month]),
    allRows("incentivePlans", ["month", "==", month]),
    allRows("adminCis_payments"),
  ]);
  const byCustomer = new Map(
    monthly.map((r) => [r.payload.customerId, r.payload]),
  );
  const mapping = new Map(mappings.map((r) => [r.customerId, r]));
  const company = business.data()?.payload;
  const reconciled = invoice.data();
  const totals: Record<string, number> = {};
  const creditedCounts: Record<string, number> = {};
  let unattributedSales = 0;
  for (const order of salesOrders) {
    if (
      order.attributionStatus === "STAFF_CREDITED" &&
      order.assignedStaffId &&
      typeof order.amount === "number"
    ) {
      totals[order.assignedStaffId] =
        (totals[order.assignedStaffId] || 0) + order.amount;
      creditedCounts[order.assignedStaffId] =
        (creditedCounts[order.assignedStaffId] || 0) + 1;
    } else if (typeof order.amount === "number") unattributedSales += order.amount;
  }
  let unmappedCustomers = 0;
  for (const c of byCustomer.keys()) if (!mapping.has(c)) unmappedCustomers++;
  const now = new Date().toISOString();
  let batch = salesDb.batch(),
    n = 0;
  for (const t of settings) {
    let achieved: number | null = null;
    let basis = "Awaiting a complete source summary";
    if (t.scope === "BUSINESS") {
      achieved =
        completeSales(company) !== null
          ? completeSales(company)
          : (reconciled?.business ?? null);
      basis =
        completeSales(company) !== null
          ? "CISapp business monthly snapshot"
          : "Controlled monthly invoice target reconciliation";
    }
    if (t.scope === "STAFF") {
      achieved = totals[t.subjectId] || 0;
      basis = "Verified CISapp invoices matched to this Staff member's ORDERED work result";
    }
    if (t.scope === "BRANCH") {
      achieved = reconciled ? (reconciled.branches?.[t.subjectId] ?? 0) : null;
      basis = "Invoice shopId; legacy/shared invoices remain unallocated";
    }
    const collection =
      t.scope === "STAFF"
        ? "staffTargetProgress"
        : t.scope === "BRANCH"
          ? "branchTargetProgress"
          : "businessTargetProgress";
    const id = t.scope === "BUSINESS" ? month : `${t.subjectId}_${month}`;
    const owner =
      t.scope === "STAFF"
        ? (await salesDb.doc(`users/${t.subjectId}`).get()).data()
        : null;
    batch.set(salesDb.doc(`${collection}/${id}`), {
      staffName: owner?.name || "",
      ...targetMetrics(t.target, achieved, month),
      month,
      staffId: t.scope === "STAFF" ? t.subjectId : "",
      branchId: t.scope === "BRANCH" ? t.subjectId : "",
      creditedOrderCount:
        t.scope === "STAFF" ? creditedCounts[t.subjectId] || 0 : 0,
      basis,
      updatedAt: now,
    });
    n++;
    if (n === 400) {
      await batch.commit();
      batch = salesDb.batch();
      n = 0;
    }
  }
  batch.set(salesDb.doc(`targetCoverage/${month}`), {
    month,
    unmappedCustomers,
    unallocatedBranchSales: reconciled?.unallocatedBranchSales ?? null,
    unattributedSales,
    creditedStaffOrders: salesOrders.filter(
      (order) => order.attributionStatus === "STAFF_CREDITED",
    ).length,
    updatedAt: now,
  });
  await batch.commit();
  for (const plan of incentivePlans) {
    const credited = salesOrders.filter((order) => order.attributionStatus === "STAFF_CREDITED" && order.assignedStaffId === plan.staffId);
    const achieved = credited.reduce((sum, order) => sum + Number(order.amount || 0), 0);
    const slabs = Array.isArray(plan.slabs) ? [...plan.slabs].sort((a: any, b: any) => Number(a.from || 0) - Number(b.from || 0)) : [];
    const slab = [...slabs].reverse().find((s: any) => achieved >= Number(s.from || 0));
    const eligible = achieved >= Number(plan.minimumTarget || 0) && slab;
    const paymentByInvoice = new Map<string, number>();
    for (const payment of payments) if (payment.invoiceId) paymentByInvoice.set(String(payment.invoiceId), (paymentByInvoice.get(String(payment.invoiceId)) || 0) + Number(payment.amountAppliedToInvoice ?? payment.amount ?? 0));
    const rows = eligible ? credited.map((order) => ({ ...order, incentive: Number(order.profit || 0) * Number(slab.percentage || 0) / 100, paid: Boolean(order.paid) || (paymentByInvoice.get(String(order.invoiceId)) || 0) >= Number(order.amount || 0) })) : [];
    const locked = rows.reduce((sum, row) => sum + row.incentive, 0);
    const released = rows.filter((row) => row.paid).reduce((sum, row) => sum + row.incentive, 0);
    await salesDb.doc(`staffIncentiveProgress/${plan.staffId}_${month}`).set({ staffId: plan.staffId, staffName: plan.staffName || "", month, minimumTarget: Number(plan.minimumTarget), achieved, activePercentage: eligible ? Number(slab.percentage || 0) : 0, locked, released, awaitingPayment: locked - released, eligible: Boolean(eligible), updatedAt: now });
  }
}
