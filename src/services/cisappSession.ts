// Imported only by the Admin Sync screen after an explicit Connect action.
// No Project A Firestore SDK or database handle is exposed to the browser.
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
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
export async function connect(email: string, password: string) {
  await setPersistence(cisAuth, inMemoryPersistence);
  await signInWithEmailAndPassword(cisAuth, email.trim(), password);
}
export async function token() {
  if (!cisAuth.currentUser)
    throw new Error("Connect your existing CISapp Admin account");
  return cisAuth.currentUser.getIdToken();
}
export async function disconnect() {
  await signOut(cisAuth);
}
