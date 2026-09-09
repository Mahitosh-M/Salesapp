import { salesDb, FieldPath } from "./db";
import { saveRecord } from "./records";
import { collectionDue } from "../../shared/collections";
import { type Profile, today } from "../../shared/schema";
export async function generateBufferCollections(profile:Profile,stopped=()=>false,staffId=""){
 let q=salesDb.collection("collectionSnapshots").where("active","==",true).orderBy(FieldPath.documentId()).limit(25);
 if(staffId || profile.role === "Staff")q=q.where("assignedStaffId","==",staffId || profile.uid);
 if(profile.role === "Manager")q=q.where("branchId","==",profile.branchId || "NO_BRANCH");
 let cursor:string|undefined;
 do{const page=await (cursor?q.startAfter(cursor):q).get();
 for(const row of page.docs){if(stopped())return;const customer=row.data();if(!customer.assignedStaffId || !Array.isArray(customer.invoices))continue;
 const owner=(await salesDb.doc(`users/${customer.assignedStaffId}`).get()).data();if(!owner?.active || owner.role!=="Staff" || owner.branchId!==customer.branchId)continue;
 const due=collectionDue(customer.invoices,today()); if(!due.amount)continue;
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${row.id}:collection`));
 const key="buffer_"+Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");
 if((await salesDb.doc(`tasks/${key}`).get()).exists)continue;
 const dates=[...new Set(due.invoices.map(invoice=>invoice.dueDate))].join(", ");
 const buffers=[...new Set(due.invoices.map(invoice=>String(invoice.bufferDays)))].join(", ");
 await saveRecord(profile,"tasks",key,{title:`Collect ${customer.name}`.slice(0,180),assignedStaffId:customer.assignedStaffId,customerId:row.id,leadId:"",priority:"HIGH",status:"PENDING",dueDate:today(),notes:`Combined unpaid amount ${due.amount.toFixed(2)}. Due dates: ${dates}. Buffer days: ${buffers}. Check Collections for the latest amount.`},true);
 }
 if(page.size<25)break;cursor=page.docs.at(-1)!.id;
 }while(!stopped());
}
