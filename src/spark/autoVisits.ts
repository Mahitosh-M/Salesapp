import { salesDb, FieldPath } from "./db";
import { saveRecord } from "./records";
import { today, modules, type Data, type Profile } from "../../shared/schema";
import {
  automaticVisitId,
  needsAutomaticVisit,
  visitDueDate,
} from "../../shared/autoVisits";
function visitInput(d: Data) {
  return Object.fromEntries(
    [
      "title",
      "status",
      "priority",
      "assignedStaffId",
      ...modules.visits.fields.map((f) => f.key),
    ].map((k) => [k, d[k] || ""]),
  );
}
export async function generateAutomaticVisits(p: Profile, cursor?: string) {
  let q = salesDb
    .collection("staffCustomers")
    .where("active", "==", true)
    .orderBy(FieldPath.documentId())
    .limit(25);
  if (p.role === "Staff") q = q.where("assignedStaffId", "==", p.uid);
  if (cursor) q = q.startAfter(cursor);
  const customers = await q.get();
  let changed = 0;
  for (const row of customers.docs) {
    const c = row.data();
    if (!c.assignedStaffId || !c.lastOrderCheckedAt) continue;
    const owner = (
      await salesDb.doc(`users/${c.assignedStaffId}`).get()
    ).data();
    if (!owner?.active) continue;
    const expected = c.lastOrderDate
      ? await automaticVisitId(row.id, c.lastOrderDate)
      : null;
    let pending = salesDb
      .collection("visits")
      .where("customerId", "==", row.id)
      .where("status", "==", "PLANNED")
      .orderBy(FieldPath.documentId())
      .limit(25);
    if (p.role === "Staff")
      pending = pending.where("assignedStaffId", "==", p.uid);
    // Scan every page so stale automatic visits are not hidden behind manual ones.
    let last: string | undefined;
    do {
      const page = await (last ? pending.startAfter(last) : pending).get();
      for (const v of page.docs) {
        if (!v.id.startsWith("auto10_") || v.id === expected) continue;
        await saveRecord(p, "visits", v.id, {
          ...visitInput(v.data()),
          assignedStaffId: c.assignedStaffId,
          status: "CANCELLED",
          notes:
            "Automatic visit cancelled after the latest order date changed.",
        });
        changed++;
      }
      if (page.size < 25) break;
      last = page.docs.at(-1)!.id;
    } while (true);
    if (!expected || !needsAutomaticVisit(c.lastOrderDate, today())) continue;
    const result = await saveRecord(
      p,
      "visits",
      expected,
      {
        title: `Visit ${c.name}`.slice(0, 180),
        assignedStaffId: c.assignedStaffId,
        customerId: row.id,
        priority: "NORMAL",
        status: "PLANNED",
        dueDate: visitDueDate(c.lastOrderDate),
        purpose: "No order for 10 days or more",
        outcome: "",
        requirement: "",
        nextFollowUp: "",
        notes: `Automatically planned: last order ${c.lastOrderDate}. Based on order data synced ${c.lastOrderCheckedAt}.`,
      },
      true,
    );
    if (!result.alreadyExists) changed++;
  }
  return {
    changed,
    cursor: customers.docs.at(-1)?.id,
    done: customers.size < 25,
  };
}
