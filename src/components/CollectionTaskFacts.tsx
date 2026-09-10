import { useLiveDocument } from "../hooks";
import { money } from "./ui";
import { collectionDue } from "../../shared/collections";
import { today, type Data } from "../../shared/schema";

const dayCount = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? Math.max(
        0,
        Math.floor(
          (Date.parse(`${today()}T00:00:00Z`) -
            Date.parse(`${date}T00:00:00Z`)) /
            86400000,
        ),
      )
    : 0;

const shortDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`)
        .toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
        .toUpperCase()
    : date || "NOT SET";

const storedFacts = (task: Data) => ({
  amount: Number(
    String(task.notes || "").match(/Combined unpaid amount ([0-9.]+)/)?.[1] ||
      0,
  ),
  dueDate:
    String(task.notes || "").match(/Due dates: ([0-9-]+)/)?.[1] ||
    String(task.dueDate || ""),
});

export function CollectionTaskFacts({
  task,
  includeStatus = false,
}: {
  task: Data;
  includeStatus?: boolean;
}) {
  const snapshot = useLiveDocument(
    "collectionSnapshots",
    String(task.customerId || ""),
  );
  const stored = storedFacts(task);
  const current = snapshot.row
    ? collectionDue(snapshot.row.invoices || [], today())
    : null;
  const amount = current
    ? current.amount
    : stored.amount;
  const dueDate = current?.invoices.length
    ? String(
        current.invoices
          .map((invoice) => invoice.dueDate)
          .filter(Boolean)
          .sort()[0] || stored.dueDate,
      )
    : stored.dueDate;

  return (
    <div className="task-fact-box collection-facts collection-task-facts">
      <div className="collection-fact collection-fact-amount">
        <span>AMOUNT</span>
        <strong>
          {snapshot.loading && !stored.amount ? "FETCHING..." : money(amount)}
        </strong>
        {includeStatus && task.status === "PROMISED" && (
          <small className="collection-fact-detail">
            <span>PROMISED</span>
            <em>{money(task.collectionAmount)}</em>
          </small>
        )}
      </div>
      <div className="collection-fact collection-fact-date">
        <span>DUE DATE</span>
        <strong>{shortDate(dueDate)}</strong>
        {includeStatus && task.status === "PROMISED" && (
          <small className="collection-fact-detail">
            <span>PROMISE DATE</span>
            <em>{shortDate(String(task.collectionPromiseDate || ""))}</em>
          </small>
        )}
      </div>
      <div className="collection-fact collection-fact-days">
        <span>DAYS DUE</span>
        <strong>{dayCount(dueDate)} DAYS</strong>
        {includeStatus && task.status === "UNREACHABLE" && (
          <small className="collection-fact-detail">
            <span>UNREACHABLE</span>
            <em>{task.unreachableDays || 1} DAYS</em>
          </small>
        )}
      </div>
    </div>
  );
}
