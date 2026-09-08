import { isTargetInvoice } from "./cisapp/targetInvoice";
import { emulator } from "../firebase";
const randomUUID = () => crypto.randomUUID();
import { FieldPath } from "./db";
import { HttpsError } from "./errors";
import { salesDb } from "./db";
import { createCisappReader, type Cursor } from "./cisapp/reader";
import {
  projectSource,
  materializeCustomer,
  sourceSpecs,
} from "./cisapp/mapper";
import { rebuildTargets, allRows } from "./targets";
import { refreshCollectionSchedules } from "./collections";
import { storeInvoiceOrder } from "./orderAttribution";
import { type Data, today } from "../../shared/schema";
const stateRef = salesDb.doc("syncState/cisapp");
const hash = async (data: Data) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(data)),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const mirror = (name: string) => `adminCis_${name}`;
export async function syncStep(
  uid: string,
  token: string,
  mode: string,
  month: string,
  testReader?: ReturnType<typeof createCisappReader>,
) {
  if (emulator && !testReader)
    throw new HttpsError(
      "failed-precondition",
      "Live CISapp synchronization is disabled in emulator mode",
    );
  if (
    ![
      "INITIAL",
      "INCREMENTAL",
      "RECONCILE",
      "RETRY",
      "INVOICE_TARGET",
    ].includes(mode)
  )
    throw new HttpsError("invalid-argument", "Invalid sync operation");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new HttpsError("invalid-argument", "Select a valid target month");
  const lock = randomUUID();
  const at = new Date().toISOString();
  let state = await salesDb.runTransaction(async (tx) => {
    const s = (await tx.get(stateRef)).data() || {};
    if (s.lockUntil > Date.now())
      throw new HttpsError(
        "aborted",
        "Another sync batch is running. Wait before retrying.",
      );
    if (mode === "INITIAL" && s.lastSuccessfulSync && !s.runId)
      throw new HttpsError(
        "failed-precondition",
        "Initial import has already finished. Use reconciliation.",
      );
    let next: Data = {
      ...s,
      lastAttempt: at,
      lastError: null,
      status: "RUNNING",
      lock,
      lockUntil: Date.now() + 120000,
    };
    if (!s.runId || s.runSchemaVersion !== 1) {
      const requested = mode === "RETRY" ? "INCREMENTAL" : mode;
      const m = !s.collectionSchemaVersion && s.lastSuccessfulSync ? "RECONCILE" : requested;
      if (m === "INCREMENTAL" && !s.lastSuccessfulSync)
        throw new HttpsError("failed-precondition", "Run initial import first");
      next = {
        ...next,
        runId: randomUUID(),
        runSchemaVersion: 1,
        mode: m,
        month,
        startedAt: at,
        orderAsOf: today(),
        since: s.lastSuccessfulSync
          ? new Date(Date.parse(s.lastSuccessfulSync) - 600000).toISOString()
          : null,
        source: 0,
        lane: 0,
        cursor: null,
        phase: "READ",
        recordsRead: 0,
        recordsUpdated: 0,
        recordsUnchanged: 0,
        customersSynchronized: 0,
        failureCount: 0,
        invoiceTotals: {
          business: 0,
          branches: {},
          staff: {},
          unallocatedBranchSales: 0,
        },
      };
    }
    tx.set(stateRef, next);
    return next;
  });
  try {
    // Existing source Admin authorization is checked on each bounded batch; token never persists.
    const reader = testReader || createCisappReader(token);
    if (
      ["READ", "LAST_ORDERS", "INVOICE_CHANGES"].includes(state.phase) ||
      state.mode === "INVOICE_TARGET"
    )
      await reader.assertAdmin();
    const full = ["INITIAL", "RECONCILE"].includes(state.mode);
    if (state.mode === "INVOICE_TARGET") {
      const page = await reader.page(
        "invoices",
        "date",
        state.cursor,
        null,
        state.startedAt,
        state.month,
      );
      const totals = state.invoiceTotals;
      for (const r of page.rows) {
        const d = r.data;
        if (!isTargetInvoice(d)) continue;
        const amount = Number(d.totalSales);
        if (!Number.isFinite(amount) || amount < 0) continue;
        totals.business += amount;
        if (d.branchSystemVersion === 1 && typeof d.shopId === "string")
          totals.branches[d.shopId] = (totals.branches[d.shopId] || 0) + amount;
        else totals.unallocatedBranchSales += amount;
        const stored = await storeInvoiceOrder(r.id, d, at);
        if (stored?.assignedStaffId)
          totals.staff[stored.assignedStaffId] =
            (totals.staff[stored.assignedStaffId] || 0) + amount;
        if (stored?.lastOrderChanged) await refreshCustomer(stored.customerId);
      }
      state = {
        ...state,
        cursor: page.cursor,
        invoiceTotals: totals,
        recordsRead: state.recordsRead + page.rows.length,
      };
      if (page.done) {
        await salesDb
          .doc(`adminInvoiceTargets/${state.month}`)
          .set({ ...totals, month: state.month, updatedAt: at });
        await rebuildTargets(state.month);
        state = {
          ...state,
          runId: null,
          status: "SUCCESS",
          lastTargetSync: at,
          cursor: null,
        };
      }
    } else if (state.phase === "READ") {
      const spec = sourceSpecs[state.source];
      const field = full ? null : spec.timestamps[state.lane];
      const page = await reader.page(
        spec.name,
        field,
        state.cursor as Cursor | null,
        state.since,
        state.startedAt,
      );
      const refs = page.rows.map((r) =>
        salesDb.doc(`${mirror(spec.name)}/${r.id}`),
      );
      const old = refs.length ? await salesDb.getAll(...refs) : [];
      const batch = salesDb.batch();
      for (let i = 0; i < page.rows.length; i++) {
        const row = page.rows[i];
        const payload = projectSource(spec.name, row.data);
        const fingerprint = await hash(payload);
        const changed = old[i]?.data()?.fingerprint !== fingerprint;
        batch.set(refs[i], {
          payload,
          fingerprint,
          seenRun: state.runId,
          checkedAt: at,
        });
        if (changed) {
          state.recordsUpdated++;
          if (!["invoices", "payments", "settings"].includes(spec.name) && !spec.name.includes("Monthly"))
            batch.set(salesDb.doc(`syncDirtyCustomers/${row.id}`), { customerId: row.id });
        } else state.recordsUnchanged++;
      }
      await batch.commit();
      state.recordsRead += page.rows.length;
      state.cursor = page.cursor;
      if (page.done) {
        state.cursor = null;
        if (full) state.phase = "PRUNE";
        else if (state.lane + 1 < spec.timestamps.length) state.lane++;
        else {
          state.source++;
          state.lane = 0;
        }
      }
      if (state.source >= sourceSpecs.length) state.phase = "MATERIALIZE";
    } else if (state.phase === "PRUNE") {
      const spec = sourceSpecs[state.source];
      let q = salesDb
        .collection(mirror(spec.name))
        .orderBy(FieldPath.documentId())
        .limit(50);
      if (state.cursor) q = q.startAfter(state.cursor.id);
      const page = await q.get();
      const batch = salesDb.batch();
      for (const doc of page.docs) {
        if (doc.data().seenRun === state.runId) continue;
        batch.delete(doc.ref);
        if (!["invoices", "payments", "settings"].includes(spec.name) && !spec.name.includes("Monthly"))
          batch.set(salesDb.doc(`syncDirtyCustomers/${doc.id}`), {
            customerId: doc.id,
          });
      }
      await batch.commit();
      state.cursor = page.size ? { id: page.docs.at(-1)!.id } : null;
      if (page.size < 50) {
        state.source++;
        state.cursor = null;
        state.phase =
          state.source >= sourceSpecs.length ? "MATERIALIZE" : "READ";
      }
    } else if (state.phase === "MATERIALIZE") {
      const dirty = await salesDb
        .collection("syncDirtyCustomers")
        .orderBy(FieldPath.documentId())
        .limit(25)
        .get();
      for (const row of dirty.docs) {
        await refreshCustomer(row.id);
        await row.ref.delete();
        state.customersSynchronized++;
      }
      if (dirty.size < 25) {
        state.phase = full ? "LAST_ORDERS" : "INVOICE_CHANGES";
        state.orderCustomerCursor = null;
        state.orderInvoiceCursor = null;
      }
    } else if (state.phase === "INVOICE_CHANGES") {
      const page = await reader.page(
        "invoices",
        "updatedAt",
        state.cursor as Cursor | null,
        state.since,
        state.startedAt,
      );
      for (const row of page.rows) {
        const stored = await storeInvoiceOrder(row.id, row.data, at);
        if (stored?.lastOrderChanged) await refreshCustomer(stored.customerId);
      }
      state.recordsRead += page.rows.length;
      state.cursor = page.cursor;
      if (page.done) {
        state.cursor = null;
        state.phase = "FINALIZE";
      }
    } else if (state.phase === "LAST_ORDERS") {
      let q = salesDb
        .collection("staffCustomers")
        .where("active", "==", true)
        .orderBy(FieldPath.documentId())
        .limit(1);
      if (state.orderCustomerCursor)
        q = q.startAfter(state.orderCustomerCursor);
      const customers = await q.get();
      const c = customers.docs[0];
      if (!c) state.phase = "FINALIZE";
      else {
        const result = await reader.latestOrderPage(
          c.id,
          state.orderInvoiceCursor || null,
          state.orderAsOf || today(),
        );
        state.recordsRead += result.read;
        if (result.done) {
          await salesDb
            .doc(`customerOrderDates/${c.id}`)
            .set({ lastOrderDate: result.date, checkedAt: at });
          await refreshCustomer(c.id);
          state.orderCustomerCursor = c.id;
          state.orderInvoiceCursor = null;
        } else state.orderInvoiceCursor = result.cursor;
      }
    } else {
      await refreshCollectionSchedules();
      await rebuildTargets(state.month);
      state = {
        ...state,
        lastSuccessfulSync: state.startedAt,
        collectionSchemaVersion: 1,
        lastCompletedAt: at,
        status: "SUCCESS",
        runId: null,
      };
      await salesDb
        .doc("publicState/sync")
        .set({ lastSuccessfulSync: state.startedAt, lastCompletedAt: at });
    }
    await salesDb.runTransaction(async (tx) => {
      const current = (await tx.get(stateRef)).data();
      if (current?.lock !== lock)
        throw new Error("Sync lock changed; retry the saved checkpoint");
      tx.set(stateRef, { ...state, lock: null, lockUntil: 0 });
    });
    return { ...state, lock: null, lockUntil: 0 };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Synchronization failed";
    await salesDb.runTransaction(async (tx) => {
      const current = (await tx.get(stateRef)).data();
      if (current?.lock === lock)
        tx.update(stateRef, {
          status: "FAILED",
          lastError: message,
          failureCount: (current.failureCount || 0) + 1,
          lock: null,
          lockUntil: 0,
        });
    });
    throw new HttpsError("failed-precondition", message);
  }
}
const validBranch = (value: unknown): value is "SINDHANUR" | "MASKI" =>
  value === "SINDHANUR" || value === "MASKI";

