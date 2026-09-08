import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useRows } from "../hooks";
import { Header, ErrorBox, Loading, Empty, PageEnd, money, when } from "../components/ui";
import { RecordEditor } from "../components/RecordEditor";
import { type Row } from "../services/sales";
import { collectionDue } from "../../shared/collections";
import { today } from "../../shared/schema";
export default function Collections() {
 const {profile}=useAuth();
 const state=useRows("collectionSnapshots",[["active","==",true]]);
 const [record,setRecord]=useState<Row|null>(null);
 const [date,setDate]=useState(today());
 useEffect(()=>{const timer=setInterval(()=>setDate(today()),60000);return()=>clearInterval(timer);},[]);
 const rows=state.rows.map((row): Row & {due: ReturnType<typeof collectionDue>}=>({...row,due:collectionDue(row.invoices||[],date)})).filter(row=>row.due.amount>0);
 return <><Header eyebrow="COLLECTIONS" title="Payments past their buffer date" description="Only unpaid invoice amounts past due date plus allocated buffer days appear here. Collection tasks are created automatically for the assigned branch Staff."/>
 <p className="notice">Example: due on 10 September with 3 buffer days ? collection starts on 14 September. Payments entered in CISapp reduce the amount after sync. Check this current amount before calling; mark the task completed after your work.</p>
 <Link className="text-button" to="/work/tasks">Open assigned tasks ?</Link>
 <ErrorBox message={state.error}/>
 {state.loading && !state.rows.length ? <Loading/> : <div className="record-list">{rows.map(row=><article className="record-card" key={row.id}><div className="record-main"><Link to={`/customers/${row.id}`}><h3>{row.name}</h3></Link><p>{row.area || row.branchId || ""} ? Assigned Staff: {row.assignedStaffName || row.assignedStaffId || "Awaiting assignment"}</p><div className="collection-numbers compact"><div><span>Due after buffer</span><strong className="danger-text">{money(row.due.amount)}</strong></div></div><details><summary>{row.due.invoices.length} unpaid invoice(s)</summary>{row.due.invoices.map(invoice=><p key={invoice.invoiceId}><b>{invoice.invoiceNumber}: {money(invoice.amount)}</b><br/>Due {invoice.dueDate} + {invoice.bufferDays} buffer days. Buffer ended {invoice.cutoffDate}.</p>)}</details><small>Invoice/payment data synced {when(row.scheduleUpdatedAt)}</small></div><button className="secondary" onClick={()=>setRecord(row)}>Record promise</button></article>)}</div>}
 {!state.loading&&!rows.length&&<Empty title="No overdue collections on this page" text={state.hasMore ? "Load the next page to check more customers." : "Customers appear after an unpaid invoice crosses its buffer date and the first collection import finishes."}/>}
 <PageEnd state={state}/>
 {record&&<RecordEditor kind="collectionPromises" preset={{customerId:record.id,assignedStaffId:record.assignedStaffId||profile!.uid,title:`Payment promise ? ${record.name}`}} onClose={()=>setRecord(null)} onSaved={state.reload}/>}
 </>;
}
