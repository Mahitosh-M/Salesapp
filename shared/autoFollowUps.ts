const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
export function followUpDueDate(lastOrderDate: unknown, asOf: string) {
  if (!validDate(asOf)) return null;
  if (lastOrderDate === null || lastOrderDate === "") return asOf;
  if (!validDate(lastOrderDate)) return null;
  const date = new Date(`${lastOrderDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 10);
  return date.toISOString().slice(0, 10);
}
export function needsAutomaticFollowUp(lastOrderDate: unknown, asOf: string) {
  const due = followUpDueDate(lastOrderDate, asOf);
  return due !== null && due <= asOf;
}
export async function automaticFollowUpId(customerId: string, lastOrderDate: unknown) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(customerId));
  const customerHash = Array.from(new Uint8Array(hash)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `auto10_${validDate(lastOrderDate) ? lastOrderDate : "never"}_${customerHash}`;
}
