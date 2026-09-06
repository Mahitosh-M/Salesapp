import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useRows } from "../hooks";
import {
  Header,
  ErrorBox,
  Loading,
  Empty,
  PageEnd,
  money,
  when,
  Badge,
} from "../components/ui";
import { RecordEditor } from "../components/RecordEditor";
import { command, type Row } from "../services/sales";
export default function Collections() {
  const { profile } = useAuth();
  const state = useRows("collectionSnapshots", [["outstandingAmount", ">", 0]]);
  const [record, setRecord] = useState<Row | null>(null);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = state.rows.filter((r) => !onlyOverdue || r.overdueAmount > 0);
  return (
    <>
      <Header
        eyebrow="COLLECTIONS"
        title="Follow through on commitments"
        description="The collection information your team needs, with the latest available source values."
        actions={
          profile?.role === "Admin" ? (
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await command("generateCollectionActions", {
                    cursor,
                  });
                  setCursor(result.done ? null : result.cursor);
                  setMessage(
                    `${result.created} tasks created. ${result.done ? "Customer pass complete." : "Select again for the next page."}`,
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {cursor
                ? "Generate next page of tasks"
                : "Generate collection tasks"}
            </button>
          ) : null
        }
      />
      <div className="toolbar">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
          />
          Overdue only (loaded records)
        </label>
        <Link className="text-button" to="/work/collectionPromises">
          Payment promises →
        </Link>
      </div>
      <ErrorBox message={state.error || error} />
      {message && <div className="success">{message}</div>}
      {state.loading && !state.rows.length ? (
        <Loading />
      ) : rows.length ? (
        <div className="record-list">
          {rows.map((r) => (
            <article className="record-card" key={r.id}>
              <div className="record-main">
                <Link to={`/customers/${r.id}`}>
                  <h3>{r.name}</h3>
                </Link>
                <div className="collection-numbers compact">
                  <div>
                    <span>Outstanding</span>
                    <strong>{money(r.outstandingAmount)}</strong>
                  </div>
                  <div>
                    <span>Overdue</span>
                    <strong className="danger-text">
                      {money(r.overdueAmount)}
                    </strong>
                  </div>
                </div>
                <small>
                  Updated {when(r.syncedAt)} · Source balance{" "}
                  {when(r.financialSourceUpdatedAt)}
                </small>
              </div>
              <button className="secondary" onClick={() => setRecord(r)}>
                Record promise
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="No collections to show"
          text="Collection snapshots appear after your Admin imports and assigns customers."
        />
      )}
      <PageEnd state={state} />
      {record && (
        <RecordEditor
          kind="collectionPromises"
          preset={{
            customerId: record.id,
            assignedStaffId: record.assignedStaffId || profile!.uid,
            title: `Payment promise · ${record.name}`,
          }}
          onClose={() => setRecord(null)}
          onSaved={() => {}}
        />
      )}
    </>
  );
}
