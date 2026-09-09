import { Message } from "./Customers";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Plus, Search, ArrowUpRight, RefreshCw } from "lucide-react";
import { modules, label, today } from "../../shared/schema";
import { useAuth, useRows } from "../hooks";
import { RecordEditor } from "../components/RecordEditor";
import {
  Header,
  Badge,
  Empty,
  ErrorBox,
  Loading,
  PageEnd,
  when,
  money,
} from "../components/ui";
import { command, readOne, type Row } from "../services/sales";
const dayCount = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? Math.max(0, Math.floor((Date.parse(today()+"T00:00:00Z")-Date.parse(date+"T00:00:00Z"))/86400000)) : 0;
const shortDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date+"T00:00:00Z").toLocaleDateString("en-IN",{day:"2-digit",month:"short"}).toUpperCase() : date;
export default function Workflows() {
  const { kind = "tasks" } = useParams();
  return <Workflow key={kind} kind={kind} />;
}
function Workflow({ kind }: { kind: string }) {
  const [params] = useSearchParams();
  const [messageRecord, setMessageRecord] = useState<Row | null>(null);
  const spec = modules[kind];
  const { profile } = useAuth();
  const state = useRows(kind);
  const customers = useRows("staffCustomers", [["active", "==", true]]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [edit, setEdit] = useState<Row | null | undefined>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const recordId = params.get("record");
    if (recordId)
      readOne(kind, recordId)
        .then((r) => r && setEdit(r))
        .catch((e) => setError(e.message));
  }, [kind, params]);
  if (!spec) return <Empty title="Page not found" />;
  if (spec.adminOnly && profile?.role !== "Admin")
    return <Empty title="Admin access required" />;
  const rows = state.rows.filter(
    (r) =>
      (status === "ALL" || r.status === status) &&
      !(kind === "collectionPromises" && profile?.role === "Staff" && r.status === "PAID") && !(kind === "tasks" && profile?.role === "Staff" && String(r.title || "").startsWith("Collect ") && r.status === "PAID") &&
      !(kind === "visits" && String(r.id || "").startsWith("auto10_")) &&
      [r.title, r.notes, r.product, r.phone]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function assign(r: Row) {
    setBusy(true);
    setError("");
    try {
      const result = await command("assignCampaignPage", { campaignId: r.id });
      setMessage(
        `${result.assigned || 0} contacts assigned. ${result.done ? "Audience complete." : "Select Assign next page to continue."}`,
      );
      state.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header
        eyebrow="YOUR WORKSPACE"
        title={spec.label}
        description={spec.description}
        actions={
          <>
            {profile?.role === "Admin" && kind === "tasks" && (
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    const r = await command("refreshOverdue", {});
                    setMessage(
                      `${r.processed} overdue tasks refreshed.${r.hasMore ? " Refresh again for the next batch." : ""}`,
                    );
                    state.reload();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <RefreshCw size={16} />
                Refresh overdue
              </button>
            )}
            {!(kind === "campaignAssignments" && profile?.role === "Staff") && (
              <button onClick={() => setEdit(null)}>
                <Plus size={18} />
                New {spec.singular.toLowerCase()}
              </button>
            )}
          </>
        }
      />
      <ErrorBox message={state.error || error} />
      {message && <div className="success">{message}</div>}
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search loaded records"
            placeholder="Search loaded records…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          {spec.statuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <span className="subtle">{rows.length} shown</span>
      </div>
      {state.loading && !state.rows.length ? (
        <Loading />
      ) : !rows.length ? (
        <Empty
          title={`No ${spec.label.toLowerCase()} to show`}
          text="Create a record or adjust your filters to get started."
        />
      ) : (
        <div className="record-list">
          {rows.map((r) => (
            <article className={`record-card ${(kind === "followUps" || (kind === "tasks" && String(r.title || "").startsWith("Collect "))) ? `followup-card status-${String(r.status || "").toLowerCase()}` : ""}`} key={r.id}>
              <div className="record-main">
                <div className="row-between">
                  <Badge value={r.priority || "NORMAL"} />
                  <small>
                    {r.dueDate
                      ? `${r.dueDate < today() ? "Due / overdue" : "Due"} ${r.dueDate}`
                      : when(r.createdAt)}
                  </small>
                </div>
                <h3>{r.title}</h3>
                {kind === "tasks" && String(r.title || "").startsWith("Collect ") && (() => { const amount=Number(String(r.notes||"").match(/Combined unpaid amount ([0-9.]+)/)?.[1] || 0); const due=String(r.notes||"").match(/Due dates: ([0-9-]+)/)?.[1] || String(r.dueDate||""); return <div className="task-fact-box collection-facts"><b>AMOUNT: {money(amount)}</b><b>DUE: {shortDate(due)}</b><b>DAYS: {dayCount(due)} DAYS</b></div>; })()}
                {kind === "tasks" && r.sourceType === "followUps" && (() => { const c=customers.rows.find(x=>x.id===r.customerId); const days=c?.lastOrderDate ? dayCount(String(c.lastOrderDate)) : null; return <div className="task-fact-box followup-fact"><b>LAST ORDER: {days === null ? "UNKNOWN" : `${days} DAYS`}</b></div>; })()}
                {kind === "collectionPromises" && r.status === "UNREACHABLE" && <small>DAYS UNREACHABLE: {r.unreachableDays || 1}</small>}
                {kind === "tasks" && String(r.title || "").startsWith("Collect ") && r.status === "UNREACHABLE" && <small className="last-order-highlight">DAYS UNREACHABLE: {r.unreachableDays || 1}</small>}
                {kind === "tasks" && String(r.title || "").startsWith("Collect ") && r.status === "PROMISED" && <small className="last-order-highlight">Promised: {r.collectionAmount || ""} by {r.collectionPromiseDate || ""}</small>}
                {kind === "tasks" && String(r.title || "").startsWith("Collect ") && r.status === "PROMISED" && r.collectionPromiseDate && r.collectionPromiseDate < today() && <small className="last-order-highlight">PROMISE OVERDUE: {Math.floor((Date.parse(today()+"T00:00:00Z") - Date.parse(String(r.collectionPromiseDate)+"T00:00:00Z"))/86400000)} days</small>}
                {kind === "followUps" && r.customerId && (() => { const c = customers.rows.find((x) => x.id === r.customerId); const days = c?.lastOrderDate ? Math.max(0, Math.floor((Date.parse(today()+"T00:00:00Z") - Date.parse(String(c.lastOrderDate)+"T00:00:00Z"))/86400000)) : null; return <small className="last-order-highlight">Last order: {days === null ? "unknown" : `${days} days`}{r.unreachableDays ? ` ? DAYS UNREACHABLE: ${r.unreachableDays}` : ""}</small>; })()}
                <p>
                  {kind === "followUps"
                    ? (r.notes && !String(r.notes).startsWith("Automatically created") ? r.notes : "")
                    : kind === "tasks" && String(r.title || "").startsWith("Collect ")
                    ? `Combined amount to collect: ${String(r.notes || "").match(/Combined unpaid amount ([0-9.]+)/)?.[1] || "check Collections"}${r.staffNote ? ` · Staff message: ${r.staffNote}` : ""}`
                    : r.product || r.objective || (kind === "tasks" ? r.staffNote || "" : r.notes) || "Keep the next step clear."}
                </p>
                <div className="record-meta">
                  <Badge value={r.status} />
                  {r.customerId && (
                    <Link to={`/customers/${r.customerId}`}>
                      View customer <ArrowUpRight size={13} />
                    </Link>
                  )}
                  {r.nextFollowUp && <span>Next: {r.nextFollowUp}</span>}
                </div>
              </div>
              <div className="record-actions">
                {kind === "leads" && r.phone && (
                  <>
                    <a
                      className="button secondary"
                      href={`tel:${String(r.phone).replace(/[^+\d]/g, "")}`}
                    >
                      Call
                    </a>
                    <button
                      className="secondary"
                      onClick={() => setMessageRecord({ ...r, name: r.title })}
                    >
                      WhatsApp
                    </button>
                  </>
                )}
                {kind === "tasks" &&
                  modules[r.sourceType] &&
                  r.sourceType !== "tasks" && (
                    <Link
                      className="button secondary"
                      to={`/work/${r.sourceType}?record=${encodeURIComponent(r.sourceId)}`}
                    >
                      Open original
                    </Link>
                  )}
                {!(kind === "activities" && profile?.role === "Staff") && (
                  <button className="secondary" onClick={() => setEdit(r)}>
                    {profile?.role === "Staff" && r.createdBy !== profile.uid
                      ? "Next action"
                      : "Update"}
                  </button>
                )}
                {kind === "campaigns" &&
                  r.status === "ACTIVE" &&
                  !r.assignmentDone && (
                    <button disabled={busy} onClick={() => assign(r)}>
                      Assign next page
                    </button>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}
      <PageEnd state={state} />
      {messageRecord && (
        <Message
          customer={messageRecord}
          collection={null}
          onClose={() => setMessageRecord(null)}
        />
      )}
      {edit !== undefined && (
        <RecordEditor
          kind={kind}
          record={edit || undefined}
          onClose={() => setEdit(undefined)}
          onSaved={state.reload}
        />
      )}
    </>
  );
}
