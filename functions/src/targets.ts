import { FieldPath } from "firebase-admin/firestore";
import { salesDb } from "./db";
import { type Data, targetMetrics } from "../../shared/schema";
export async function allRows(
  name: string,
  where?: [string, FirebaseFirestore.WhereFilterOp, any],
): Promise<Data[]> {
  let cursor: string | undefined;
  const rows: Data[] = [];
  do {
    let q = salesDb.collection(name).orderBy(FieldPath.documentId()).limit(200);
    if (where) q = q.where(...where);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    rows.push(...snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    if (snap.size < 200) break;
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
  const [settings, mappings, monthly, business, invoice] = await Promise.all([
    allRows("targets", ["month", "==", month]),
    allRows("monthlyAssignments", ["month", "==", month]),
    allRows("adminCis_customerMonthlySnapshots", [
      "payload.month",
      "==",
      month,
    ]),
    salesDb.doc(`adminCis_businessMonthlySnapshots/${month}`).get(),
    salesDb.doc(`adminInvoiceTargets/${month}`).get(),
  ]);
  const byCustomer = new Map(
    monthly.map((r) => [r.payload.customerId, r.payload]),
  );
  const mapping = new Map(mappings.map((r) => [r.customerId, r]));
  const company = business.data()?.payload;
  const reconciled = invoice.data();
  const totals: Record<string, number> = {};
  const incomplete = new Set<string>();
  const assignedCounts: Record<string, number> = {};
  for (const row of mappings) {
    assignedCounts[row.staffId] = (assignedCounts[row.staffId] || 0) + 1;
    const s = byCustomer.get(row.customerId);
    if (completeSales(s) === null) incomplete.add(row.staffId);
    else totals[row.staffId] = (totals[row.staffId] || 0) + completeSales(s)!;
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
      achieved =
        assignedCounts[t.subjectId] && !incomplete.has(t.subjectId)
          ? totals[t.subjectId] || 0
          : reconciled && reconciled.staffAttributionValid !== false
            ? (reconciled.staff?.[t.subjectId] ??
              (mappings.some((r) => r.staffId === t.subjectId) ? 0 : null))
            : null;
      basis =
        "Full-month customer assignment (not invoice salesperson attribution)";
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
    updatedAt: now,
  });
  await batch.commit();
}
