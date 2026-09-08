import { today, type Data } from "../../shared/schema";
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
    m.promisesKept = done === "PAID" ? 1 : 0;
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
// Spark summaries are derived from authorized records, never client-written counters.
export function applyCounters(..._args: unknown[]) {}
export function taskFromSource(kind: string, id: string, d: Data): Data {
  const dates = d.dueDate || d.promiseDate || d.nextFollowUp || today();
  return {
    createdBy: d.createdBy,
    createdOn: d.createdOn,
    submittedAt: d.submittedAt,
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