async function automaticAssignment(id: string, customer: Data, current: Data) {
  if (current.assignedStaffId) return current;
  const branchId = customer.payload?.branchId;
  if (!validBranch(branchId)) return current;
  const staff = (await allRows("users", ["branchId", "==", branchId]))
    .filter((row) => row.role === "Staff" && row.active === true)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  if (!staff) return current;
  const assignment = {
    customerId: id,
    assignedStaffId: staff.id,
    branchId,
    updatedAt: new Date().toISOString(),
    assignmentSource: "CISAPP_BRANCH",
  };
  const batch = salesDb.batch();
  batch.set(salesDb.doc(`customerAssignments/${id}`), assignment);
  batch.set(salesDb.doc(`monthlyAssignments/${today().slice(0, 7)}_${id}`), {
    customerId: id,
    staffId: staff.id,
    branchId,
    month: today().slice(0, 7),
  });
  await batch.commit();
  return assignment;
}

export async function assignUnassignedCustomersForStaff(staffId: string, branchId: string) {
  if (!validBranch(branchId)) return 0;
  const [customers, assignments] = await Promise.all([
    allRows("adminCis_customers"),
    allRows("customerAssignments"),
  ]);
  const assigned = new Set(assignments.map((row) => row.customerId));
  let changed = 0;
  for (const row of customers) {
    if (assigned.has(row.id) || row.payload?.branchId !== branchId) continue;
    const batch = salesDb.batch();
    batch.set(salesDb.doc(`customerAssignments/${row.id}`), {
      customerId: row.id,
      assignedStaffId: staffId,
      branchId,
      updatedAt: new Date().toISOString(),
      assignmentSource: "CISAPP_BRANCH",
    });
    batch.set(salesDb.doc(`monthlyAssignments/${today().slice(0, 7)}_${row.id}`), {
      customerId: row.id,
      staffId,
      branchId,
      month: today().slice(0, 7),
    });
    await batch.commit();
    await refreshCustomer(row.id);
    changed++;
  }
  return changed;
}

export async function refreshCustomer(id: string) {
  const [c, credit, assignmentDoc, orders] = await Promise.all([
    salesDb.doc(`${mirror("customers")}/${id}`).get(),
    salesDb.doc(`${mirror("customerCreditProfiles")}/${id}`).get(),
    salesDb.doc(`customerAssignments/${id}`).get(),
    salesDb.doc(`customerOrderDates/${id}`).get(),
  ]);
  const assignment = await automaticAssignment(id, c.data() || {}, assignmentDoc.data() || {});
  if (assignment.assignedStaffId && !(assignment as Data).assignedStaffName) {
    const staff = await salesDb.doc(`users/${assignment.assignedStaffId}`).get();
    if (staff.data()?.name) (assignment as Data).assignedStaffName = staff.data()!.name;
  }
  const data = materializeCustomer(
    id,
    c.data()?.payload || null,
    credit.data()?.payload || null,
    assignment,
    new Date().toISOString(),
    orders.data() || {},
  );
  const batch = salesDb.batch();
  batch.set(salesDb.doc(`staffCustomers/${id}`), data.customer);
  batch.set(salesDb.doc(`collectionSnapshots/${id}`), data.collection, { merge: true });
  await batch.commit();
}
