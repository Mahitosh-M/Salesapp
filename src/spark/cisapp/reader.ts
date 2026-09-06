// This module is the ONLY Firestore network boundary for Project A.
// It deliberately has no Firebase Admin SDK, document references, or mutation API.
import { isTargetInvoice } from "./targetInvoice";
import { sourceNames, sourceSpecs } from "./mapper";
import type { Data } from "../../../shared/schema";
const PROJECT = "cisapp-236ab";
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
type Value = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  arrayValue?: { values?: Value[] };
  mapValue?: { fields?: Record<string, Value> };
  referenceValue?: string;
};
export function decode(v: Value): any {
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decode);
  if (v.mapValue) return decodeFields(v.mapValue.fields || {});
  return null;
}
function decodeFields(fields: Record<string, Value>): Data {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, decode(v)]),
  );
}
export type Cursor = { id: string; value?: string };
export type SourcePage = {
  rows: { id: string; data: Data }[];
  cursor: Cursor | null;
  done: boolean;
};
export function createCisappReader(
  token: string,
  transport: typeof fetch = fetch,
) {
  if (typeof token !== "string" || token.length < 30 || token.length > 10000)
    throw new Error("Connect an existing CISapp Admin account");
  async function read(path: string, query?: Data) {
    const response = await transport(ROOT + path, {
      method: query ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(query ? { body: JSON.stringify({ structuredQuery: query }) } : {}),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok)
      throw new Error(
        `CISapp read denied or unavailable (${response.status}). Reconnect the existing Admin account; no source changes were attempted.`,
      );
    return response.json();
  }
  return Object.freeze({
    async assertAdmin() {
      let claims: Data;
      try {
        claims = JSON.parse(
          atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
      } catch {
        throw new Error("Invalid CISapp session");
      }
      if (
        claims.aud !== PROJECT ||
        typeof claims.sub !== "string" ||
        !/^[-\w]+$/.test(claims.sub)
      )
        throw new Error("Wrong source project");
      // Firestore validates the ID token and existing CISapp rules authorize this GET.
      const response = await read(`/users/${claims.sub}`);
      const profile = decodeFields(response.fields || {});
      if (profile.role !== "Admin" || profile.active !== true)
        throw new Error("An active CISapp Admin account is required");
    },
    // Existing CISapp index: customerId ASC, date DESC. No source changes.
    async latestOrderPage(
      customerId: string,
      cursor: Cursor | null,
      asOf: string,
    ) {
      if (!/^[A-Za-z0-9_.-]{1,179}$/.test(customerId))
        throw new Error("Invalid customer identifier");
      const q: Data = {
        select: {
          fields: [
            "date",
            "invoiceType",
            "recordStatus",
            "status",
            "isOpeningBalance",
            "invoiceNumber",
          ].map((fieldPath) => ({ fieldPath })),
        },
        from: [{ collectionId: "invoices" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "customerId" },
                  op: "EQUAL",
                  value: { stringValue: customerId },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: "date" },
                  op: "LESS_THAN_OR_EQUAL",
                  value: { stringValue: asOf },
                },
              },
            ],
          },
        },
        orderBy: [
          { field: { fieldPath: "date" }, direction: "DESCENDING" },
          { field: { fieldPath: "__name__" }, direction: "DESCENDING" },
        ],
        limit: 1,
      };
      if (cursor)
        q.startAt = {
          values: [
            { stringValue: cursor.value },
            {
              referenceValue: `projects/${PROJECT}/databases/(default)/documents/invoices/${cursor.id}`,
            },
          ],
          before: false,
        };
      const response = await read(":runQuery", q);
      const row = (response as Data[]).find((r) => r.document)?.document;
      if (!row) return { date: null, cursor: null, done: true, read: 0 };
      const d = decodeFields(row.fields || {});
      if (isTargetInvoice(d) && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
        return { date: d.date as string, cursor: null, done: true, read: 1 };
      return {
        date: null,
        cursor: {
          id: String(row.name).split("/").pop()!,
          value: String(d.date),
        },
        done: false,
        read: 1,
      };
    },
    async page(
      name: string,
      field: string | null,
      cursor: Cursor | null,
      since: string | null,
      until: string,
      month?: string,
    ): Promise<SourcePage> {
      if (!sourceNames.includes(name as any) && !(name === "invoices" && month))
        throw new Error("Source collection is not allowed");
      if (
        field &&
        ![
          "updatedAt",
          "financialSummaryUpdatedAt",
          "calculatedAt",
          "date",
        ].includes(field)
      )
        throw new Error("Source timestamp is not allowed");
      const fields =
        name === "invoices"
          ? [
              "customerId",
              "totalSales",
              "date",
              "invoiceType",
              "recordStatus",
              "status",
              "isOpeningBalance",
              "invoiceNumber",
              "shopId",
              "branchSystemVersion",
            ]
          : sourceSpecs.find((s) => s.name === name)!.fields;
      const q: Data = {
        select: { fields: fields.map((fieldPath) => ({ fieldPath })) },
        from: [{ collectionId: name }],
        orderBy: [
          ...(field
            ? [{ field: { fieldPath: field }, direction: "ASCENDING" }]
            : []),
          { field: { fieldPath: "__name__" }, direction: "ASCENDING" },
        ],
        limit: 50,
      };
      if (field) {
        const lo = month ? `${month}-01` : since;
        const hi = month ? `${month}-31` : until;
        const filters = [
          ...(lo
            ? [
                {
                  fieldFilter: {
                    field: { fieldPath: field },
                    op: "GREATER_THAN_OR_EQUAL",
                    value: { stringValue: lo },
                  },
                },
              ]
            : []),
          {
            fieldFilter: {
              field: { fieldPath: field },
              op: "LESS_THAN_OR_EQUAL",
              value: { stringValue: hi },
            },
          },
        ];
        q.where = { compositeFilter: { op: "AND", filters } };
      }
      if (cursor)
        q.startAt = {
          values: [
            ...(field ? [{ stringValue: cursor.value }] : []),
            {
              referenceValue: `projects/${PROJECT}/databases/(default)/documents/${name}/${cursor.id}`,
            },
          ],
          before: false,
        };
      const response = await read(":runQuery", q);
      const rows = (response as Data[])
        .filter((r) => r.document)
        .map((r) => ({
          id: String(r.document.name).split("/").pop()!,
          data: decodeFields(r.document.fields || {}),
        }));
      const last = rows.at(-1);
      return {
        rows,
        cursor: last
          ? {
              id: last.id,
              ...(field ? { value: String(last.data[field]) } : {}),
            }
          : null,
        done: rows.length < 50,
      };
    },
  });
}
