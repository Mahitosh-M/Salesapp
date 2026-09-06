import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import type { Profile } from "../../shared/schema";
const expected = process.env.FIRESTORE_EMULATOR_HOST
  ? "demo-salesapp"
  : "salesapp-aaa7b";
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== expected)
  throw new Error("Salesapp backend cannot run against another project");
const app = getApps()[0] || initializeApp({ projectId: expected });
export const salesDb = getFirestore(app);
export const salesAdminAuth = getAuth(app);
export async function actor(
  request: CallableRequest,
  admin = false,
): Promise<Profile> {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign in to Salesapp");
  const snap = await salesDb.doc(`users/${request.auth.uid}`).get();
  const p = snap.data() as Profile | undefined;
  if (
    !p?.active ||
    !["Admin", "Staff"].includes(p.role) ||
    (admin && p.role !== "Admin")
  )
    throw new HttpsError("permission-denied", "This action is not permitted");
  return { ...p, uid: request.auth.uid };
}
export function validId(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length > 0 &&
    v.length < 180 &&
    !v.includes("/") &&
    /^[A-Za-z0-9_.-]+$/.test(v)
  );
}
export function requireId(v: unknown): string {
  if (!validId(v))
    throw new HttpsError("invalid-argument", "Invalid record identifier");
  return v;
}
