import { useState } from "react";
import { useAuth, useRows } from "../hooks";
import { RecordEditor } from "../components/RecordEditor";
import { Header, Panel, ErrorBox, PageEnd, Badge, money } from "../components/ui";
import { type Row } from "../services/sales";
import { collectionDue } from "../../shared/collections";
import { today } from "../../shared/schema";
import { AutoCollections } from "../components/AutoCollections";
export default function ManagerHome() {
 const {profile,logout}=useAuth();
 const tasks=useRows("tasks");
 const team=useRows("users");
 const customers=useRows("collectionSnapshots");
 const [edit,setEdit]=useState<Row | null | undefined>();
 const [tab,setTab]=useState("tasks");
 return <main><AutoCollections /><Header eyebrow={`${profile?.branchId} ? BRANCH MANAGER`} title="Branch workspace" description="Assign work, delegate your tasks, and check collections for your branch." actions={<button className="secondary" onClick={logout}>Sign out</button>} />
 <div className="toolbar"><button onClick={()=>setTab("tasks")}>Branch tasks</button><button onClick={()=>setTab("collections")}>Collections</button><button onClick={()=>setTab("team")}>Branch Staff</button><button onClick={()=>setEdit(null)}>Assign task</button></div>
 <ErrorBox message={tasks.error || team.error || customers.error}/>
 {tab === "tasks" && <Panel title="Branch tasks"><div className="record-list">{tasks.rows.map(task=><article className="record-card" key={task.id}><div><Badge value={task.status}/><h3>{task.title}</h3><p>{task.assignedStaffName} ? Due {task.dueDate}</p><p>{task.notes}</p></div>{task.sourceType === "ADMIN" && <button onClick={()=>setEdit(task)}>Update / delegate</button>}</article>)}</div><PageEnd state={tasks}/></Panel>}
 {tab === "collections" && <Panel title="Past due date + buffer days">{customers.rows.map(customer=>({customer,due:collectionDue(customer.invoices || [],today())})).filter(row=>row.due.amount>0).map(({customer,due})=><article className="record-card" key={customer.id}><div><h3>{customer.name}</h3><p>{money(due.amount)} overdue ? {due.invoices.length} invoice(s)</p><p>Assigned Staff: {team.rows.find(row=>row.id===customer.assignedStaffId)?.name || customer.assignedStaffId || "Not assigned"}</p></div></article>)}<PageEnd state={customers}/></Panel>}
 {tab === "team" && <Panel title="Branch Staff">{team.rows.map(staff=><article className="record-card" key={staff.id}><div><h3>{staff.name}</h3><p>{staff.email} ? {staff.active ? "Active" : "Disabled"}</p></div></article>)}<PageEnd state={team}/></Panel>}
 {edit !== undefined && <RecordEditor kind="tasks" record={edit || undefined} preset={edit ? {} : {assignedStaffId:profile!.uid}} onClose={()=>setEdit(undefined)} onSaved={tasks.reload}/>}
 </main>;
}
