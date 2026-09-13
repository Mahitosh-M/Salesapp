import { readFirebaseConfig } from './publicFirebaseConfig';
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

export const emulator = import.meta.env?.VITE_USE_EMULATORS === "true";
const app = initializeApp({ ...readFirebaseConfig(import.meta.env?.VITE_FIREBASE_CONFIG, 'VITE_FIREBASE_CONFIG'), ...(emulator ? { projectId: 'demo-salesapp' } : {}) });
export const salesAuth = getAuth(app);
export const salesDb = getFirestore(app);

if (emulator) {
  connectAuthEmulator(salesAuth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(salesDb, "127.0.0.1", 8085);
}
