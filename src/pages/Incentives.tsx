import { useState } from "react";
import { useRows } from "../hooks";
import { Header, Panel, Empty, ErrorBox, Modal, money } from "../components/ui";
import { Picker } from "../components/RecordEditor";
import { command, clearCache } from "../services/sales";
import { today } from "../../shared/schema";

export default function Incentives() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [open, setOpen] = useState(false);
  const plans = useRows("incentivePlans", [["month", "==", month]]);
  const progress = useRows("staffIncentiveProgress", [["month", "==", month]]);
  return <><Header eyebrow="REWARD PAID SALES" title="Monthly incentives" description="An incentive starts after the minimum sales target is achieved. It is released only when the credited invoice is paid." actions={<button onClick={() => setOpen(true)}>Create incentive plan</button>} />
    <div className="toolbar"><label>Month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label></div>
    <Panel title="Plans"><ErrorBox message={plans.error} />{plans.rows.map((p) => <article className="target-card" key={p.id}><h3>{p.staffName}</h3><p>Minimum target: <b>{money(p.minimumTarget)}</b></p><p>{(p.slabs || []).map((s: any) => `From ${money(s.from)}: ${s.percentage}% of profit`).join(" · ")}</p></article>)}{!plans.loading && !plans.rows.length && <Empty title="No incentive plans" text="Create a plan for a Staff member and month." />}</Panel>
    <Panel title="Locked and released"><ErrorBox message={progress.error} />{progress.rows.map((p) => <article className="target-card" key={p.id}><h3>{p.staffName}</h3><div className="metrics-grid"><div><small>Sales achieved</small><b>{money(p.achieved)}</b></div><div><small>Locked incentive</small><b>{money(p.locked)}</b></div><div><small>Released after payment</small><b>{money(p.released)}</b></div><div><small>Waiting for payment</small><b>{money(p.awaitingPayment)}</b></div></div><p>{p.eligible ? `${p.activePercentage}% profit slab is active.` : "The minimum target is not achieved yet."}</p></article>)}{!progress.loading && !progress.rows.length && <Empty title="No calculated incentive" text="Set the plan and let the CISapp invoice sync run." />}</Panel>
    {open && <PlanForm month={month} onClose={() => setOpen(false)} />}</>;
}
function PlanForm({ month, onClose }: { month: string; onClose: () => void }) {
  const [staffId, setStaffId] = useState(""); const [minimumTarget, setMinimumTarget] = useState(""); const [firstFrom, setFirstFrom] = useState(""); const [firstRate, setFirstRate] = useState(""); const [nextFrom, setNextFrom] = useState(""); const [nextRate, setNextRate] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <Modal title={`Incentive plan · ${month}`} onClose={onClose}><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { const slabs = [{ from: Number(firstFrom || minimumTarget), percentage: Number(firstRate) }]; if (nextFrom || nextRate) slabs.push({ from: Number(nextFrom), percentage: Number(nextRate) }); await command("saveIncentivePlan", { staffId, month, minimumTarget: Number(minimumTarget), slabs }); clearCache(); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><ErrorBox message={error} /><label>Staff<Picker kind="staff" value={staffId} onChange={setStaffId} /></label><label>Minimum monthly sales target<input required type="number" min="1" value={minimumTarget} onChange={(e) => setMinimumTarget(e.target.value)} /></label><label>First slab starts at<input required type="number" min="0" value={firstFrom} placeholder="Usually the minimum target" onChange={(e) => setFirstFrom(e.target.value)} /></label><label>First slab profit percentage<input required type="number" min="0" max="100" step="0.01" value={firstRate} onChange={(e) => setFirstRate(e.target.value)} /></label><label>Next slab starts at (optional)<input type="number" min="0" value={nextFrom} onChange={(e) => setNextFrom(e.target.value)} /></label><label>Next slab profit percentage (optional)<input type="number" min="0" max="100" step="0.01" value={nextRate} onChange={(e) => setNextRate(e.target.value)} /></label><button disabled={busy}>{busy ? "Saving…" : "Save plan"}</button></form></Modal>;
}
