// Imported only by the Admin Sync screen after an explicit Connect action.
// No Project A Firestore SDK or database handle is exposed to the browser.
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
const config = {
  apiKey: "AIzaSyATEp0aDCh1vLcI21KB3Nphy5Rygy7_CMU",
  authDomain: "cisapp-236ab.firebaseapp.com",
  projectId: "cisapp-236ab",
  appId: "1:835565586103:web:c46c8f8137288c21366f32",
};
const app =
  getApps().find((a) => a.name === "cisapp-sync-auth") ||
  initializeApp(config, "cisapp-sync-auth");
const cisAuth = getAuth(app);
let readyPromise: Promise<void> | null = null;

async function ready() {
  if (!readyPromise) {
    readyPromise = setPersistence(cisAuth, browserLocalPersistence).then(() => cisAuth.authStateReady());
  }
  await readyPromise;
}

export async function connect(email: string, password: string) {
  await ready();
  await signInWithEmailAndPassword(cisAuth, email.trim(), password);
}
export async function token() {
  await ready();
  if (!cisAuth.currentUser)
    throw new Error("Connect your existing CISapp Admin account");
  return cisAuth.currentUser.getIdToken();
}
export async function isConnected() {
  await ready();
  return Boolean(cisAuth.currentUser);
}
export async function disconnect() {
  await ready();
  await signOut(cisAuth);
}
