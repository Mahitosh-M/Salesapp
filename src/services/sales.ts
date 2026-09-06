import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";

import { salesDb } from "../firebase";
import {
  virtualCollections,
  summaryRows,
  clearSummaryCache,
} from "../spark/summaries";
import { actor } from "../spark/db";
import type { Data, Profile } from "../../shared/schema";
export type Row = Data & { id: string };
export const command = async <T = Data>(
  name: string,
  data: Data,
): Promise<T> => {
  const commands = await import("../spark/commands");
  const fn = commands[name as keyof typeof commands];
  if (typeof fn !== "function") throw new Error("Unknown action");
  const result = await fn({ data });
  clearCache();
  if (
    name === "assignCustomer" ||
    (name === "synchronizeCisapp" &&
      !result.runId &&
      result.status === "SUCCESS")
  )
    window.dispatchEvent(new Event("salesapp:sync-complete"));
  return result as T;
};
const cache = new Map<string, { at: number; value: any }>();
export const clearCache = () => {
  cache.clear();
  clearSummaryCache();
};
export async function readOne(name: string, id: string) {
  if (virtualCollections.has(name)) {
    const p = await actor(null);
    const rows = await summaryRows(name, p, [], id);
    return (rows[0] as Row) || null;
  }
  const s = await getDoc(doc(salesDb, name, id));
  return s.exists() ? ({ ...s.data(), id: s.id } as Row) : null;
}
export type Filter = [string, "==" | "in" | ">=" | "<=" | "<" | ">", any];
export async function page(
  name: string,
  p: Profile,
  filters: Filter[] = [],
  cursor?: any,
  sort?: [string, "asc" | "desc"],
) {
  if (virtualCollections.has(name)) {
    const rows = await summaryRows(name, p, filters);
    const offset = cursor?.offset || 0;
    return {
      rows: rows.slice(offset, offset + 25) as Row[],
      cursor: { offset: offset + 25 },
      hasMore: rows.length > offset + 25,
    };
  }
  const c: QueryConstraint[] = [];
  if (p.role === "Staff") {
    if (["staffCustomers", "collectionSnapshots"].includes(name))
      c.push(
        where("assignedStaffId", "==", p.uid),
        where("active", "==", true),
      );
    else if (
      [
        "staffPerformance",
        "staffTargetProgress",
        "staffWorkSummaries",
        "staffDailyWork",
      ].includes(name)
    )
      c.push(where("staffId", "==", p.uid));
    else if (name === "messageTemplates")
      c.push(where("status", "==", "APPROVED"));
    else c.push(where("assignedStaffId", "==", p.uid));
  }
  filters.forEach((f) => c.push(where(...f)));
  if (sort) c.push(orderBy(...sort));
  if (cursor) c.push(startAfter(cursor));
  c.push(limit(25));
  const key = JSON.stringify([p.uid, p.role, name, filters, sort]);
  if (!cursor && cache.has(key) && Date.now() - cache.get(key)!.at < 30000)
    return cache.get(key)!.value;
  const snap = await getDocs(query(collection(salesDb, name), ...c));
  const result = {
    rows: snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Row),
    cursor: snap.docs.at(-1),
    hasMore: snap.size === 25,
  };
  if (!cursor) cache.set(key, { at: Date.now(), value: result });
  return result;
}
