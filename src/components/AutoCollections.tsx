import { useEffect, useState } from "react";
import { useAuth } from "../hooks";
import { ErrorBox } from "./ui";
import { clearCache } from "../services/sales";
import { today } from "../../shared/schema";
export function AutoCollections(){
 const {profile}=useAuth();const [error,setError]=useState("");
 useEffect(()=>{if(!profile || profile.role !== "Admin")return;let stopped=false,busy=false,last="",rerun=false;
 const run=async(force=false)=>{if(busy){rerun ||= force;return;}if(stopped||(!force&&last===today()))return;busy=true;
 try { const {generateBufferCollections}=await import("../spark/autoCollections"); await generateBufferCollections(profile,()=>stopped);if(!stopped){last=today();setError("");clearCache();window.dispatchEvent(new Event("salesapp:records-changed"));}}
 catch(e){if(!stopped)setError(`Collections: ${(e as Error).message}`);}finally{busy=false;if(rerun&&!stopped){rerun=false;void run(true);}}};
 const sync=()=>void run(true), wake=()=>void run();void run();const timer=setInterval(wake,60000);
 window.addEventListener("salesapp:sync-complete",sync);window.addEventListener("focus",wake);
 return()=>{stopped=true;clearInterval(timer);window.removeEventListener("salesapp:sync-complete",sync);window.removeEventListener("focus",wake);};
 },[profile?.uid,profile?.branchId]);return error?<ErrorBox message={error}/>:null;
}
