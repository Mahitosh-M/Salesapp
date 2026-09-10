import { deleteApp, initializeApp } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { salesAuth } from "../src/firebase";
import { command, readOne } from "../src/services/sales";
import type { Data } from "../shared/schema";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required GitHub secret: ${name}`);
  return value;
};

const indiaMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Could not determine the sync month");
  return `${year}-${month}`;
};

if (process.argv.includes("--check")) {
  console.log("Daily CISapp sync runner compiled successfully.");
  process.exit(0);
}

const cisApp = initializeApp(
  {
    apiKey: "AIzaSyATEp0aDCh1vLcI21KB3Nphy5Rygy7_CMU",
    authDomain: "cisapp-236ab.firebaseapp.com",
    projectId: "cisapp-236ab",
    appId: "1:835565586103:web:c46c8f8137288c21366f32",
  },
  "scheduled-cisapp-sync",
);
const cisAuth = getAuth(cisApp);

try {
  await Promise.all([
    setPersistence(salesAuth, inMemoryPersistence),
    setPersistence(cisAuth, inMemoryPersistence),
  ]);
  await signInWithEmailAndPassword(
    salesAuth,
    required("SALESAPP_SYNC_EMAIL"),
    required("SALESAPP_SYNC_PASSWORD"),
  );
  await signInWithEmailAndPassword(
    cisAuth,
    required("CISAPP_SYNC_EMAIL"),
    required("CISAPP_SYNC_PASSWORD"),
  );

  const sourceToken = await cisAuth.currentUser?.getIdToken();
  if (!sourceToken) throw new Error("CISapp authentication did not return a token");
  const saved = await readOne("syncState", "cisapp");
  let mode = saved?.runId
    ? "RETRY"
    : saved?.lastSuccessfulSync
      ? "INCREMENTAL"
      : "INITIAL";
  let result: Data = {};

  for (let batch = 1; batch <= 500; batch += 1) {
    result = await command("synchronizeCisapp", {
      token: sourceToken,
      mode,
      month: indiaMonth(),
    });
    console.log(
      `Batch ${batch}: ${result.phase || result.status || "processed"}; ` +
        `${Number(result.recordsRead || 0)} source records read`,
    );
    if (!result.runId) break;
    mode = "RETRY";
    if (batch === 500)
      throw new Error("Daily sync exceeded 500 batches; resume it manually");
  }

  console.log(
    `Daily CISapp sync completed: ${Number(result.recordsUpdated || 0)} updated, ` +
      `${Number(result.recordsUnchanged || 0)} unchanged.`,
  );
} finally {
  await Promise.allSettled([signOut(salesAuth), signOut(cisAuth)]);
  await deleteApp(cisApp);
}
