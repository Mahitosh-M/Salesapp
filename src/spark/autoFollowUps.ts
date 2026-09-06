import { salesDb, FieldPath } from "./db";
import { saveRecord } from "./records";
import { today, modules, type Data, type Profile } from "../../shared/schema";
import { automaticFollowUpId, followUpDueDate, needsAutomaticFollowUp } from "../../shared/autoFollowUps";
function followUpInput(d: Data) {
  return Object.fromEntries(["title", "status", "priority", "assignedStaffId", ...modules.followUps.fields.map((f) => f.key)].map((key) => [key, d[key] || ""]));
}
export async function generateAutomaticFollowUps(p: Profile, cursor?: string) {
  let query = salesDb.collection("staffCustomers").where("active", "==", true).orderBy(FieldPath.documentId()).limit(25);
  if (p.role === "Staff") query = query.where("assignedStaffId", "==", p.uid);
  if (cursor) query = query.startAfter(cursor);
  const customers = await query.get();
  let changed = 0;
  for (const row of customers.docs) {
    const customer = row.data();
    if (!customer.assignedStaffId || !customer.lastOrderCheckedAt) continue;
    const owner = (await salesDb.doc(`users/${customer.assignedStaffId}`).get()).data();
    if (!owner?.active) continue;
    const expected = await automaticFollowUpId(row.id, customer.lastOrderDate);
    let pending = salesDb.collection("followUps").where("customerId", "==", row.id).where("status", "==", "PENDING").orderBy(FieldPath.documentId()).limit(25);
    if (p.role === "Staff") pending = pending.where("assignedStaffId", "==", p.uid);
    let last: string | undefined;
    do {
      const page = await (last ? pending.startAfter(last) : pending).get();
      for (const followUp of page.docs) {
        if (!followUp.id.startsWith("auto15_") || followUp.id === expected) continue;
        await saveRecord(p, "followUps", followUp.id, {
          ...followUpInput(followUp.data()),
          assignedStaffId: customer.assignedStaffId,
          status: "CANCELLED",
          notes: "Automatic follow-up cancelled after the latest order date changed.",
        });
        changed++;
      }
      if (page.size < 25) break;
      last = page.docs.at(-1)!.id;
    } while (true);
    if (!needsAutomaticFollowUp(customer.lastOrderDate, today())) continue;
    const dueDate = followUpDueDate(customer.lastOrderDate, today());
    const result = await saveRecord(p, "followUps", expected, {
      title: `Follow up ${customer.name}`.slice(0, 180),
      assignedStaffId: customer.assignedStaffId,
      customerId: row.id,
      leadId: "",
      priority: "NORMAL",
      status: "PENDING",
      dueDate,
      outcome: "",
      nextFollowUp: "",
      notes: customer.lastOrderDate
        ? `Automatically created: no normal business order since ${customer.lastOrderDate}. Source checked ${customer.lastOrderCheckedAt}.`
        : `Automatically created: no normal business order found. Source checked ${customer.lastOrderCheckedAt}.`,
    }, true);
    if (!result.alreadyExists) changed++;
  }
  return { changed, cursor: customers.docs.at(-1)?.id, done: customers.size < 25 };
}