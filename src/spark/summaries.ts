import {
  collection,
  getDocs,
  query,
  where,
  limit,
  startAfter,
  orderBy,
  documentId,
  Timestamp,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { salesDb } from "../firebase";
import { modules, today, type Data, type Profile } from "../../shared/schema";
import { metrics } from "./performance";
export const virtualCollections = new Set([
  "staffPerformance",
  "businessPerformance",
  "campaignPerformance",
  "staffDailyWork",
  "staffWorkSummaries",
  "adminWorkSummaries",
]);
const cache = new Map<string, { at: number; promise: Promise<Data[]> }>();
export const clearSummaryCache = () => cache.clear();
async function scan(
  kind: string,
  p: Profile,
  filters: Array<[string, any, any]>,
): Promise<Data[]> {
  const key = JSON.stringify([p.uid, p.role, kind, filters]);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 60000) return cached.promise;
  const promise = (async () => {
    const rows: Data[] = [];
    let cursor: QueryDocumentSnapshot | undefined;
    for (let page = 0; page < 20; page++) {
      const constraints: QueryConstraint[] = filters.map((f) => where(...f));
      if (p.role === "Staff")
        constraints.push(where("assignedStaffId", "==", p.uid));
      if (filters.some((f) => f[0] === "createdOn"))
        constraints.push(orderBy("createdOn"));
      constraints.push(orderBy(documentId()), limit(100));
      if (cursor) constraints.push(startAfter(cursor));
      const snap = await getDocs(
        query(collection(salesDb, kind), ...constraints),
      );
      rows.push(...snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      if (snap.size < 100) return rows;
      cursor = snap.docs.at(-1);
    }
    throw new Error(
      "This report exceeds 2,000 records per workflow. Narrow the reporting period; no partial total is shown.",
    );
  })();
  cache.set(key, { at: Date.now(), promise });
  try {
    return await promise;
  } catch (e) {
    cache.delete(key);
    throw e;
  }
}
export async function summaryRows(
  name: string,
  p: Profile,
  filters: Array<[string, any, any]> = [],
  id?: string,
): Promise<Data[]> {
  if (
    p.role !== "Admin" &&
    [
      "businessPerformance",
      "adminWorkSummaries",
      "campaignPerformance",
    ].includes(name)
  )
    throw new Error("Admin access required");
  const month =
    filters.find((f) => f[0] === "month")?.[2] ||
    (name === "businessPerformance" ? id : today().slice(0, 7));
  const day = filters.find((f) => f[0] === "day")?.[2] || today();
  const groups = new Map<string, Data>();
  const add = (
    owner: string,
    staffName: string,
    counts: Record<string, number>,
  ) => {
    const key = [
      "businessPerformance",
      "adminWorkSummaries",
      "campaignPerformance",
    ].includes(name)
      ? id || "company"
      : owner;
    const g = groups.get(key) || {
      id: key,
      staffId: owner,
      staffName,
      month,
      day,
      counts: {},
    };
    for (const [k, v] of Object.entries(counts))
      g.counts[k] = (g.counts[k] || 0) + v;
    groups.set(key, g);
  };
  if (name.includes("Work") || name === "staffDailyWork") {
    const rows = await scan("tasks", p, [
      ["status", "in", ["PENDING", "IN_PROGRESS", "OVERDUE"]],
    ]);
    for (const d of rows) {
      if (name === "staffDailyWork" && d.dueDate !== day) continue;
      const overdue = d.dueDate < today(),
        source = d.sourceType || "ADMIN";
      add(d.assignedStaffId, d.assignedStaffName, {
        openTasks: 1,
        overdueTasks: overdue ? 1 : 0,
        [`source_${source}`]: 1,
        [`overdue_${source}`]: overdue ? 1 : 0,
      });
    }
  } else {
    const [year, m] = String(month).split("-").map(Number);
    const low = Timestamp.fromDate(
      new Date(Date.UTC(year, m - 1, 1) - 19800000),
    );
    const high = Timestamp.fromDate(new Date(Date.UTC(year, m, 1) - 19800000));
    const kinds =
      name === "campaignPerformance"
        ? ["campaignAssignments", "objections"]
        : Object.keys(modules).filter((k) => !modules[k].adminOnly);
    // Sequential collection scans avoid a burst of reads on Spark.
    for (const kind of kinds) {
      const q: Array<[string, any, any]> =
        name === "campaignPerformance"
          ? [["campaignId", "==", id]]
          : [
              ["createdOn", ">=", low],
              ["createdOn", "<", high],
            ];
      for (const d of await scan(kind, p, q)) {
        const normalized =
          kind === "tasks" &&
          !["COMPLETED", "SKIPPED", "CANCELLED"].includes(d.status) &&
          d.dueDate < today()
            ? { ...d, status: "OVERDUE" }
            : d;
        add(
          d.assignedStaffId,
          d.assignedStaffName || d.assignedStaffId,
          metrics(kind, normalized),
        );
      }
    }
  }
  return [...groups.values()];
}
