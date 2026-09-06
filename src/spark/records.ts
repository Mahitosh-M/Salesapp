import { HttpsError } from "./errors";
import { salesDb, requireId, serverTimestamp } from "./db";
import {
  modules,
  validateRecord,
  today,
  type Data,
  type Profile,
} from "../../shared/schema";
import { applyCounters, taskFromSource } from "./performance";
export async function saveRecord(
  p: Profile,
  kind: string,
  id: string,
  input: Data,
  createOnly = false,
) {
  requireId(id);
  const spec = modules[kind];
  if (!spec) throw new HttpsError("invalid-argument", "Unknown workflow");
  if (spec.adminOnly && p.role !== "Admin")
    throw new HttpsError("permission-denied", "Admin access required");
  let d: Data;
  try {
    d = validateRecord(kind, input);
  } catch (e) {
    throw new HttpsError("invalid-argument", (e as Error).message);
  }
  if (p.role !== "Admin" && d.assignedStaffId !== p.uid)
    throw new HttpsError(
      "permission-denied",
      "Records must be assigned to you",
    );
  if (
    d.status === "CONVERTED" &&
    kind === "leads" &&
    (!d.linkedCustomerId || p.role !== "Admin")
  )
    throw new HttpsError(
      "failed-precondition",
      "An Admin must link an imported CISapp customer before conversion",
    );
  if (
    kind === "tasks" &&
    ["PENDING", "IN_PROGRESS", "OVERDUE"].includes(d.status)
  ) {
    d.status =
      d.dueDate < today()
        ? "OVERDUE"
        : d.status === "OVERDUE"
          ? "PENDING"
          : d.status;
  }
  const ref = salesDb.doc(`${kind}/${id}`);
  const stamp = new Date().toISOString();
  return salesDb.runTransaction(async (tx) => {
    const oldSnap = await tx.get(ref);
    const before = oldSnap.exists ? oldSnap.data()! : null;
    if (before && createOnly) return { id, alreadyExists: true };
    if (before && p.role !== "Admin" && before.assignedStaffId !== p.uid)
      throw new HttpsError(
        "permission-denied",
        "This record belongs to another staff member",
      );
    if (kind === "campaignAssignments" && !before && p.role !== "Admin")
      throw new HttpsError(
        "permission-denied",
        "Campaign assignments are created by Admin",
      );
    if (
      before &&
      kind === "campaignAssignments" &&
      p.role !== "Admin" &&
      ["customerId", "campaignId"].some((k) => before[k] !== d[k])
    )
      throw new HttpsError(
        "permission-denied",
        "Campaign ownership cannot be changed",
      );
    if (kind === "activities" && before && p.role !== "Admin")
      throw new HttpsError(
        "permission-denied",
        "Recorded interactions are immutable for staff",
      );
    const owner = await tx.get(
      salesDb.doc(`users/${requireId(d.assignedStaffId)}`),
    );
    if (!owner.data()?.active)
      throw new HttpsError("invalid-argument", "Select an active owner");
    for (const key of ["customerId", "linkedCustomerId"]) {
      if (!d[key]) continue;
      const c = await tx.get(
        salesDb.doc(`staffCustomers/${requireId(d[key])}`),
      );
      if (!c.data()?.active)
        throw new HttpsError(
          "failed-precondition",
          "Select an active imported customer",
        );
      if (
        key === "customerId" &&
        p.role !== "Admin" &&
        c.data()?.assignedStaffId !== p.uid
      )
        throw new HttpsError(
          "permission-denied",
          "Customer is outside your assigned scope",
        );
      if (
        key === "customerId" &&
        c.data()?.assignedStaffId !== d.assignedStaffId
      )
        throw new HttpsError(
          "failed-precondition",
          "Use the customer’s assigned owner",
        );
    }
    if (d.leadId) {
      const l = await tx.get(salesDb.doc(`leads/${requireId(d.leadId)}`));
      if (!l.exists || l.data()?.assignedStaffId !== d.assignedStaffId)
        throw new HttpsError(
          "permission-denied",
          "Lead is outside the selected owner’s scope",
        );
    }
    if (d.campaignId && p.role === "Admin") {
      const campaign = await tx.get(
        salesDb.doc(`campaigns/${requireId(d.campaignId)}`),
      );
      if (!campaign.exists)
        throw new HttpsError("invalid-argument", "Select an existing campaign");
      if (p.role !== "Admin" && kind !== "campaignAssignments") {
        const a = d.customerId
          ? await tx.get(
              salesDb.doc(
                `campaignAssignments/${d.campaignId}_${d.customerId}`,
              ),
            )
          : null;
        if (a?.data()?.assignedStaffId !== p.uid)
          throw new HttpsError(
            "permission-denied",
            "Campaign is outside your assigned scope",
          );
      }
    }
    const after: Data = {
      ...d,
      createdOn: before?.createdOn || serverTimestamp(),
      submittedAt: serverTimestamp(),
      assignedStaffName: owner.data()?.name || d.assignedStaffId,
      createdAt: before?.createdAt || stamp,
      createdBy: before?.createdBy || p.uid,
      updatedAt: stamp,
    };
    if (kind === "tasks") {
      after.sourceType = before?.sourceType || "ADMIN";
      after.sourceId = before?.sourceId || id;
    }
    if (kind === "campaigns" && before?.assignmentCursor !== undefined) {
      after.assignmentCursor = before.assignmentCursor;
      after.assignmentDone = before.assignmentDone || false;
    }
    const autoRef = spec.task ? salesDb.doc(`tasks/${kind}_${id}`) : null;
    const auto = autoRef ? await tx.get(autoRef) : null;
    const followRef =
      kind === "activities" && d.nextFollowUp
        ? salesDb.doc(`followUps/activity_${id}`)
        : null;
    const follow = followRef ? await tx.get(followRef) : null;
    const followTaskRef = followRef
      ? salesDb.doc(`tasks/followUps_activity_${id}`)
      : null;
    const followTask = followTaskRef ? await tx.get(followTaskRef) : null;
    // Every read precedes every write, so this remains a valid retryable transaction.
    tx.set(ref, after);
    applyCounters(tx, kind, before, after, stamp);
    if (autoRef) {
      const next = taskFromSource(kind, id, after);
      if (spec.closed.includes(d.status))
        next.status = d.status === "CANCELLED" ? "CANCELLED" : "COMPLETED";
      else if (
        auto?.exists &&
        before?.status === d.status &&
        auto.data()?.dueDate === next.dueDate &&
        auto.data()?.assignedStaffId === next.assignedStaffId
      )
        next.status = auto.data()!.status;
      next.createdBy = auto?.data()?.createdBy || p.uid;
      next.createdOn = auto?.data()?.createdOn || serverTimestamp();
      next.submittedAt = serverTimestamp();
      next.createdAt = auto?.data()?.createdAt || stamp;
      tx.set(autoRef, next);
      applyCounters(tx, "tasks", auto?.data() || null, next, stamp);
    }
    if (followRef && followTaskRef && !follow?.exists) {
      const f: Data = {
        createdOn: serverTimestamp(),
        submittedAt: serverTimestamp(),
        title: `Follow up: ${d.title}`,
        customerId: d.customerId || "",
        leadId: d.leadId || "",
        assignedStaffId: d.assignedStaffId,
        priority: d.priority,
        dueDate: d.nextFollowUp,
        status: "PENDING",
        outcome: "",
        nextFollowUp: "",
        notes: d.notes || "",
        createdAt: stamp,
        updatedAt: stamp,
        createdBy: p.uid,
        assignedStaffName: after.assignedStaffName,
      };
      tx.set(followRef, f);
      applyCounters(tx, "followUps", null, f, stamp);
      const task = taskFromSource("followUps", followRef.id, f);
      tx.set(followTaskRef, task);
      applyCounters(tx, "tasks", followTask?.data() || null, task, stamp);
    }
    return { id };
  });
}
export async function markOverduePage() {
  const snap = await salesDb
    .collection("tasks")
    .where("status", "in", ["PENDING", "IN_PROGRESS"])
    .where("dueDate", "<", today())
    .limit(100)
    .get();
  for (const row of snap.docs)
    await salesDb.runTransaction(async (tx) => {
      const fresh = await tx.get(row.ref);
      const before = fresh.data();
      if (
        !before ||
        !["PENDING", "IN_PROGRESS"].includes(before.status) ||
        before.dueDate >= today()
      )
        return;
      const after = {
        ...before,
        status: "OVERDUE",
        updatedAt: new Date().toISOString(),
      };
      tx.update(row.ref, after);
      applyCounters(tx, "tasks", before, after, after.updatedAt);
    });
  return { processed: snap.size, hasMore: snap.size === 100 };
}
