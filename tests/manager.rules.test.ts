import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, collection, query, where, limit, getDocs, serverTimestamp } from "firebase/firestore";
import { readFileSync } from "node:fs";
let env: RulesTestEnvironment;
const suite = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
suite("Branch Manager isolation", () => {
 beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-manager", firestore: { host:"127.0.0.1", port:8085, rules: readFileSync("firestore.spark.rules","utf8") } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
   for (const [uid,role,branchId] of [["manager","Manager","MASKI"],["mine","Staff","MASKI"],["other","Staff","SINDHANUR"],["admin","Admin","MASKI"]])
    await setDoc(doc(context.firestore(),"users",uid),{uid,name:uid,role,branchId,active:true});
   await setDoc(doc(context.firestore(),"tasks","outside"),task("outside","other","SINDHANUR"));
  });
 });
 afterAll(async () => env.cleanup());
 const task = (id:string,owner="mine",branch="MASKI") => ({title:"Collection call",assignedStaffId:owner,assignedStaffName:owner,branchId:branch,status:"PENDING",priority:"HIGH",customerId:"",leadId:"",dueDate:"2026-09-30",notes:"",sourceType:"ADMIN",sourceId:id,createdBy:"manager",createdAt:"2026-09-07",updatedAt:"2026-09-07",createdOn:serverTimestamp(),submittedAt:serverTimestamp()});
 const db = () => env.authenticatedContext("manager").firestore();
 it("creates and delegates inside the branch",async()=>{const ref=doc(db(),"tasks","mine"); await assertSucceeds(setDoc(ref,task("mine"))); await assertSucceeds(updateDoc(ref,{assignedStaffId:"manager",assignedStaffName:"manager",submittedAt:serverTimestamp()}));});
 it("rejects other branch owner even with forged branch",async()=>{await assertFails(setDoc(doc(db(),"tasks","forged"),task("forged","other")));});
 it("rejects other branch task read",async()=>{await assertFails(getDoc(doc(db(),"tasks","outside")));});
 it("rejects changing another branch task",async()=>{await assertFails(setDoc(doc(db(),"tasks","outside"),task("outside")));});
 it("requires branch scoped listing",async()=>{await assertFails(getDocs(query(collection(db(),"tasks"),limit(25)))); await assertSucceeds(getDocs(query(collection(db(),"tasks"),where("branchId","==","MASKI"),limit(25))));});
 it("cannot promote self or staff",async()=>{await assertFails(updateDoc(doc(db(),"users","manager"),{role:"Admin"}));await assertFails(updateDoc(doc(db(),"users","mine"),{role:"Manager"}));});
 it("cannot read another branch Staff",async()=>{await assertFails(getDoc(doc(db(),"users","other")));await assertSucceeds(getDoc(doc(db(),"users","mine")));});
 it("cannot access source sync",async()=>{await assertFails(getDoc(doc(db(),"syncState","cisapp")));});
});
