import { describe, it, beforeAll, afterAll, expect } from "vitest";
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
} from "firebase/firestore";
import { readFileSync } from "node:fs";
const suite = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
let env: RulesTestEnvironment;
suite("Project B Firestore security", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-salesapp",
      firestore: {
        host: "127.0.0.1",
        port: 8085,
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const [id, role, active] of [
        ["admin", "Admin", true],
        ["arun", "Staff", true],
        ["other", "Staff", true],
        ["disabled", "Staff", false],
      ] as const)
        await setDoc(doc(db, "users", id), { uid: id, role, active });
      for (const col of [
        "staffCustomers",
        "collectionSnapshots",
        "leads",
        "tasks",
        "competitorNotes",
        "activities",
      ]) {
        await setDoc(doc(db, col, "mine"), {
          assignedStaffId: "arun",
          active: true,
        });
        await setDoc(doc(db, col, "theirs"), {
          assignedStaffId: "other",
          active: true,
        });
      }
      for (const col of [
        "adminCis_customerIntelligenceSummaries",
        "adminCis_customerMonthlySnapshots",
        "adminCis_customerCreditProfiles",
        "businessPerformance",
        "businessTargetProgress",
        "syncState",
      ])
        await setDoc(doc(db, col, "secret"), { profit: 1000 });
      await setDoc(doc(db, "staffPerformance", "arun_2026-09"), {
        staffId: "arun",
        month: "2026-09",
      });
      await setDoc(doc(db, "staffPerformance", "other_2026-09"), {
        staffId: "other",
        month: "2026-09",
      });
      await setDoc(doc(db, "messageTemplates", "approved"), {
        status: "APPROVED",
      });
      await setDoc(doc(db, "messageTemplates", "draft"), { status: "DRAFT" });
    });
  });
  afterAll(async () => {
    await env.cleanup();
  });
  it("permits assigned customer and collection reads", async () => {
    const db = env.authenticatedContext("arun").firestore();
    await assertSucceeds(getDoc(doc(db, "staffCustomers", "mine")));
    await assertSucceeds(getDoc(doc(db, "collectionSnapshots", "mine")));
  });
  it.each([
    "staffCustomers",
    "collectionSnapshots",
    "leads",
    "tasks",
    "competitorNotes",
    "activities",
  ])(
    "denies another staff member’s %s",
    async (col) =>
      await assertFails(
        getDoc(
          doc(env.authenticatedContext("arun").firestore(), col, "theirs"),
        ),
      ),
  );
  it.each([
    "adminCis_customerIntelligenceSummaries",
    "adminCis_customerMonthlySnapshots",
    "adminCis_customerCreditProfiles",
    "businessPerformance",
    "businessTargetProgress",
    "syncState",
  ])(
    "denies staff access to %s",
    async (col) =>
      await assertFails(
        getDoc(
          doc(env.authenticatedContext("arun").firestore(), col, "secret"),
        ),
      ),
  );
  it("requires scope in the query, not frontend filtering", async () => {
    const db = env.authenticatedContext("arun").firestore();
    await assertFails(
      getDocs(query(collection(db, "staffCustomers"), limit(25))),
    );
    const r = await assertSucceeds(
      getDocs(
        query(
          collection(db, "staffCustomers"),
          where("assignedStaffId", "==", "arun"),
          where("active", "==", true),
          limit(25),
        ),
      ),
    );
    expect(r.size).toBe(1);
  });
  it("rejects unbounded and oversized customer queries", async () => {
    const db = env.authenticatedContext("arun").firestore();
    await assertFails(
      getDocs(
        query(
          collection(db, "staffCustomers"),
          where("assignedStaffId", "==", "arun"),
          where("active", "==", true),
        ),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(db, "staffCustomers"),
          where("assignedStaffId", "==", "arun"),
          where("active", "==", true),
          limit(500),
        ),
      ),
    );
  });
  it("allows only own performance", async () => {
    const db = env.authenticatedContext("arun").firestore();
    await assertSucceeds(getDoc(doc(db, "staffPerformance", "arun_2026-09")));
    await assertFails(getDoc(doc(db, "staffPerformance", "other_2026-09")));
  });
  it("allows only approved templates", async () => {
    const db = env.authenticatedContext("arun").firestore();
    await assertSucceeds(getDoc(doc(db, "messageTemplates", "approved")));
    await assertFails(getDoc(doc(db, "messageTemplates", "draft")));
  });
  it("blocks self-promotion and all client mirror/summary writes", async () => {
    const db = env.authenticatedContext("arun").firestore();
    for (const col of [
      "users",
      "staffCustomers",
      "staffPerformance",
      "adminCis_customerCreditProfiles",
      "tasks",
    ])
      await assertFails(
        setDoc(doc(db, col, "arun"), { role: "Admin", active: true }),
      );
  });
  it("denies inactive users and anonymous reads", async () => {
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext("disabled").firestore(),
          "staffCustomers",
          "mine",
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(env.unauthenticatedContext().firestore(), "staffCustomers", "mine"),
      ),
    );
  });
  it("permits Admin intelligence reads but still denies client mirror writes", async () => {
    const db = env.authenticatedContext("admin").firestore();
    await assertSucceeds(
      getDoc(doc(db, "adminCis_customerIntelligenceSummaries", "secret")),
    );
    await assertFails(
      setDoc(doc(db, "adminCis_customerIntelligenceSummaries", "secret"), {
        profit: 1,
      }),
    );
  });
});
