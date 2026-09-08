import { salesDb } from "./db";
import { isTargetInvoice } from "./cisapp/targetInvoice";
import type { Data } from "../../shared/schema";

const dayNumber = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  return Date.parse(`${value}T00:00:00Z`) / 86400000;
};

export function signalMatchesInvoice(signal: Data, invoice: Data) {
  const signalDay = dayNumber(signal.orderedOn);
  const invoiceDay = dayNumber(invoice.date);
  if (signalDay === null || invoiceDay === null) return false;
  const distance = invoiceDay - signalDay;
  return (
    signal.customerId === invoice.customerId &&
    Boolean(signal.assignedStaffId) &&
    (!signal.claimedInvoiceId || signal.claimedInvoiceId === invoice.id) &&
    distance >= -1 &&
    distance <= 10
  );
}

export async function storeInvoiceOrder(
  invoiceId: string,
  invoice: Data,
  syncedAt: string,
) {
  const input: Data = { ...invoice, id: invoiceId };
  if (
    !isTargetInvoice(input) ||
    typeof input.customerId !== "string" ||
    !input.customerId ||
    dayNumber(input.date) === null ||
    !Number.isFinite(Number(input.totalSales)) ||
    Number(input.totalSales) < 0
  )
    return null;

  const signalRef = salesDb.doc(`customerOrderSignals/${input.customerId}`);
  const lastOrderRef = salesDb.doc(`customerOrderDates/${input.customerId}`);
  const orderRef = salesDb.doc(`staffSalesOrders/${invoiceId}`);
  const customerRef = salesDb.doc(`staffCustomers/${input.customerId}`);
  const directoryToken = typeof input.salesStaffDirectoryToken === "string" ? input.salesStaffDirectoryToken : "";
  const directoryMap = directoryToken ? (await salesDb.doc(`cisStaffDirectoryMap/${directoryToken}`).get()).data() : undefined;
  const manualEmail = typeof input.salesStaffEmail === "string" ? input.salesStaffEmail.trim().toLowerCase() : "";
  const manualSnapshot = manualEmail
    ? await salesDb.collection("users").where("email", "==", manualEmail).limit(1).get()
    : undefined;
  const manualDoc = manualSnapshot?.docs[0];
  const manualStaff = manualDoc?.data();
  const manualStaffId = directoryMap?.active ? directoryMap.staffId : (manualDoc?.id || "");
  return salesDb.runTransaction(async (tx) => {
    const signal = await tx.get(signalRef);
    const lastOrder = await tx.get(lastOrderRef);
    const existing = await tx.get(orderRef);
    const customer = await tx.get(customerRef);
    const previous = existing.data() || {};
    const candidate = signal.data() || {};
    const keepCredit = previous.attributionStatus === "STAFF_CREDITED";
    const matches = !keepCredit && signalMatchesInvoice(candidate, input);
    const manualCredit = !keepCredit && manualStaffId && manualStaff?.role === "Staff" && manualStaff?.active !== false;
    const assignedStaffId = keepCredit
      ? previous.assignedStaffId
      : manualCredit
        ? manualStaffId
        : matches
        ? candidate.assignedStaffId
        : "";
    const assignedStaffName = keepCredit
      ? previous.assignedStaffName
      : manualCredit
        ? (manualStaff?.name || input.salesStaffName || "")
        : matches
        ? candidate.assignedStaffName
        : "";
    const attributionStatus = assignedStaffId
      ? "STAFF_CREDITED"
      : "DIRECT_CUSTOMER";
    const month = String(input.date).slice(0, 7);
    const sourceActionType = keepCredit
      ? previous.sourceActionType
      : manualCredit
        ? "INVOICE_ASSIGNMENT"
        : matches
        ? candidate.sourceType
        : "";
    const sourceActionId = keepCredit
      ? previous.sourceActionId
      : manualCredit
        ? ""
        : matches
        ? candidate.sourceId
        : "";
    tx.set(orderRef, {
      invoiceId,
      invoiceNumber: input.invoiceNumber || invoiceId,
      customerId: input.customerId,
      customerName: customer.data()?.name || input.customerId,
      orderDate: input.date,
      month,
      amount: Number(input.totalSales),
      profit: Number(input.totalProfit) || 0,
      paid: String(input.status || "").toUpperCase() === "PAID",
      branchId: input.shopId || customer.data()?.branchId || "",
      assignedStaffId,
      assignedStaffName,
      attributionStatus,
      sourceActionType,
      sourceActionId,
      sourceUpdatedAt: input.updatedAt || input.createdAt || input.date,
      syncedAt,
    });
    if (matches)
      tx.set(signalRef, {
        ...candidate,
        claimedInvoiceId: invoiceId,
        claimedAt: syncedAt,
      });
    const previousDate = lastOrder.data()?.lastOrderDate;
    if (!previousDate || String(input.date) > String(previousDate))
      tx.set(lastOrderRef, {
        lastOrderDate: input.date,
        checkedAt: syncedAt,
        sourceInvoiceId: invoiceId,
        storedInSalesapp: true,
      });
    return {
      assignedStaffId,
      amount: Number(input.totalSales),
      branchId: input.shopId || customer.data()?.branchId || "",
      customerId: input.customerId as string,
      lastOrderChanged:
        !previousDate || String(input.date) > String(previousDate),
    };
  });
}
