import { assertLoginInput } from "../inputSecurity";
import { readFirebaseConfig } from '../publicFirebaseConfig';
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
import { getFirestore } from "firebase/firestore";
const config = readFirebaseConfig(import.meta.env?.VITE_CISAPP_FIREBASE_CONFIG, 'VITE_CISAPP_FIREBASE_CONFIG');
const app =
  getApps().find((a) => a.name === "cisapp-sync-auth") ||
  initializeApp(config, "cisapp-sync-auth");
const cisAuth = getAuth(app);
export const cisDb = getFirestore(app);
export { cisAuth };
let readyPromise: Promise<void> | null = null;

async function ready() {
  if (!readyPromise) {
    readyPromise = setPersistence(cisAuth, browserLocalPersistence).then(() => cisAuth.authStateReady());
  }
  await readyPromise;
}

export async function connect(email: string, password: string) {
  assertLoginInput(email, password);
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
