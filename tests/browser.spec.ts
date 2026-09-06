import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, user = "arun") {
  await page.goto("/");
  await page.getByLabel("Email address").fill(`${user}@salesapp.test`);
  await page.getByLabel("Password", { exact: true }).fill("SalesappDemo!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name:
        user === "admin"
          ? "Move the team forward"
          : /Good (morning|afternoon|evening), Arun/,
    }),
  ).toBeVisible();
}
test("desktop login, staff Today, and customer data boundaries", async ({
  page,
}) => {
  const sourceRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("cisapp-236ab")) sourceRequests.push(r.url());
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(page.getByText("Letâ€™s get to work.")).toBeVisible();
  await page.screenshot({
    path: "artifacts/login-desktop.png",
    fullPage: true,
  });
  await login(page);
  await expect(
    page.getByText("â‚¹1,92,000", { exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/today-desktop.png",
    fullPage: true,
  });
  await page.goto("/customers/abc");
  await expect(
    page.getByRole("heading", { name: "ABC Medical", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("â‚¹18,500", { exact: true })).toBeVisible();
  await expect(page.getByText("â‚¹8,500", { exact: true })).toBeVisible();
  await expect(page.getByText(/Admin intelligence/)).toHaveCount(0);
  await expect(page.getByText("â‚¹85,000", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Log interaction", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Outcome").selectOption("CALL_LATER");
  const note = `Browser test ${Date.now()}: contact again tomorrow.`;
  await dialog.getByLabel("Notes").fill(note);
  await dialog.getByRole("button", { name: "Save interaction" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(note)).toBeVisible();
  await page.goto("/sync");
  await expect(page).toHaveURL("http://127.0.0.1:5175/");
  expect(sourceRequests).toEqual([]);
});
test("mobile work queue, task update, and navigation fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.screenshot({ path: "artifacts/today-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const nav = page.locator(".bottom-nav");
  await nav.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tasks", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Update", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("COMPLETED");
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".record-card .badge.completed").first(),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Customers", exact: true }).click();
  await page.getByRole("link", { name: /ABC Medical/ }).click();
  await expect(
    page.getByRole("heading", { name: "ABC Medical", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("â‚¹18,500", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/customer-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("admin pages render and campaign assignment creates customer work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, "admin");
  await page.screenshot({
    path: "artifacts/admin-desktop.png",
    fullPage: true,
  });
  for (const [path, heading] of [
    ["/marketing", "Make your outreach matter"],
    ["/targets", "Monthly targets"],
    ["/performance", "Team performance"],
    ["/settings", "People & workspace"],
    ["/sync", "CISapp Sync"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { name: "How Salesapp works", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Collections", exact: true })).toBeVisible();
  await expect(page.getByText(/outstanding balance is greater than zero/)).toBeVisible();
  await page.goto("/work/campaigns");
  await page.getByRole("button", { name: "Assign next page" }).first().click();
  await expect(page.getByText(/contacts assigned/)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.goto("/customers/abc");
  await expect(
    page.getByRole("heading", { name: /Admin intelligence/ }),
  ).toBeVisible();
  await expect(page.getByText("â‚¹85,000", { exact: true })).toBeVisible();
});

test("Spark rejects unauthenticated and Staff privileged operations", async ({
  page,
}) => {
  await page.goto("/");
  const anonymous = await page.evaluate(async () => {
    const { command } = await import("/src/services/sales.ts");
    try {
      await command("saveSettings", { businessName: "forged" });
      return "allowed";
    } catch {
      return "denied";
    }
  });
  expect(anonymous).toBe("denied");
  await login(page);
  const results = await page.evaluate(async () => {
    const { command } = await import("/src/services/sales.ts");
    const { salesDb } = await import("/src/firebase.ts");
    const { doc, setDoc } =
      await import("/node_modules/.vite/deps/firebase_firestore.js");
    const results = [];
    for (const action of [
      () =>
        command("synchronizeCisapp", {
          token: "bad",
          mode: "INITIAL",
          month: "2026-09",
        }),
      () => setDoc(doc(salesDb, "users", "arun"), { role: "Admin" }),
      () =>
        setDoc(doc(salesDb, "staffPerformance", "arun_2026-09"), {
          counts: { calls: 999 },
        }),
    ]) {
      try {
        await action();
        results.push("allowed");
      } catch {
        results.push("denied");
      }
    }
    return results;
  });
  expect(results).toEqual(["denied", "denied", "denied"]);
});

test("Spark saves every Staff workflow, linked tasks and server-dated performance", async ({
  page,
}) => {
  await login(page);
  const result = await page.evaluate(async () => {
    const { modules, today } = await import("/shared/schema.ts");
    const { command, page: readPage } = await import("/src/services/sales.ts");
    const { actor } = await import("/src/spark/db.ts");
    const errors = [];
    const ids = {};
    for (const [kind, spec] of Object.entries(modules)) {
      if (spec.adminOnly || kind === "campaignAssignments") continue;
      const record = {
        title: `Spark test ${kind}`,
        assignedStaffId: "arun",
        priority: "NORMAL",
        status: spec.statuses[0],
      };
      for (const f of spec.fields) {
        record[f.key] =
          f.key === "customerId"
            ? "abc"
            : f.key === "linkedCustomerId" || f.type === "lead"
              ? ""
              : f.options
                ? f.options[0]
                : f.type === "date"
                  ? today()
                  : f.type === "number"
                    ? 100
                    : f.required
                      ? "Example"
                      : "";
      }
      const id = crypto.randomUUID();
      ids[kind] = id;
      try {
        await command("saveSalesRecord", { kind, id, record });
      } catch (e) {
        errors.push(`${kind}: ${e.message}`);
      }
    }
    const perf = await readPage("staffPerformance", await actor(null), [
      ["month", "==", today().slice(0, 7)],
    ]);
    return { errors, calls: perf.rows[0]?.counts?.calls || 0 };
  });
  expect(result.errors).toEqual([]);
  expect(result.calls).toBeGreaterThan(0);
});
test("Spark Admin sync checkpoints and materializes through real B rules with a fake source", async ({
  page,
}) => {
  await login(page, "admin");
  const result = await page.evaluate(async () => {
    const { syncStep } = await import("/src/spark/sync.ts");
    const { salesDb } = await import("/src/spark/db.ts");
    const now = new Date().toISOString();
    const reader = {
      assertAdmin: async () => {},
      latestOrderPage: async () => ({
        date: "2026-08-20",
        cursor: null,
        done: true,
        read: 1,
      }),
      page: async (name) => ({
        rows:
          name === "customers"
            ? [
                {
                  id: "spark-import",
                  data: {
                    name: "Spark import",
                    mobile: "9999999999",
                    totalOutstandingAmount: 700,
                    updatedAt: now,
                  },
                },
              ]
            : [],
        cursor: null,
        done: true,
      }),
    };
    let result;
    for (let n = 0; n < 35; n++) {
      result = await syncStep(
        "admin",
        "fake-token",
        "INITIAL",
        now.slice(0, 7),
        reader,
      );
      if (!result.runId) break;
    }
    const c = (await salesDb.doc("staffCustomers/spark-import").get()).data();
    const financial = (
      await salesDb.doc("collectionSnapshots/spark-import").get()
    ).data();
    return {
      status: result.status,
      name: c?.name,
      amount: financial?.outstandingAmount,
    };
  });
  expect(result).toEqual({
    status: "SUCCESS",
    name: "Spark import",
    amount: 700,
  });
});

test("Spark Admin creates Staff without replacing their own login", async ({
  page,
}) => {
  await login(page, "admin");
  const result = await page.evaluate(async () => {
    const { command, readOne } = await import("/src/services/sales.ts");
    const { salesAuth } = await import("/src/firebase.ts");
    const email = `spark-${Date.now()}@salesapp.test`;
    const result = await command("saveUser", {
      name: "Spark Staff",
      email,
      password: "123456",
      role: "Staff",
      active: true,
      branchId: "",
    });
    const user = await readOne("users", result.uid);
    await command("saveUser", {
      uid: result.uid,
      name: "Spark Staff",
      email,
      role: "Staff",
      active: false,
      branchId: "",
    });
    const disabled = await readOne("users", result.uid);
    return {
      role: user.role,
      active: disabled.active,
      current: salesAuth.currentUser.uid,
    };
  });
  expect(result).toEqual({ role: "Staff", active: false, current: "admin" });
});

test("Automatic visits use ten-day threshold, preserve completion and cancel after new orders", async ({
  page,
}) => {
  await login(page, "admin");
  await page.evaluate(async () => {
    const { salesDb } = await import("/src/spark/db.ts");
    const { today } = await import("/shared/schema.ts");
    const date = (days) => {
      const d = new Date(today() + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - days);
      return d.toISOString().slice(0, 10);
    };
    for (const [id, days] of [
      ["auto-nine", 9],
      ["auto-ten", 10],
      ["auto-eleven", 11],
      ["auto-none", null],
    ])
      await salesDb
        .doc(`staffCustomers/${id}`)
        .set({
          customerId: id,
          name: id,
          active: true,
          assignedStaffId: "arun",
          lastOrderDate: days === null ? null : date(days),
          lastOrderCheckedAt: new Date().toISOString(),
        });
  });
  await page.getByRole("button", { name: /Sign out/ }).click();
  await login(page);
  await page.goto("/work/visits");
  await expect(
    page.getByRole("heading", { name: "Visit auto-ten", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const { actor, salesDb } = await import("/src/spark/db.ts");
    const { generateAutomaticVisits } =
      await import("/src/spark/autoVisits.ts");
    const { automaticVisitId } = await import("/shared/autoVisits.ts");
    const { modules } = await import("/shared/schema.ts");
    const { saveRecord } = await import("/src/spark/records.ts");
    const p = await actor(null);
    await Promise.all([generateAutomaticVisits(p), generateAutomaticVisits(p)]);
    const visits = await salesDb
      .collection("visits")
      .where("assignedStaffId", "==", "arun")
      .limit(100)
      .get();
    const auto = visits.docs.filter((r) => r.id.startsWith("auto10_"));
    const ten = auto.find((r) => r.data().customerId === "auto-ten");
    const row = ten.data();
    const input = Object.fromEntries(
      [
        "title",
        "status",
        "priority",
        "assignedStaffId",
        ...modules.visits.fields.map((f) => f.key),
      ].map((k) => [k, row[k] || ""]),
    );
    await saveRecord(p, "visits", ten.id, { ...input, status: "COMPLETED" });
    await generateAutomaticVisits(p);
    return {
      customers: auto.map((r) => r.data().customerId).sort(),
      completed: (await salesDb.doc(`visits/${ten.id}`).get()).data().status,
    };
  });
  expect(result).toEqual({
    customers: ["auto-eleven", "auto-ten"],
    completed: "COMPLETED",
  });
  await page.getByRole("button", { name: /Sign out/ }).click();
  await login(page, "admin");
  const cancelled = await page.evaluate(async () => {
    const { salesDb, actor } = await import("/src/spark/db.ts");
    const { today } = await import("/shared/schema.ts");
    const { generateAutomaticVisits } =
      await import("/src/spark/autoVisits.ts");
    await salesDb
      .doc("staffCustomers/auto-eleven")
      .update({ lastOrderDate: today() });
    await generateAutomaticVisits(await actor(null));
    const visits = await salesDb
      .collection("visits")
      .where("customerId", "==", "auto-eleven")
      .limit(25)
      .get();
    const row = visits.docs[0];
    return {
      visit: row.data().status,
      task: (await salesDb.doc(`tasks/visits_${row.id}`).get()).data().status,
    };
  });
  expect(cancelled).toEqual({ visit: "CANCELLED", task: "CANCELLED" });
});

