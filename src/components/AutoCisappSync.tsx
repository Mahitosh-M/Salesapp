import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, RefreshCw, Unplug } from "lucide-react";
import { onSnapshot, collection, doc, getDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { cisAuth, cisDb } from "../services/cisappSession";
import { command, clearCache, readOne } from "../services/sales";
import { today, type Data } from "../../shared/schema";

function businessDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function AutoCisappSync() {
  const [status, setStatus] = useState<"checking" | "connected" | "syncing" | "done" | "disconnected" | "error">("checking");
  const [reads, setReads] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let stopped=false, busy=false, completedDay="", retryAfter=0;
    const run=async()=>{
      if(stopped || busy || completedDay===today() || Date.now()<retryAfter) return;
      busy=true;
      try {
        const session=await import("../services/cisappSession");
        if(!(await session.isConnected())) { if(!stopped)setStatus("disconnected"); return; }
        const state=await readOne("syncState","cisapp");
        if(stopped)return;
        if(!state?.lastSuccessfulSync && !state?.runId){setStatus("connected");return;}
        if(!state?.runId && state?.collectionSchemaVersion===1 && businessDate(state.lastSuccessfulSync)===today()) {setStatus("done");setReads(Number(state.recordsRead||0));completedDay=today();return;}
        setStatus("syncing");setMessage("");
        let mode=state?.runId ? "RETRY" : "INCREMENTAL";
        let result:Data;
        do { result=await command("synchronizeCisapp",{token:await session.token(),mode,month:today().slice(0,7)});if(!stopped)setReads(Number(result.recordsRead||0));mode="RETRY"; } while(!stopped && result.runId);
        if(!stopped){completedDay=today();setStatus("done");clearCache();window.dispatchEvent(new Event("salesapp:records-changed"));}
      } catch(e){if(!stopped){setMessage(e instanceof Error?e.message:"Daily sync could not finish");setStatus("error");retryAfter=Date.now()+600000;}}
      finally{busy=false;}
    };
    const wake=()=>void run();void run();const timer=setInterval(wake,60000);window.addEventListener("focus",wake);
    return()=>{stopped=true;clearInterval(timer);window.removeEventListener("focus",wake);};
  }, []);

  useEffect(() => {
    let stopped = false;
    let invoiceStop: (() => void) | undefined;
    let paymentStop: (() => void) | undefined;
    const stopListeners = () => { invoiceStop?.(); paymentStop?.(); invoiceStop = undefined; paymentStop = undefined; };
    const startCriticalListeners = async () => {
      stopListeners();
      const sourceUser = cisAuth.currentUser;
      if (!sourceUser) return;
      const sourceProfile = await getDoc(doc(cisDb, "users", sourceUser.uid));
      const profile = sourceProfile.data();
      if (stopped || !profile?.active || String(profile.role || "").toLowerCase() !== "admin") return;
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const watch = (kind: "invoices" | "payments") => onSnapshot(
        query(collection(cisDb, kind), where("updatedAt", ">=", since)),
        (snap) => { for (const change of snap.docChanges()) if (change.type !== "removed") void command("syncCriticalCisapp", { kind, id: change.doc.id, payload: change.doc.data() }); },
        () => undefined,
      );
      if (!stopped) { invoiceStop = watch("invoices"); paymentStop = watch("payments"); }
    };
    const unsubscribe = onAuthStateChanged(cisAuth, () => { void startCriticalListeners().catch(() => undefined); });
    return () => { stopped = true; unsubscribe(); stopListeners(); };
  }, []);

  if (status === "checking") return null;
  return (
    <div className={`auto-sync-bar ${status}`}>
      <span className="auto-sync-icon">
        {status === "syncing" ? <RefreshCw className="spin" size={16} /> : status === "done" ? <CheckCircle2 size={16} /> : <Unplug size={16} />}
      </span>
      <div>
        <b>{status === "syncing" ? "Daily CISapp sync is running" : status === "done" ? "Daily CISapp sync is up to date" : status === "connected" ? "CISapp is connected" : "Daily CISapp sync needs attention"}</b>
        <span>{status === "done" || status === "syncing" ? `${reads} imported records counted in Salesapp` : message || (status === "connected" ? "Finish the first import on the Sync page." : "Connect the CISapp Admin once to enable daily sync.")}</span>
      </div>
      <Link to="/sync">Open sync</Link>
    </div>
  );
}
