import { HttpsError } from "./errors";
import { actor, salesDb, salesAdminAuth, requireId, FieldPath } from "./db";
import { saveRecord, markOverduePage } from "./records";
import { assignUnassignedCustomersForStaff, refreshCustomer, syncStep } from "./sync";
import { rebuildTargets } from "./targets";
import { refreshCollectionScheduleForCustomer } from "./collections";
import { branchIds, today, type Data } from "../../shared/schema";
const onCall = (fn: (request: { data: Data }) => Promise<any>) => fn;
export const saveSalesRecord = onCall(async (request) => {
  const p = await actor(request);
  return saveRecord(p, request.data.kind, request.data.id, request.data.record);
});
export const synchronizeCisapp = onCall(async (request) => {
  const p = await actor(request, true);
  return syncStep(
    p.uid,
    request.data.token,
    request.data.mode,
    request.data.month,
  );
});
export const syncCriticalCisapp = onCall(async (request) => {
  await actor(request, true);
  const kind = request.data.kind === "payments" ? "payments" : request.data.kind === "invoices" ? "invoices" : "";
  const id = requireId(request.data.id);
  const payload = request.data.payload;
  if (!kind || !payload || typeof payload !== "object") throw new HttpsError("invalid-argument", "Invalid critical CISapp record");
  await salesDb.doc(`adminCis_${kind}/${id}`).set({ payload, fingerprint: "realtime", checkedAt: new Date().toISOString() }, { merge: true });
  const customerId = typeof payload.customerId === "string" ? payload.customerId : "";
  if (customerId) {
    if (kind === "invoices") {
      const stored = await import("./orderAttribution").then((m) => m.storeInvoiceOrder(id, payload, new Date().toISOString()));
      if (stored?.lastOrderChanged) await refreshCustomer(customerId);
    }
    await refreshCollectionScheduleForCustomer(customerId);
  }
  return { status: "SUCCESS", kind, id, customerId };
});
export const saveUser = onCall(async (request) => {
  const p = await actor(request, true);
  const d = request.data;
  if (
    typeof d.name !== "string" ||
    !d.name.trim() ||
    !["Admin", "Manager", "Staff"].includes(d.role) ||
    !branchIds.includes(d.branchId) ||
    typeof d.email !== "string"
  )
    throw new HttpsError("invalid-argument", "Enter name, email, and role");
  let uid = d.uid;
  if (uid) {
    requireId(uid);
    if (uid === p.uid && (d.active === false || d.role !== "Admin"))
      throw new HttpsError(
        "failed-precondition",
        "You cannot revoke your own Admin access",
      );
    await salesAdminAuth.updateUser(uid, {
      displayName: d.name,
      disabled: d.active === false,
    });
  } else {
    if (
      typeof d.password !== "string" ||
      d.password.length < (d.role === "Staff" ? 6 : 12)
    )
      throw new HttpsError(
        "invalid-argument",
        `Use an initial password of at least ${d.role === "Staff" ? 6 : 12} characters`,
      );
    const u = await salesAdminAuth.createUser({
      email: d.email,
      password: d.password,
      displayName: d.name,
    });
    uid = u.uid;
  }
  await salesDb.doc(`users/${uid}`).set({
    uid,
    name: d.name.trim(),
    email: d.email,
    role: d.role,
    active: d.active !== false,
    branchId: typeof d.branchId === "string" ? d.branchId : "",
    updatedAt: new Date().toISOString(),
  });
  const assignedCustomers = d.role === "Staff" ? await assignUnassignedCustomersForStaff(uid, d.branchId) : 0;
  return { uid, assignedCustomers };
});
export const assignCustomer = onCall(async (request) => {
  await actor(request, true);
  const customerId = requireId(request.data.customerId);
  const assignedStaffId = requireId(request.data.assignedStaffId);
  const month = String(request.data.month || today().slice(0, 7));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new HttpsError("invalid-argument", "Select a valid month");
  const running = (await salesDb.doc("syncState/cisapp").get()).data();
  if (running?.runId && running.mode === "INVOICE_TARGET")
    throw new HttpsError(
      "failed-precondition",
      "Finish the target reconciliation before changing attribution",
    );
  const [c, u] = await Promise.all([
    salesDb.doc(`adminCis_customers/${customerId}`).get(),
    salesDb.doc(`users/${assignedStaffId}`).get(),
  ]);
  if (!c.exists || !u.data()?.active)
    throw new HttpsError(
      "not-found",
      "Select an imported customer and active staff member",
    );
  const branchId = String(request.data.branchId || "");
  if (!branchIds.includes(branchId as (typeof branchIds)[number]))
    throw new HttpsError("invalid-argument", "Select SINDHANUR or MASKI");
  const batch = salesDb.batch();
  batch.set(salesDb.doc(`customerAssignments/${customerId}`), {
    customerId,
    assignedStaffId,
    branchId,
    updatedAt: new Date().toISOString(),
  });
  batch.set(salesDb.doc(`monthlyAssignments/${month}_${customerId}`), {
    customerId,
    staffId: assignedStaffId,
    branchId,
    month,
  });
  await batch.commit();
  const oldTarget = salesDb.doc(`adminInvoiceTargets/${month}`);
  if ((await oldTarget.get()).exists)
    await oldTarget.update({ staffAttributionValid: false });
  await refreshCustomer(customerId);
  await rebuildTargets(month);
  return { ok: true };
});
export const saveTarget = onCall(async (request) => {
  await actor(request, true);
  const d = request.data;
  if (
    !["STAFF", "BRANCH", "BUSINESS"].includes(d.scope) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.month) ||
    typeof d.target !== "number" ||
    d.target <= 0 ||
    d.target > 1e12
  )
    throw new HttpsError("invalid-argument", "Enter a valid monthly target");
  const subjectId = d.scope === "BUSINESS" ? "company" : requireId(d.subjectId);
  if (
    d.scope === "BRANCH" &&
    !branchIds.includes(subjectId as (typeof branchIds)[number])
  )
    throw new HttpsError("invalid-argument", "Select SINDHANUR or MASKI");
  if (
    d.scope === "STAFF" &&
    !(await salesDb.doc(`users/${subjectId}`).get()).data()?.active
  )
    throw new HttpsError("invalid-argument", "Select an active staff member");
  await salesDb.doc(`targets/${d.scope}_${subjectId}_${d.month}`).set({
    scope: d.scope,
    subjectId,
    month: d.month,
    target: d.target,
    updatedAt: new Date().toISOString(),
  });
  await rebuildTargets(d.month);
  return { ok: true };
});
export const saveSettings = onCall(async (request) => {
  await actor(request, true);
  const d = request.data;
  if (typeof d.businessName !== "string" || d.businessName.length > 100)
    throw new HttpsError("invalid-argument", "Enter a business name");
  await salesDb
    .doc("settings/general")
    .set({ businessName: d.businessName, updatedAt: new Date().toISOString() });
  return { ok: true };
});
export const assignCampaignPage = onCall(async (request) => {
  const p = await actor(request, true);
  const id = requireId(request.data.campaignId);
  const ref = salesDb.doc(`campaigns/${id}`);
  const campaign = (await ref.get()).data();
  if (!campaign || campaign.status !== "ACTIVE")
    throw new HttpsError("failed-precondition", "Activate the campaign first");
  if (campaign.assignmentDone) return { done: true, processed: 0 };
  let q = salesDb
    .collection("staffCustomers")
    .where("active", "==", true)
    .orderBy(FieldPath.documentId())
    .limit(25);
  if (campaign.assignmentCursor) q = q.startAfter(campaign.assignmentCursor);
  const page = await q.get();
  let assigned = 0;
  for (const row of page.docs) {
    const c = row.data();
    if (!c.assignedStaffId) continue;
    let match =
      campaign.segment === "ALL_ASSIGNED" ||
      (campaign.segment === "AREA" && c.area === campaign.segmentValue) ||
      (campaign.segment === "BRANCH" && c.branchId === campaign.segmentValue) ||
      (campaign.segment === "STAFF" &&
        c.assignedStaffId === campaign.segmentValue);
    if (["COLLECTION", "GOOD_PAYMENT"].includes(campaign.segment)) {
      const snapshot = (
        await salesDb.doc(`collectionSnapshots/${row.id}`).get()
      ).data();
      match =
        campaign.segment === "COLLECTION"
          ? snapshot?.overdueAmount > 0
          : snapshot?.overdueAmount === 0;
    }
    if (campaign.segment === "OPEN_REQUIREMENTS") {
      match = !(
        await salesDb
          .collection("customerRequirements")
          .where("customerId", "==", row.id)
          .where("status", "in", ["OPEN", "AVAILABLE", "CUSTOMER_INFORMED"])
          .limit(1)
          .get()
      ).empty;
    }
    if (campaign.segment === "DORMANT") {
      match = !(
        await salesDb
          .collection("reactivations")
          .where("customerId", "==", row.id)
          .where("status", "in", [
            "INACTIVE",
            "ASSIGNED",
            "CONTACTED",
            "INTERESTED",
          ])
          .limit(1)
          .get()
      ).empty;
    }
    if (campaign.segment === "REORDER") {
      match = !(
        await salesDb
          .collection("opportunities")
          .where("customerId", "==", row.id)
          .where("type", "==", "REORDER_DUE")
          .where("status", "in", ["OPEN", "CONTACTED", "INTERESTED"])
          .limit(1)
          .get()
      ).empty;
    }
    if (!match) continue;
    const assignmentId = `${id}_${row.id}`;
    if ((await salesDb.doc(`campaignAssignments/${assignmentId}`).get()).exists)
      continue;
    await saveRecord(p, "campaignAssignments", assignmentId, {
      title: `${campaign.title} ? ${c.name}`,
      status: "PENDING",
      priority: "NORMAL",
      assignedStaffId: c.assignedStaffId,
      customerId: row.id,
      dueDate: campaign.endDate,
      campaignId: id,
      notes: campaign.objective || "",
      nextFollowUp: "",
    });
    assigned++;
  }
  const done = page.size < 25;
  await ref.update({
    assignmentCursor: page.docs.at(-1)?.id || campaign.assignmentCursor || "",
    assignmentDone: done,
  });
  return { done, processed: page.size, assigned };
});
export const refreshOverdue = onCall(async (request) => {
  await actor(request, true);
  return markOverduePage();
});
export const discardFailedSync = onCall(async (request) => {
  await actor(request, true);
  const ref = salesDb.doc("syncState/cisapp");
  await salesDb.runTransaction(async (tx) => {
    const state = (await tx.get(ref)).data();
    if (state?.lockUntil > Date.now())
      throw new HttpsError("aborted", "Wait for the active batch to finish");
    if (!state?.runId) return;
    tx.update(ref, {
      runId: null,
      status: "PAUSED",
      lastError: null,
      lock: null,
      lockUntil: 0,
      cursor: null,
    });
  });
  return { ok: true };
});

