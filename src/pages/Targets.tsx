import { useState } from "react";
import { useAuth, useLiveDocument, useRows } from "../hooks";
import { BadgeCheck, CircleOff, ReceiptText } from "lucide-react";
import {
  Header,
  Metric,
  Panel,
  ErrorBox,
  Empty,
  Modal,
  PageEnd,
  money,
  Badge,
} from "../components/ui";
import { Picker } from "../components/RecordEditor";
import { command, clearCache } from "../services/sales";
import { branchIds, today, targetMetrics, label } from "../../shared/schema";
export default function Targets() {
  const { profile } = useAuth();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [edit, setEdit] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <>
      <Header
        eyebrow="A SHARED DIRECTION"
        title={profile?.role === "Admin" ? "Monthly targets" : "My target"}
        description="Focus on progress and the pace needed to get there."
        actions={
          profile?.role === "Admin" ? (
            <button onClick={() => setEdit(true)}>Set target</button>
          ) : null
        }
      />
      <div className="toolbar">
        <label>
          Target month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>
      <TargetRows key={`${month}_${revision}`} month={month} />
      {edit && (
        <TargetForm
          month={month}
          onClose={() => setEdit(false)}
          onSaved={() => {
            clearCache();
            setRevision((r) => r + 1);
          }}
        />
      )}
    </>
  );
}
function TargetRows({ month }: { month: string }) {
  const { profile } = useAuth();
  return (
    <>
      {profile?.role === "Admin" && (
        <>
          <TargetGroup
            name="businessTargetProgress"
            title="Company"
            month={month}
          />
          <TargetGroup
            name="branchTargetProgress"
            title="Branches"
            month={month}
          />
        </>
      )}
      <Panel
        title={profile?.role === "Admin" ? "Staff targets" : "Your progress"}
      >
        {profile?.role === "Admin" ? (
          <AdminStaffTargets month={month} />
        ) : (
          <LiveStaffTarget month={month} />
        )}
      </Panel>
      <AttributedOrders month={month} />
    </>
  );
}
function AdminStaffTargets({ month }: { month: string }) {
  const staff = useRows("staffTargetProgress", [["month", "==", month]]);
  return (
    <>
      <ErrorBox message={staff.error} />
      {staff.rows.map((target) => <TargetCard key={target.id} row={target} />)}
      {!staff.loading && !staff.rows.length && <Empty title="No Staff targets" text="Set a monthly target for a Staff account." />}
      <PageEnd state={staff} />
    </>
  );
}
function LiveStaffTarget({ month }: { month: string }) {
  const { profile } = useAuth();
  const target = useLiveDocument(
    "staffTargetProgress",
    `${profile?.uid || "missing"}_${month}`,
  );
  return (
    <>
      <ErrorBox message={target.error} />
      {target.row ? <TargetCard row={target.row} /> : !target.loading ? (
        <Empty title="No target set for this month" text="Ask your Admin to set your monthly target." />
      ) : null}
      <p className="target-live-note"><span /> Live progress updates as verified orders are credited.</p>
    </>
  );
}
function AttributedOrders({ month }: { month: string }) {
  const { profile } = useAuth();
  const orders = useRows("staffSalesOrders", [["month", "==", month]]);
  const rows = [...orders.rows].sort((a, b) =>
    String(b.orderDate).localeCompare(String(a.orderDate)),
  );
  return (
    <Panel title={profile?.role === "Admin" ? "Order attribution" : "Orders credited to you"}>
      <p className="notice">
        A Staff target increases only when a real CISapp invoice matches an
        ORDERED result saved by that Staff member. Direct customer orders stay
        visible to Admin but do not increase a Staff target.
      </p>
      <ErrorBox message={orders.error} />
      <div className="order-credit-list">
        {rows.map((order) => {
          const credited = order.attributionStatus === "STAFF_CREDITED";
          return (
            <article className={`order-credit ${credited ? "credited" : "direct"}`} key={order.id}>
              <span className="order-credit-icon">{credited ? <BadgeCheck size={19} /> : <CircleOff size={19} />}</span>
              <div>
                <b>{order.invoiceNumber} · {order.customerName}</b>
                <span>{order.orderDate} · {money(order.amount)}</span>
                <small>{credited ? `Credited to ${order.assignedStaffName || order.assignedStaffId} from ${label(order.sourceActionType || "work")} ${order.sourceActionId || ""}` : "Direct customer order · no Staff target credit"}</small>
              </div>
              <ReceiptText size={18} />
            </article>
          );
        })}
      </div>
      {!orders.loading && !rows.length && <Empty title="No synced orders for this month" text="Orders appear after the daily CISapp sync." />}
      <PageEnd state={orders} />
    </Panel>
  );
}
function TargetGroup({
  name,
  title,
  month,
}: {
  name: string;
  title: string;
  month: string;
}) {
  const rows = useRows(name, [["month", "==", month]]);
  return (
    <Panel title={title}>
      <ErrorBox message={rows.error} />
      {rows.rows.map((t) => (
        <TargetCard key={t.id} row={t} />
      ))}
      {!rows.rows.length && <p className="subtle">No target configured.</p>}
      <PageEnd state={rows} />
    </Panel>
  );
}
function TargetCard({ row: t }: { row: any }) {
  const { profile } = useAuth();
  const metrics = targetMetrics(t.target, t.achieved, t.month);
  return (
    <article className="target-card">
      <div className="row-between">
        <h3>
          {t.branchId ||
            (profile?.role === "Admin" ? t.staffName || t.staffId : "") ||
            t.month}
        </h3>
        <Badge value={metrics.paceStatus} />
      </div>
      <div className="metrics-grid">
        <Metric label="Target" value={money(t.target)} />
        <Metric label="Achieved" value={money(t.achieved)} accent />
        <Metric label="Remaining" value={money(metrics.remaining)} />
        <Metric label="Days remaining" value={metrics.daysRemaining} />
      </div>
      {t.staffId && <p className="credited-count"><BadgeCheck size={15} /> {t.creditedOrderCount || 0} verified Staff orders credited</p>}
      <div className="progress-bar">
        <span
          style={{
            width: `${Math.min(100, Math.max(0, metrics.percentage || 0))}%`,
          }}
        />
      </div>
      <p>
        {metrics.percentage === null
          ? "Achievement unavailable"
          : `${metrics.percentage}% achieved`}
      </p>
      {profile?.role === "Admin" && <p className="subtle">{t.basis}</p>}
    </article>
  );
}
function TargetForm({
  month,
  onClose,
  onSaved,
}: {
  month: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scope, setScope] = useState("STAFF");
  const [subject, setSubject] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Set target Â· ${month}`} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await command("saveTarget", {
              scope,
              subjectId: subject,
              month,
              target: Number(target),
            });
            onSaved();
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ErrorBox message={error} />
        <label>
          Target level
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setSubject("");
            }}
          >
            {["STAFF", "BRANCH", "BUSINESS"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {scope === "STAFF" ? (
          <label>
            Staff
            <Picker kind="staff" value={subject} onChange={setSubject} />
          </label>
        ) : scope === "BRANCH" ? (
          <label>
            Branch ID
            <select required value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Select a branch</option>
              {branchIds.map((branchId) => (
                <option key={branchId} value={branchId}>{branchId}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Monthly target (â‚¹)
          <input
            required
            type="number"
            min="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <p className="notice">
          Staff achievement counts only verified CISapp invoices matched to an
          ORDERED result saved by that Staff member. Direct orders do not add to
          a Staff target. Company and branch totals still include every eligible
          invoice.
        </p>
        <div className="form-footer">
          <button disabled={busy}>{busy ? "Savingâ€¦" : "Save target"}</button>
        </div>
      </form>
    </Modal>
  );
}



