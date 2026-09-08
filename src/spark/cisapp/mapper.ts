import type { Data } from "../../../shared/schema";
export const sourceSpecs = [
  {
    name: "customers",
    fields: [
      "name",
      "mobile",
      "customerType",
      "tier",
      "area",
      "branchId",
      "status",
      "totalOutstandingAmount",
      "financialSummaryUpdatedAt",
      "updatedAt",
      "createdAt",
    ],
    timestamps: ["updatedAt", "financialSummaryUpdatedAt"],
  },
  {
    name: "customerCreditProfiles",
    fields: [
      "customerId",
      "tier",
      "currentOutstanding",
      "overdueAmount",
      "oldestOverdueDate",
      "oldestOverdueDays",
      "nextInvoiceDueDate",
      "nextInvoiceDueAmount",
      "creditStatus",
      "calculatedCreditLimit",
      "approvedCreditLimit",
      "availableCredit",
      "creditPaymentScore",
      "lastCreditReviewAt",
      "updatedAt",
    ],
    timestamps: ["updatedAt"],
  },
  {
    name: "customerIntelligenceSummaries",
    fields: [
      "customerId",
      "tier",
      "totalSales",
      "totalProfit",
      "totalPayments",
      "outstanding",
      "invoiceCount",
      "averageOrderValue",
      "frequencyScore",
      "paymentDisciplineScore",
      "salesScore",
      "profitScore",
      "loyaltyScore",
      "intelligenceScore",
      "rank",
      "movement",
      "movementReason",
      "riskLevel",
      "recommendedAction",
      "overdueStatus",
      "calculatedAt",
    ],
    timestamps: ["calculatedAt"],
  },
  {
    name: "pcBalances",
    fields: [
      "customerId",
      "availablePc",
      "incomingPc",
      "redeemedPc",
      "updatedAt",
    ],
    timestamps: ["updatedAt"],
  },
  {
    name: "customerMonthlySnapshots",
    fields: [
      "customerId",
      "month",
      "totalSales",
      "totalProfit",
      "invoiceCount",
      "paymentsReceived",
      "needsBackfill",
      "updatedAt",
    ],
    timestamps: ["updatedAt"],
  },
  {
    name: "businessMonthlySnapshots",
    fields: [
      "month",
      "totalSales",
      "totalProfit",
      "invoiceCount",
      "paymentsReceived",
      "needsBackfill",
      "updatedAt",
    ],
    timestamps: ["updatedAt"],
  },
  { name: "invoices", fields: ["customerId", "totalSales", "totalProfit", "date", "dueDate", "savedDueDate", "finalPcCutoffDate", "bufferDaysAtInvoice", "tierAtInvoice", "invoiceNumber", "invoiceType", "status", "recordStatus", "isOpeningBalance", "updatedAt", "createdAt", "shopId", "salesStaffDirectoryToken", "salesStaffName", "branchSystemVersion"], timestamps: ["updatedAt"] },
  { name: "payments", fields: ["customerId", "invoiceId", "amount", "amountAppliedToInvoice", "cashDiscount", "updatedAt", "createdAt"], timestamps: ["updatedAt"] },
  { name: "settings", fields: ["key", "paymentBuffers", "creditDays", "updatedAt"], timestamps: ["updatedAt"] },
] as const;
export const sourceNames = sourceSpecs.map((s) => s.name);
export function projectSource(name: string, input: Data): Data {
  const spec = sourceSpecs.find((s) => s.name === name);
  if (!spec) throw new Error("Source collection is not allowed");
  return Object.fromEntries(
    spec.fields.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]),
  );
}
const money = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export function materializeCustomer(
  id: string,
  customer: Data | null,
  credit: Data | null,
  assignment: Data,
  now: string,
  orders: Data = {},
) {
  const owner = assignment.assignedStaffId || "";
  const active =
    !!customer &&
    customer.status !== "inactive" &&
    customer.status !== "INACTIVE";
  return {
    customer: {
      customerId: id,
      name: customer?.name || "Source customer unavailable",
      phone: customer?.mobile || "",
      whatsapp: customer?.mobile || "",
      area: customer?.area || "",
      branchId: assignment.branchId || customer?.branchId || "",
      assignedStaffId: owner,
      assignedStaffName: assignment.assignedStaffName || "",
      active,
      lastOrderDate: orders.lastOrderDate || null,
      lastOrderCheckedAt: orders.checkedAt || null,
      sourceUpdatedAt: customer?.updatedAt || customer?.createdAt || null,
      syncedAt: now,
    },
    collection: {
      branchId: assignment.branchId || customer?.branchId || "",
      customerId: id,
      name: customer?.name || "Source customer unavailable",
      assignedStaffId: owner,
      assignedStaffName: assignment.assignedStaffName || "",
      active,
      outstandingAmount: active
        ? money(customer?.totalOutstandingAmount)
        : null,
      overdueAmount: active ? money(credit?.overdueAmount) : null,
      oldestDueDate: credit?.oldestOverdueDate || null,
      dueDate: credit?.nextInvoiceDueDate || null,
      amountRequiringFollowUp: active
        ? money(credit?.nextInvoiceDueAmount)
        : null,
      financialSourceUpdatedAt: customer?.financialSummaryUpdatedAt || null,
      overdueSourceUpdatedAt: credit?.lastCreditReviewAt || null,
      sourceUpdatedAt: customer?.financialSummaryUpdatedAt || null,
      syncedAt: now,
    },
  };
}
