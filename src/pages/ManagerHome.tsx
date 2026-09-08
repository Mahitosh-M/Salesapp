import { useState } from "react";
import { useAuth, useRows } from "../hooks";
import { RecordEditor } from "../components/RecordEditor";
import { Header, Panel, ErrorBox, PageEnd, Badge, money } from "../components/ui";
import { type Row } from "../services/sales";
import { collectionDue } from "../../shared/collections";
import { today } from "../../shared/schema";
export default function ManagerHome() {
 const {profile,logout}=useAuth();
 const tasks=useRows("tasks");
 const team=useRows("users");
 const customers=useRows("collectionSnapshots");
 const staffCustomers=useRows("staffCustomers");
 const [edit,setEdit]=useState<Row | null | undefined>();
 const [tab,setTab]=useState("tasks");
 const followups=tasks.rows.filter((task)=>task.sourceType === "followUps");
 return <main><Header eyebrow={`${profile?.branchId} ? BRANCH MANAGER`} title="Branch workspace" description="Assign work, delegate your tasks, and check collections for your branch." actions={<button className="secondary" onClick={logout}>Sign out</button>} />
 <div className="toolbar"><button onClick={()=>setTab("tasks")}>Branch tasks</button><button onClick={()=>setTab("followups")}>Follow-ups</button><button onClick={()=>setTab("collections")}>Collections</button><button onClick={()=>setTab("team")}>Branch Staff</button><button onClick={()=>setEdit(null)}>Assign task</button></div>
 <ErrorBox message={tasks.error || team.error || customers.error || staffCustomers.error}/>
 {tab === "tasks" && <Panel title="Branch tasks"><div className="record-list">{tasks.rows.map(task=><article className="record-card" key={task.id}><div><Badge value={task.status}/><h3>{task.title}</h3><p>{task.assignedStaffName} ? Due {task.dueDate}</p><p>{task.staffNote || task.notes}</p></div>{task.sourceType === "ADMIN" && <button onClick={()=>setEdit(task)}>Update / delegate</button>}</article>)}</div><PageEnd state={tasks}/></Panel>}
 {tab === "followups" && <Panel title="Branch follow-ups"><div className="record-list">{followups.map(row=><article className={`record-card followup-card status-${String(row.status||"").toLowerCase()}`} key={row.id}><h3>{row.title}</h3><p className="followup-highlight last-order-highlight">Last order: {(() => { const c=staffCustomers.rows.find(x=>x.id===row.customerId); return c?.lastOrderDate ? `${Math.max(0,Math.floor((Date.parse(today()+"T00:00:00Z")-Date.parse(String(c.lastOrderDate)+"T00:00:00Z"))/86400000))} days` : "unknown"; })()}</p><Badge value={row.status}/>{row.staffNote || row.notes ? <p>{row.staffNote || row.notes}</p> : null}</article>)}</div><PageEnd state={tasks}/></Panel>}
 {tab === "collections" && <Panel title="Past due date + buffer days">{customers.rows.map(customer=>({customer,due:collectionDue(customer.invoices || [],today())})).filter(row=>row.due.amount>0).map(({customer,due})=><article className="record-card" key={customer.id}><div><h3>{customer.name}</h3><p>{money(due.amount)} overdue ? {due.invoices.length} invoice(s)</p><p>Assigned Staff: {team.rows.find(row=>row.id===customer.assignedStaffId)?.name || customer.assignedStaffId || "Not assigned"}</p></div></article>)}<PageEnd state={customers}/></Panel>}
 {tab === "team" && <Panel title="Branch Staff">{team.rows.map(staff=><article className="record-card" key={staff.id}><div><h3>{staff.name}</h3><p>{staff.email} ? {staff.active ? "Active" : "Disabled"}</p></div></article>)}<PageEnd state={team}/></Panel>}
 {edit !== undefined && <RecordEditor kind="tasks" record={edit || undefined} preset={edit ? {} : {assignedStaffId:profile!.uid}} onClose={()=>setEdit(undefined)} onSaved={tasks.reload}/>}
 </main>;
}
