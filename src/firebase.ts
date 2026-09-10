import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

export const emulator = import.meta.env?.VITE_USE_EMULATORS === "true";
const app = initializeApp({
  apiKey: "AIzaSyDfVigFg3Kn25c2T2mY8Gqpv9HaZxRzQvc",
  authDomain: "salesapp-aaa7b.firebaseapp.com",
  projectId: emulator ? "demo-salesapp" : "salesapp-aaa7b",
  storageBucket: "salesapp-aaa7b.firebasestorage.app",
  messagingSenderId: "695799416355",
  appId: "1:695799416355:web:d2880f7d992db922e65396",
});
export const salesAuth = getAuth(app);
export const salesDb = getFirestore(app);

if (emulator) {
  connectAuthEmulator(salesAuth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(salesDb, "127.0.0.1", 8085);
}
