import { describe, it, expect } from "vitest";
import {
  needsAutomaticVisit,
  visitDueDate,
  automaticVisitId,
} from "../shared/autoVisits";
import { createCisappReader } from "../src/spark/cisapp/reader";
describe("Automatic visit date policy", () => {
  it("includes exactly ten days and older, but not nine days", () => {
    expect(needsAutomaticVisit("2026-08-27", "2026-09-06")).toBe(true);
    expect(needsAutomaticVisit("2026-08-26", "2026-09-06")).toBe(true);
    expect(needsAutomaticVisit("2026-08-28", "2026-09-06")).toBe(false);
  });
  it("handles calendar boundaries and leap days", () => {
    expect(visitDueDate("2024-02-25")).toBe("2024-03-06");
    expect(visitDueDate("2025-12-25")).toBe("2026-01-04");
  });
  it.each([null, undefined, "", "2026-02-30", "bad", 123])(
    "does not invent a last order for %j",
    (d) => expect(needsAutomaticVisit(d, "2026-09-06")).toBe(false),
  );
  it("ignores future orders", () =>
    expect(needsAutomaticVisit("2026-09-07", "2026-09-06")).toBe(false));
  it("uses stable bounded IDs per customer and order date", async () => {
    const a = await automaticVisitId("customer_1", "2026-08-27");
    expect(a).toBe(await automaticVisitId("customer_1", "2026-08-27"));
    expect(a).not.toBe(await automaticVisitId("customer_1", "2026-08-28"));
    expect(a.length).toBeLessThan(100);
  });
});
describe("Last-order source lookup", () => {
  it("reads one projected invoice at a time and resumes past drafts", async () => {
    const calls: any[] = [];
    const transport = async (url: any, options: any) => {
      calls.push({ url, options });
      return new Response(
        JSON.stringify([
          {
            document: {
              name: "projects/cisapp-236ab/databases/(default)/documents/invoices/i1",
              fields: {
                date: { stringValue: "2026-08-27" },
                recordStatus: {
                  stringValue: calls.length === 1 ? "draft" : "posted",
                },
              },
            },
          },
        ]),
        { status: 200 },
      );
    };
    const reader = createCisappReader(
      "x".repeat(40),
      transport as typeof fetch,
    );
    const first = await reader.latestOrderPage(
      "customer_1",
      null,
      "2026-09-06",
    );
    expect(first.done).toBe(false);
    expect(first.date).toBe(null);
    const second = await reader.latestOrderPage(
      "customer_1",
      first.cursor,
      "2026-09-06",
    );
    expect(second.date).toBe("2026-08-27");
    expect(second.done).toBe(true);
    const q = JSON.parse(calls[1].options.body).structuredQuery;
    expect(q.limit).toBe(1);
    expect(q.startAt.before).toBe(false);
    expect(
      q.where.compositeFilter.filters[0].fieldFilter.value.stringValue,
    ).toBe("customer_1");
    expect(q.select.fields.map((f: any) => f.fieldPath)).not.toContain(
      "totalSales",
    );
    expect(
      calls.every(
        (c) => c.options.method === "POST" && c.url.endsWith(":runQuery"),
      ),
    ).toBe(true);
  });
  it("returns unknown for a customer without orders", async () => {
    const r = createCisappReader(
      "x".repeat(40),
      (async () => new Response("[]", { status: 200 })) as typeof fetch,
    );
    expect((await r.latestOrderPage("none", null, "2026-09-06")).date).toBe(
      null,
    );
  });
});
