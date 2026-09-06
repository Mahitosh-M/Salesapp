import { describe, it, beforeAll, beforeEach, expect } from "vitest";
import type { Data, Profile } from "../shared/schema";
const suite = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
let db: any, save: any, sync: any, rebuild: any;
const admin: Profile = {
  uid: "admin",
  role: "Admin",
  name: "Admin",
  email: "a@example.test",
  active: true,
};
const staff: Profile = { ...admin, uid: "arun", role: "Staff" };
const task = {
  title: "Call customer",
  status: "PENDING",
  priority: "HIGH",
  assignedStaffId: "arun",
  customerId: "c1",
  leadId: "",
  dueDate: "2026-09-10",
  notes: "",
};
suite("Transactional workflows and resumable sync", () => {
  beforeAll(async () => {
    ({ salesDb: db } = await import("../functions/src/db"));
    ({ saveRecord: save } = await import("../functions/src/records"));
    ({ syncStep: sync } = await import("../functions/src/sync"));
    ({ rebuildTargets: rebuild } = await import("../functions/src/targets"));
  });
  beforeEach(async () => {
    await fetch(
      "http://127.0.0.1:8085/emulator/v1/projects/demo-salesapp/databases/(default)/documents",
      { method: "DELETE" },
    );
    for (const p of [admin, staff, { ...staff, uid: "other" }])
      await db.doc(`users/${p.uid}`).set(p);
    await db
      .doc("staffCustomers/c1")
      .set({ name: "ABC", active: true, assignedStaffId: "arun" });
    await db
      .doc("staffCustomers/c2")
      .set({ name: "Other", active: true, assignedStaffId: "other" });
  });
  it("saves a promise and exactly one automatic task across retries", async () => {
    const data = {
      title: "Tuesday promise",
      status: "PROMISED",
      priority: "HIGH",
      assignedStaffId: "arun",
      customerId: "c1",
      amount: 5000,
      promiseDate: "2026-09-08",
      notes: "",
    };
    await save(staff, "collectionPromises", "promise1", data);
    await save(staff, "collectionPromises", "promise1", data);
    expect((await db.collection("tasks").get()).size).toBe(1);
    expect((await db.collection("payments").get()).size).toBe(0);
    const month = new Date().toISOString().slice(0, 7);
    const counts = (await db.doc(`staffPerformance/arun_${month}`).get()).data()
      .counts;
    expect(counts.promises).toBe(1);
    expect(counts.tasks).toBe(1);
  });
  it("updates results without inflating activity counts", async () => {
    await save(staff, "tasks", "t1", task);
    await save(staff, "tasks", "t1", { ...task, status: "COMPLETED" });
    await save(staff, "tasks", "t1", { ...task, status: "COMPLETED" });
    const month = new Date().toISOString().slice(0, 7);
    const counts = (await db.doc(`staffPerformance/arun_${month}`).get()).data()
      .counts;
    expect(counts.tasks).toBe(1);
    expect(counts.tasksCompleted).toBe(1);
  });
  it("rejects cross-customer writes and changing someone else’s record", async () => {
    await expect(
      save(staff, "tasks", "t1", { ...task, customerId: "c2" }),
    ).rejects.toThrow();
    await save(admin, "tasks", "t2", {
      ...task,
      assignedStaffId: "other",
      customerId: "c2",
    });
    await expect(save(staff, "tasks", "t2", task)).rejects.toThrow();
  });
  it("creates a follow-up and task atomically from an interaction", async () => {
    await save(staff, "activities", "a1", {
      title: "Called ABC",
      status: "RECORDED",
      priority: "NORMAL",
      assignedStaffId: "arun",
      customerId: "c1",
      leadId: "",
      type: "CALL",
      outcome: "CALL_LATER",
      nextFollowUp: "2026-09-09",
      notes: "After lunch",
    });
    expect((await db.doc("followUps/activity_a1").get()).exists).toBe(true);
    expect((await db.doc("tasks/followUps_activity_a1").get()).exists).toBe(
      true,
    );
  });
  it("requires Admin to link a real imported customer for conversion", async () => {
    const lead = {
      title: "New customer",
      status: "READY_FOR_CISAPP_CREATION",
      priority: "NORMAL",
      assignedStaffId: "arun",
    };
    await save(staff, "leads", "lead1", lead);
    await expect(
      save(staff, "leads", "lead1", {
        ...lead,
        status: "CONVERTED",
        linkedCustomerId: "c1",
      }),
    ).rejects.toThrow();
    await save(admin, "leads", "lead1", {
      ...lead,
      status: "CONVERTED",
      linkedCustomerId: "c1",
    });
    expect((await db.doc("leads/lead1").get()).data().status).toBe("CONVERTED");
  });
  function reader(data: Record<string, Data[]>, fail?: string) {
    let failed = false;
    return {
      assertAdmin: async () => {},
      page: async (
        name: string,
        field: string | null,
        cursor: any,
        since: string | null,
        until: string,
      ) => {
        if (fail === name && !failed) {
          failed = true;
          throw Error("Injected read failure");
        }
        const rows = (data[name] || [])
          .filter(
            (r) =>
              !field ||
              (r[field] && (!since || r[field] >= since) && r[field] <= until),
          )
          .sort((a, b) =>
            String(field ? a[field] + a.id : a.id).localeCompare(
              String(field ? b[field] + b.id : b.id),
            ),
          )
          .filter(
            (r) =>
              !cursor ||
              (field
                ? String(r[field]) + r.id > cursor.value + cursor.id
                : r.id > cursor.id),
          )
          .slice(0, 50);
        const last = rows.at(-1);
        return {
          rows: rows.map(({ id, ...data }) => ({ id, data })),
          cursor: last
            ? { id: last.id, ...(field ? { value: last[field] } : {}) }
            : null,
          done: rows.length < 50,
        };
      },
    };
  }
  async function finish(r: any, mode = "INITIAL") {
    let s: any;
    for (let n = 0; n < 80; n++) {
      s = await sync("admin", "fake", n ? "RETRY" : mode, "2026-09", r);
      if (!s.runId) return s;
    }
    throw Error("Run did not finish");
  }
  it("resumes a failed bootstrap and reconciles hard deletion without duplicate mirrors", async () => {
    const data = {
      customers: [
        {
          id: "c1",
          name: "ABC",
          totalOutstandingAmount: 18500,
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      customerCreditProfiles: [
        {
          id: "c1",
          overdueAmount: 8500,
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    };
    const r = reader(data, "customerCreditProfiles");
    await expect(finish(r)).rejects.toThrow("Injected");
    expect((await db.doc("syncState/cisapp").get()).data().runId).toBeTruthy();
    const complete = await finish(r, "RETRY");
    expect(complete.status).toBe("SUCCESS");
    expect(
      (await db.doc("collectionSnapshots/c1").get()).data().outstandingAmount,
    ).toBe(18500);
    data.customers = [];
    await finish(reader(data), "RECONCILE");
    expect((await db.doc("staffCustomers/c1").get()).data().active).toBe(false);
  });
  it("does not lose equal-timestamp records across pages", async () => {
    const data = {
      customers: Array.from({ length: 55 }, (_, i) => ({
        id: `c${String(i).padStart(3, "0")}`,
        name: `C${i}`,
        updatedAt: "2026-09-01T00:00:00.000Z",
      })),
    };
    await finish(reader(data));
    expect((await db.collection("adminCis_customers").get()).size).toBe(55);
  });
  it("copies financialSummaryUpdatedAt changes even when updatedAt stays old", async () => {
    const data = {
      customers: [
        {
          id: "c1",
          name: "ABC",
          totalOutstandingAmount: 18500,
          updatedAt: "2026-01-01T00:00:00.000Z",
          financialSummaryUpdatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    await finish(reader(data));
    data.customers[0].totalOutstandingAmount = 13500;
    data.customers[0].financialSummaryUpdatedAt = new Date().toISOString();
    await finish(reader(data), "INCREMENTAL");
    expect(
      (await db.doc("collectionSnapshots/c1").get()).data().outstandingAmount,
    ).toBe(13500);
  });
  it("keeps incomplete source target totals unavailable", async () => {
    await db.doc("targets/BUSINESS_company_2026-09").set({
      scope: "BUSINESS",
      subjectId: "company",
      month: "2026-09",
      target: 300000,
    });
    await db.doc("adminCis_businessMonthlySnapshots/2026-09").set({
      payload: { month: "2026-09", totalSales: 50000, needsBackfill: true },
    });
    await rebuild("2026-09");
    expect(
      (await db.doc("businessTargetProgress/2026-09").get()).data().achieved,
    ).toBeNull();
  });
  it("does not invent zero for a missing total in a supposedly complete summary", async () => {
    await db
      .doc("targets/BUSINESS_company_2026-09")
      .set({
        scope: "BUSINESS",
        subjectId: "company",
        month: "2026-09",
        target: 300000,
      });
    await db
      .doc("adminCis_businessMonthlySnapshots/2026-09")
      .set({ payload: { month: "2026-09", needsBackfill: false } });
    await rebuild("2026-09");
    expect(
      (await db.doc("businessTargetProgress/2026-09").get()).data().achieved,
    ).toBeNull();
  });
});
