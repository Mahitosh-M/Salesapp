import type { Data } from "../../../shared/schema";
// Target-only eligibility matches the existing CISapp monthly snapshot policy.
// Reference: CISapp src/utils/bonusPc.ts:isValidBonusInvoice and openingBalance.ts.
export function isTargetInvoice(d: Data) {
  const normalized = (v: unknown) =>
    String(v || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");
  const type = normalized(d.invoiceType),
    status = normalized(d.recordStatus || d.status);
  return (
    !d.isOpeningBalance &&
    type !== "opening balance" &&
    !String(d.invoiceNumber || "").startsWith("0000-OPENING") &&
    !["draft", "cancelled", "canceled", "deleted", "void"].includes(status) &&
    ![
      "sales return",
      "sale return",
      "return",
      "credit note",
      "inter shop",
      "quotation",
      "quote",
      "order",
      "confirmed order",
      "cogs",
      "inventory",
    ].includes(type)
  );
}
