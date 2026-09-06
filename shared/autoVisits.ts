export function visitDueDate(lastOrderDate: unknown): string | null {
  if (
    typeof lastOrderDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(lastOrderDate)
  )
    return null;
  const d = new Date(lastOrderDate + "T00:00:00Z");
  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== lastOrderDate
  )
    return null;
  d.setUTCDate(d.getUTCDate() + 10);
  return d.toISOString().slice(0, 10);
}
export function needsAutomaticVisit(lastOrderDate: unknown, asOf: string) {
  const due = visitDueDate(lastOrderDate);
  return due !== null && due <= asOf;
}
export async function automaticVisitId(customerId: string, date: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(customerId),
  );
  return `auto10_${date}_${Array.from(new Uint8Array(hash))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}
