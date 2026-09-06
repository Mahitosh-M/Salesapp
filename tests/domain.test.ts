import { describe, it, expect } from "vitest";
import {
  businessMonth,
  validateRecord,
  targetMetrics,
  renderTemplate,
  whatsappUrl,
} from "../shared/schema";
import {
  materializeCustomer,
  projectSource,
} from "../functions/src/cisapp/mapper";
import { isTargetInvoice } from "../functions/src/cisapp/targetInvoice";
import { createCisappReader } from "../functions/src/cisapp/reader";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
describe("Commercial data boundary", () => {
  it("uses an explicit allowlist and never exposes financial intelligence to staff", () => {
    const source = {
      name: "ABC",
      mobile: "9999999999",
      area: "Town",
      tier: "Tier 1",
      totalSales: 80000,
      totalProfit: 12000,
      intelligenceScore: 99,
      notes: "Secret",
      totalOutstandingAmount: 18500,
    };
    const result = materializeCustomer(
      "permanent-id",
      source,
      {
        overdueAmount: 8500,
        creditPaymentScore: 99,
        approvedCreditLimit: 100000,
      },
      { assignedStaffId: "arun" },
      "2026-09-06",
    );
    expect(result.customer.customerId).toBe("permanent-id");
    expect(result.collection.outstandingAmount).toBe(18500);
    expect(result.collection.overdueAmount).toBe(8500);
    for (const k of [
      "tier",
      "totalSales",
      "totalProfit",
      "intelligenceScore",
      "notes",
      "creditPaymentScore",
      "approvedCreditLimit",
    ])
      expect(JSON.stringify(result)).not.toContain(`"${k}"`);
  });
  it("does not replace absent source numbers with zero", () => {
    const r = materializeCustomer("c", { name: "ABC" }, null, {}, "now");
    expect(r.collection.outstandingAmount).toBeNull();
    expect(r.collection.overdueAmount).toBeNull();
  });
  it("revokes access when a source customer disappears", () =>
    expect(
      materializeCustomer(
        "c",
        null,
        { overdueAmount: 900 },
        { assignedStaffId: "s" },
        "now",
      ).customer.active,
    ).toBe(false));
  it("ignores arbitrary fields in source projections", () =>
    expect(
      projectSource("customers", {
        name: "ABC",
        totalProfit: 55,
        notes: "private",
      }),
    ).toEqual({ name: "ABC" }));
});
describe("Workflow validation", () => {
  const base = {
    title: "Payment promise",
    status: "PROMISED",
    priority: "NORMAL",
    assignedStaffId: "staff",
    customerId: "customer",
    amount: 5000,
    promiseDate: "2026-09-08",
    notes: "",
  };
  it("accepts collection promises without creating a payment", () =>
    expect(validateRecord("collectionPromises", base).amount).toBe(5000));
  it.each([
    { ...base, amount: -1 },
    { ...base, profit: 500 },
    { ...base, status: "PAID" },
    { ...base, promiseDate: "2026-02-30" },
    { ...base, customerId: "../other" },
  ])("rejects malformed or unapproved fields", (data) =>
    expect(() => validateRecord("collectionPromises", data)).toThrow(),
  );
  it("calculates only target progress, not source financial truth", () => {
    const r = targetMetrics(
      300000,
      192000,
      "2026-09",
      new Date("2026-09-20T00:00:00Z"),
    );
    expect(r.percentage).toBe(64);
    expect(r.remaining).toBe(108000);
    expect(r.paceStatus).toBe("BEHIND_PACE");
    expect(targetMetrics(1, null, "2026-09").percentage).toBeNull();
  });
  it("builds an encoded WhatsApp link from an approved template", () => {
    const text = renderTemplate(
      "Hello {{customerName}}, {{amount}} is due. â€” {{staffName}}",
      { customerName: "A & B", amount: "â‚¹5000", staffName: "Arun" },
    );
    expect(whatsappUrl("98765 43210", text)).toContain("A%20%26%20B");
    expect(whatsappUrl("123", "x")).toBeNull();
  });
  it.each([
    "opening_balance",
    "credit_note",
    "sales-return",
    "inter_shop",
    "order",
    "quotation",
  ])("excludes %s from target-only invoice reconciliation", (invoiceType) =>
    expect(isTargetInvoice({ invoiceType, totalSales: 100 })).toBe(false),
  );
});
describe("Source reader", () => {
  it("exposes no mutation operation and rejects unapproved collections", async () => {
    const reader = createCisappReader("x".repeat(40), async () => {
      throw Error("Must not call");
    });
    expect(Object.keys(reader).sort()).toEqual(["assertAdmin", "page"]);
    await expect(
      reader.page("payments", null, null, null, "now"),
    ).rejects.toThrow("not allowed");
  });
  it("uses timestamp plus document ID to avoid losing equal-timestamp records", async () => {
    let request: any;
    const transport = async (url: any, init: any) => {
      request = { url, ...init };
      return new Response(
        JSON.stringify([
          {
            document: {
              name: "projects/cisapp-236ab/databases/(default)/documents/customers/c2",
              fields: {
                updatedAt: { stringValue: "2026-09-06T00:00:00Z" },
                name: { stringValue: "ABC" },
              },
            },
          },
        ]),
        { status: 200 },
      );
    };
    const r = await createCisappReader("x".repeat(40), transport as any).page(
      "customers",
      "updatedAt",
      { id: "c1", value: "2026-09-06T00:00:00Z" },
      "2026-09-05T00:00:00Z",
      "2026-09-07T00:00:00Z",
    );
    const q = JSON.parse(request.body).structuredQuery;
    expect(request.url.endsWith(":runQuery")).toBe(true);
    expect(q.startAt.before).toBe(false);
    expect(q.startAt.values[1].referenceValue.endsWith("/customers/c1")).toBe(
      true,
    );
    expect(q.limit).toBe(50);
    expect(r.rows[0].id).toBe("c2");
  });
  it("has no source mutation imports and no browser source Firestore connection", () => {
    const reader = readFileSync("functions/src/cisapp/reader.ts", "utf8");
    expect(reader).not.toMatch(
      /from ['"]firebase-admin|\.set\(|\.update\(|\.delete\(|:commit|:batchWrite/,
    );
    for (const name of ["src/firebase.ts", "src/services/sales.ts"])
      expect(readFileSync(name, "utf8")).not.toContain("cisapp-236ab");
    expect(readFileSync("src/services/cisappSession.ts", "utf8")).not.toMatch(
      /from ['"]firebase\/firestore/,
    );
  });
});

it("uses the business timezone at a month boundary", () => {
  expect(businessMonth("2026-09-30T20:00:00.000Z")).toBe("2026-10");
  expect(businessMonth("2026-09-30T17:00:00.000Z")).toBe("2026-09");
});
