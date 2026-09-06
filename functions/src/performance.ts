import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { salesDb } from "./db";
import { today, businessMonth, type Data } from "../../shared/schema";
export function metrics(kind: string, d: Data | null): Record<string, number> {
  if (!d) return {};
  const done = d.status;
  const m: Record<string, number> = {};
  if (kind === "activities") {
    m.activities = 1;
    m[`outcome_${d.outcome}`] = 1;
    if (d.type === "CALL") m.calls = 1;
    if (d.type === "COLLECTION") m.collectionActions = 1;
    if (d.type === "LEAD_CONTACT") m.leadContacts = 1;
  }
  if (kind === "tasks") {
    m.tasks = 1;
    m.tasksCompleted = done === "COMPLETED" ? 1 : 0;
    m.tasksOverdue = done === "OVERDUE" ? 1 : 0;
  }
  if (kind === "visits") {
    m.visitsPlanned = 1;
    m.visitsCompleted = done === "COMPLETED" ? 1 : 0;
  }
  if (kind === "followUps") {
    m.followUps = 1;
    m.followUpsCompleted = done === "COMPLETED" ? 1 : 0;
  }
  if (kind === "leads") {
    m.leads = 1;
    m.leadsContacted = !["NEW", "LOST"].includes(done) ? 1 : 0;
    m.leadsConverted = done === "CONVERTED" ? 1 : 0;
  }
  if (kind === "opportunities") {
    m.opportunities = 1;
    m.opportunitiesHandled = done !== "OPEN" ? 1 : 0;
    m.opportunitiesWon = done === "WON" ? 1 : 0;
  }
  if (kind === "customerRequirements") {
    m.requirements = 1;
    m.requirementsResolved = ["ORDERED", "CLOSED"].includes(done) ? 1 : 0;
    m.requirementsOpen = ["ORDERED", "CLOSED", "CANCELLED"].includes(done)
      ? 0
      : 1;
  }
  if (kind === "reactivations") {
    m.reactivations = 1;
    m.reactivated = done === "REACTIVATED" ? 1 : 0;
  }
  if (kind === "campaignAssignments") {
    m.campaignAssigned = 1;
    m.campaignContacts = done === "PENDING" ? 0 : 1;
    m.campaignOrders = done === "ORDERED" ? 1 : 0;
    m[`campaignOutcome_${done}`] = 1;
  }
  if (kind === "collectionPromises") {
    m.promises = 1;
    m.promisesKept = done === "KEPT" ? 1 : 0;
    m.promisesMissed = done === "MISSED" ? 1 : 0;
  }
  if (kind === "objections") {
    m[`objection_${d.reason}`] = 1;
    m.lostSales = done === "LOST" ? 1 : 0;
  }
  if (kind === "complaints") {
    m.complaintsOpen = ["OPEN", "IN_PROGRESS"].includes(done) ? 1 : 0;
  }
  return m;
}
export function applyCounters(
  tx: Transaction,
  kind: string,
  before: Data | null,
  after: Data | null,
  at: string,
) {
  const updates = new Map<string, Data>();
  for (const [d, sign] of [
    [before, -1],
    [after, 1],
  ] as const) {
    if (!d) continue;
    const month = businessMonth(d.createdAt || at);
    const metric = metrics(kind, d);
    for (const path of [
      `staffPerformance/${d.assignedStaffId}_${month}`,
      `businessPerformance/${month}`,
      ...(["campaignAssignments", "objections"].includes(kind) && d.campaignId
        ? [`campaignPerformance/${d.campaignId}`]
        : []),
    ]) {
      const u = updates.get(path) || {
        counts: {},
        staffId: d.assignedStaffId,
        staffName: d.assignedStaffName || d.assignedStaffId,
        month,
      };
      for (const [k, v] of Object.entries(metric))
        u.counts[k] = (u.counts[k] || 0) + sign * v;
      updates.set(path, u);
    }
  }
  if (kind === "tasks") {
    for (const [d, sign] of [
      [before, -1],
      [after, 1],
    ] as const) {
      if (!d) continue;
      const open = !["COMPLETED", "SKIPPED", "CANCELLED"].includes(d.status);
      const source = String(d.sourceType || "ADMIN");
      for (const path of [
        `staffWorkSummaries/${d.assignedStaffId}`,
        `adminWorkSummaries/company`,
        ...(d.dueDate
          ? [`staffDailyWork/${d.assignedStaffId}_${d.dueDate}`]
          : []),
      ]) {
        const u = updates.get(path) || {
          counts: {},
          staffId: d.assignedStaffId,
          staffName: d.assignedStaffName || d.assignedStaffId,
          month: "",
        };
        const values: Record<string, number> = {
          openTasks: open ? 1 : 0,
          overdueTasks: open && d.status === "OVERDUE" ? 1 : 0,
          [`source_${source}`]: open ? 1 : 0,
          [`overdue_${source}`]: open && d.status === "OVERDUE" ? 1 : 0,
        };
        for (const [k, v] of Object.entries(values))
          u.counts[k] = (u.counts[k] || 0) + sign * v;
        updates.set(path, u);
      }
    }
  }
  for (const [path, u] of updates) {
    const counts = Object.fromEntries(
      Object.entries(u.counts)
        .filter(([, v]) => v !== 0)
        .map(([k, v]) => [k, FieldValue.increment(v as number)]),
    );
    if (Object.keys(counts).length === 0) continue;
    tx.set(
      salesDb.doc(path),
      {
        ...(path.startsWith("staff")
          ? { staffId: u.staffId, staffName: u.staffName }
          : {}),
        month: u.month,
        ...(path.startsWith("staffDailyWork/")
          ? { day: path.slice(path.lastIndexOf("_") + 1) }
          : {}),
        counts,
        updatedAt: at,
      },
      { merge: true },
    );
  }
}
export function taskFromSource(kind: string, id: string, d: Data): Data {
  const dates = d.dueDate || d.promiseDate || d.nextFollowUp || today();
  return {
    title: d.title,
    assignedStaffId: d.assignedStaffId,
    assignedStaffName: d.assignedStaffName || d.assignedStaffId,
    customerId: d.customerId || "",
    leadId: kind === "leads" ? id : d.leadId || "",
    priority: d.priority,
    dueDate: dates,
    status: dates < today() ? "OVERDUE" : "PENDING",
    sourceType: kind,
    sourceId: id,
    notes: "",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}
