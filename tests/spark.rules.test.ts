import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  serverTimestamp,
  writeBatch,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
let env: RulesTestEnvironment;
const suite = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const base = () => ({
  title: "Call customer",
  assignedStaffId: "arun",
  assignedStaffName: "Arun",
  status: "RECORDED",
  priority: "NORMAL",
  customerId: "mine",
  leadId: "",
  type: "CALL",
  outcome: "CALL_LATER",
  nextFollowUp: "",
  notes: "Call tomorrow",
  createdBy: "arun",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdOn: serverTimestamp(),
  submittedAt: serverTimestamp(),
});
suite("Spark rules enforce browser security", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-salesapp",
      firestore: {
        host: "127.0.0.1",
        port: 8085,
        rules: readFileSync("firestore.spark.rules", "utf8"),
      },
    });
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      for (const [id, role, active] of [
        ["admin", "Admin", true],
        ["arun", "Staff", true],
        ["neha", "Staff", true],
        ["disabled", "Staff", false],
        ["manager", "Manager", true],
      ] as const)
        await setDoc(doc(db, "users", id), {
          uid: id,
          name: id === "arun" ? "Arun" : id,
          role,
          active,
          branchId:
            id === "manager" || id === "arun"
              ? "SINDHANUR"
              : id === "neha"
                ? "MASKI"
                : "",
        });
      for (const [id, owner] of [
        ["mine", "arun"],
        ["theirs", "neha"],
        ["mine-zero", "arun"],
      ]) {
        await setDoc(doc(db, "staffCustomers", id), {
          assignedStaffId: owner,
          active: true,
        });
        await setDoc(doc(db, "collectionSnapshots", id), {
          assignedStaffId: owner,
          active: true,
          outstandingAmount: id === "mine-zero" ? 0 : 500,
        });
        await setDoc(doc(db, "tasks", id), { assignedStaffId: owner });
      }
      await setDoc(doc(db, "adminCis_customerIntelligenceSummaries", "mine"), {
        payload: { totalProfit: 999 },
      });
    });
  });
  afterAll(async () => {
    await env.cleanup();
  });
  it("allows a valid own interaction with server timestamps", async () => {
    await assertSucceeds(
      setDoc(
        doc(
          env.authenticatedContext("arun").firestore(),
          "activities",
          "valid",
        ),
        base(),
      ),
    );
  });
  it.each(["unauthenticated", "disabled", "neha"])(
    "rejects %s acting as Arun",
    async (uid) => {
      const db =
        uid === "unauthenticated"
          ? env.unauthenticatedContext().firestore()
          : env.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(db, "activities", `bad-${uid}`), base()));
    },
  );
  it.each([
    { assignedStaffId: "neha" },
    { customerId: "theirs" },
    { totalProfit: 999 },
    { outcome: "FORGED" },
    { createdBy: "admin" },
    { assignedStaffName: "Admin" },
    { createdOn: new Date(0) },
    { submittedAt: new Date(0) },
    { leadId: "missing" },
    { campaignId: "missing" },
  ])(
    "rejects invalid ownership, references and forged metadata %j",
    async (patch) => {
      await assertFails(
        setDoc(
          doc(
            env.authenticatedContext("arun").firestore(),
            "activities",
            crypto.randomUUID(),
          ),
          { ...base(), ...patch },
        ),
      );
    },
  );
  it("requires follow-up and linked task in the same atomic operation", async () => {
    const db = env.authenticatedContext("arun").firestore();
    await assertFails(
      setDoc(doc(db, "activities", "with-follow"), {
        ...base(),
        nextFollowUp: "2026-09-10",
      }),
    );
    const batch = writeBatch(db);
    const common = base();
    batch.set(doc(db, "activities", "with-follow"), {
      ...common,
      nextFollowUp: "2026-09-10",
    });
    const { type, outcome, nextFollowUp, ...rest } = common;
    batch.set(doc(db, "followUps", "activity_with-follow"), {
      ...rest,
      title: "Follow up",
      status: "PENDING",
      dueDate: "2026-09-10",
      outcome: "",
      nextFollowUp: "",
      branchId: "SINDHANUR",
    });
    batch.set(doc(db, "tasks", "followUps_activity_with-follow"), {
      ...rest,
      title: "Follow up",
      status: "PENDING",
      dueDate: "2026-09-10",
      branchId: "SINDHANUR",
      sourceType: "followUps",
      sourceId: "activity_with-follow",
    });
    await assertSucceeds(batch.commit());
  });
  it("allows Managers to read follow-ups only for their branch", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await setDoc(doc(db, "followUps", "sindhanur-follow-up"), {
        branchId: "SINDHANUR",
        assignedStaffId: "arun",
      });
      await setDoc(doc(db, "followUps", "maski-follow-up"), {
        branchId: "MASKI",
        assignedStaffId: "neha",
      });
    });
    const db = env.authenticatedContext("manager").firestore();
    await assertSucceeds(getDoc(doc(db, "followUps", "sindhanur-follow-up")));
    await assertFails(getDoc(doc(db, "followUps", "maski-follow-up")));
    const rows = await getDocs(
      query(
        collection(db, "followUps"),
        where("branchId", "==", "SINDHANUR"),
        limit(25),
      ),
    );
    const ids = rows.docs.map((row) => row.id);
    expect(ids).toContain("sindhanur-follow-up");
    expect(ids).not.toContain("maski-follow-up");
  });
  it("allows assigned Staff to update delegated task progress without owning the customer", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "tasks", "delegated-task"), {
        title: "Collect customer due",
        status: "PENDING",
        priority: "HIGH",
        assignedStaffId: "arun",
        assignedStaffName: "Arun",
        customerId: "theirs",
        dueDate: "2026-09-10",
        notes: "",
        leadId: "",
        sourceType: "ADMIN",
        sourceId: "delegated-task",
        collectionAmount: "",
        collectionPromiseDate: "",
        unreachableDays: "",
        unreachableSince: "",
        createdBy: "admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdOn: serverTimestamp(),
        submittedAt: serverTimestamp(),
      });
    });
    const db = env.authenticatedContext("arun").firestore();
    await assertSucceeds(
      updateDoc(doc(db, "tasks", "delegated-task"), {
        status: "UNREACHABLE",
        dueDate: "2026-09-11",
        unreachableDays: 1,
        unreachableSince: "2026-09-10",
        notes: "Called once",
        staffNote: "Called once",
        updatedAt: new Date().toISOString(),
        submittedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "tasks", "delegated-task"), {
        title: "Changed by Staff",
        updatedAt: new Date().toISOString(),
        submittedAt: serverTimestamp(),
      }),
    );
  });
  it("denies fabricated task origins", async () => {
    const d = base();
    const { type, outcome, nextFollowUp, ...rest } = d;
    await assertFails(
      setDoc(
        doc(
          env.authenticatedContext("arun").firestore(),
          "tasks",
          "forged-origin",
        ),
        {
          ...rest,
          status: "PENDING",
          dueDate: "2026-09-10",
          sourceType: "campaignAssignments",
          sourceId: "nonexistent",
        },
      ),
    );
  });
  it("keeps interactions immutable and denies deletes", async () => {
    const db = env.authenticatedContext("arun").firestore();
    await assertFails(
      updateDoc(doc(db, "activities", "valid"), {
        notes: "replace",
        submittedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(doc(db, "activities", "valid")));
  });
  it.each([
    "users",
    "staffCustomers",
    "collectionSnapshots",
    "staffTargetProgress",
    "staffPerformance",
    "businessPerformance",
    "syncState",
    "syncDirtyCustomers",
    "adminCis_customerIntelligenceSummaries",
    "targets",
    "messageTemplates",
    "campaigns",
  ])("denies Staff writes to %s", async (col) => {
    await assertFails(
      setDoc(
        doc(env.authenticatedContext("arun").firestore(), col, "forged"),
        base(),
      ),
    );
  });
  it("denies foreign customer and sensitive source reads", async () => {
    const db = env.authenticatedContext("arun").firestore();
    await assertFails(getDoc(doc(db, "staffCustomers", "theirs")));
    await assertFails(
      getDoc(doc(db, "adminCis_customerIntelligenceSummaries", "mine")),
    );
  });
  it("enforces bounded, owner-scoped workflow queries", async () => {
    const db = env.authenticatedContext("arun").firestore();
    await assertFails(getDocs(query(collection(db, "tasks"), limit(25))));
    await assertFails(
      getDocs(
        query(collection(db, "tasks"), where("assignedStaffId", "==", "arun")),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(db, "tasks"),
          where("assignedStaffId", "==", "arun"),
          limit(25),
        ),
      ),
    );
  });
  it("returns only assigned collection records with a positive outstanding balance", async () => {
    const db = env.authenticatedContext("arun").firestore();
    const snapshot = await getDocs(
      query(
        collection(db, "collectionSnapshots"),
        where("assignedStaffId", "==", "arun"),
        where("active", "==", true),
        where("outstandingAmount", ">", 0),
        limit(25),
      ),
    );
    expect(snapshot.docs.map((item) => item.id)).toEqual(["mine"]);
  });
  it("permits Admin source mirrors but blocks sensitive fields in staff documents", async () => {
    const db = env.authenticatedContext("admin").firestore();
    await assertSucceeds(
      setDoc(doc(db, "adminCis_customers", "imported"), {
        payload: { name: "Customer" },
      }),
    );
    await assertFails(
      setDoc(doc(db, "staffCustomers", "imported"), {
        name: "Customer",
        totalProfit: 900,
      }),
    );
  });
  it("prevents self-promotion and Admin self-revocation", async () => {
    await assertFails(
      updateDoc(
        doc(env.authenticatedContext("arun").firestore(), "users", "arun"),
        { role: "Admin" },
      ),
    );
    await assertFails(
      setDoc(
        doc(env.authenticatedContext("admin").firestore(), "users", "admin"),
        {
          uid: "admin",
          name: "Admin",
          email: "admin@example.test",
          role: "Staff",
          active: true,
        },
      ),
    );
  });
});


