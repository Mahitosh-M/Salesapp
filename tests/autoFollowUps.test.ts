import { describe, expect, it } from "vitest";
import { automaticFollowUpId, followUpDueDate, needsAutomaticFollowUp } from "../shared/autoFollowUps";
describe("Automatic 15-day follow-up policy", () => {
  it("includes exactly fifteen days and older, but not fourteen days", () => {
    expect(needsAutomaticFollowUp("2026-08-22", "2026-09-06")).toBe(true);
    expect(needsAutomaticFollowUp("2026-08-21", "2026-09-06")).toBe(true);
    expect(needsAutomaticFollowUp("2026-08-23", "2026-09-06")).toBe(false);
  });
  it("includes customers with no normal business order", () => {
    expect(needsAutomaticFollowUp(null, "2026-09-06")).toBe(true);
    expect(followUpDueDate(null, "2026-09-06")).toBe("2026-09-06");
  });
  it("handles calendar boundaries and invalid dates", () => {
    expect(followUpDueDate("2024-02-20", "2024-03-06")).toBe("2024-03-06");
    expect(needsAutomaticFollowUp("2026-02-30", "2026-09-06")).toBe(false);
  });
  it("uses stable IDs without colliding with manual follow-ups", async () => {
    const id = await automaticFollowUpId("customer_1", "2026-08-22");
    expect(id).toBe(await automaticFollowUpId("customer_1", "2026-08-22"));
    expect(id).not.toBe(await automaticFollowUpId("customer_1", "2026-08-21"));
    expect(id.startsWith("auto15_")).toBe(true);
  });
});