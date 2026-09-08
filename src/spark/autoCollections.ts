import { salesDb, FieldPath } from "./db";
import { saveRecord } from "./records";
import { collectionDue } from "../../shared/collections";
import { type Profile, today } from "../../shared/schema";
export async function generateBufferCollections(profile:Profile,stopped=()=>false){
 let q=salesDb.collection("collectionSnapshots").where("active","==",true).orderBy(FieldPath.documentId()).limit(25);
 if(profile.role === "Staff")q=q.where("assignedStaffId","==",profile.uid);
 if(profile.role === "Manager")q=q.where("branchId","==",profile.branchId || "NO_BRANCH");
 let cursor:string|undefined;
 do{const page=await (cursor?q.startAfter(cursor):q).get();
 for(const row of page.docs){if(stopped())return;const customer=row.data();if(!customer.assignedStaffId || !Array.isArray(customer.invoices))continue;
 const owner=(await salesDb.doc(`users/${customer.assignedStaffId}`).get()).data();if(!owner?.active || owner.role!=="Staff" || owner.branchId!==customer.branchId)continue;
 const due=collectionDue(customer.invoices,today());
 for(const invoice of due.invoices){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${row.id}:${invoice.invoiceId}`));
  const key="buffer_"+Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");
  if((await salesDb.doc(`tasks/${key}`).get()).exists)continue;
  await saveRecord(profile,"tasks",key,{title:`Collect ${customer.name}`.slice(0,180),assignedStaffId:customer.assignedStaffId,customerId:row.id,leadId:"",priority:"HIGH",status:"PENDING",dueDate:today(),notes:`Invoice ${invoice.invoiceNumber}: amount ${invoice.amount.toFixed(2)} when task created. Due ${invoice.dueDate}; buffer ${invoice.bufferDays} days ended ${invoice.cutoffDate}. Check Collections for the latest unpaid amount.`},true);
 }
 }
 if(page.size<25)break;cursor=page.docs.at(-1)!.id;
 }while(!stopped());
}
