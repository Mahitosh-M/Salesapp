// Project B web SDK only: every action remains subject to firestore.spark.rules.
import * as fs from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  connectAuthEmulator,
} from "firebase/auth";
import { salesDb as db, salesAuth, emulator } from "../firebase";
import { HttpsError } from "./errors";
import type { Data, Profile } from "../../shared/schema";
export const FieldPath = { documentId: fs.documentId };
export const serverTimestamp = fs.serverTimestamp;
class Snap {
  constructor(public raw: fs.DocumentSnapshot) {}
  get id() {
    return this.raw.id;
  }
  get exists() {
    return this.raw.exists();
  }
  get ref() {
    return new Ref(this.raw.ref.path);
  }
  data(): Data | undefined {
    return this.raw.data();
  }
}
class QuerySnap {
  docs: Array<Omit<Snap, "data"> & { data(): Data }>;
  constructor(s: fs.QuerySnapshot) {
    this.docs = s.docs.map((d) => new Snap(d)) as Array<
      Omit<Snap, "data"> & { data(): Data }
    >;
  }
  get size() {
    return this.docs.length;
  }
  get empty() {
    return !this.size;
  }
}
class Ref {
  raw: fs.DocumentReference;
  constructor(public path: string) {
    this.raw = fs.doc(db, path);
  }
  get id() {
    return this.raw.id;
  }
  async get() {
    return new Snap(await fs.getDoc(this.raw));
  }
  set(d: Data, o?: fs.SetOptions) {
    return o ? fs.setDoc(this.raw, d, o) : fs.setDoc(this.raw, d);
  }
  update(d: Data) {
    return fs.updateDoc(this.raw, d);
  }
  delete() {
    return fs.deleteDoc(this.raw);
  }
}
class Query {
  constructor(
    public name: string,
    public constraints: fs.QueryConstraint[] = [],
  ) {}
  where(f: string, op: fs.WhereFilterOp, v: any) {
    return new Query(this.name, [...this.constraints, fs.where(f, op, v)]);
  }
  orderBy(f: string | fs.FieldPath, d: fs.OrderByDirection = "asc") {
    return new Query(this.name, [...this.constraints, fs.orderBy(f, d)]);
  }
  limit(n: number) {
    return new Query(this.name, [...this.constraints, fs.limit(n)]);
  }
  startAfter(v: any) {
    return new Query(this.name, [
      ...this.constraints,
      fs.startAfter(v instanceof Snap ? v.raw : v),
    ]);
  }
  async get() {
    return new QuerySnap(
      await fs.getDocs(
        fs.query(fs.collection(db, this.name), ...this.constraints),
      ),
    );
  }
}
class Writer {
  constructor(public raw: fs.WriteBatch | fs.Transaction) {}
  set(r: Ref, d: Data, o?: fs.SetOptions) {
    if (o) (this.raw as fs.WriteBatch).set(r.raw, d, o);
    else (this.raw as fs.WriteBatch).set(r.raw, d);
    return this;
  }
  update(r: Ref, d: Data) {
    (this.raw as fs.WriteBatch).update(r.raw, d);
    return this;
  }
  delete(r: Ref) {
    this.raw.delete(r.raw);
    return this;
  }
}
class Tx extends Writer {
  constructor(public raw: fs.Transaction) {
    super(raw);
  }
  async get(r: Ref) {
    return new Snap(await this.raw.get(r.raw));
  }
}
class Batch extends Writer {
  constructor(public raw = fs.writeBatch(db)) {
    super(raw);
  }
  commit() {
    return this.raw.commit();
  }
}
export const salesDb = {
  doc: (p: string) => new Ref(p),
  collection: (n: string) => new Query(n),
  batch: () => new Batch(),
  getAll: (...r: Ref[]) => Promise.all(r.map((x) => x.get())),
  runTransaction: <T>(fn: (tx: Tx) => Promise<T>) =>
    fs.runTransaction(db, (tx) => fn(new Tx(tx))),
};
export async function actor(
  _request: unknown,
  admin = false,
): Promise<Profile> {
  const user = salesAuth.currentUser;
  if (!user) throw new HttpsError("unauthenticated", "Sign in to Salesapp");
  const p = (await salesDb.doc(`users/${user.uid}`).get()).data();
  if (
    !p?.active ||
    !["Admin", "Staff"].includes(p.role) ||
    (admin && p.role !== "Admin")
  )
    throw new HttpsError("permission-denied", "This action is not permitted");
  return { ...p, uid: user.uid } as Profile;
}
export function requireId(v: unknown): string {
  if (typeof v !== "string" || !/^[A-Za-z0-9_.-]{1,179}$/.test(v))
    throw new HttpsError("invalid-argument", "Invalid record identifier");
  return v;
}
export const salesAdminAuth = {
  // Revocation uses the profile, which every rules-authorized operation checks.
  async updateUser(_uid: string, _data: Data) {
    await actor(null, true);
  },
  async createUser(d: Data) {
    await actor(null, true);
    const app = initializeApp(
      salesAuth.app.options,
      `staff-create-${crypto.randomUUID()}`,
    );
    const auth = getAuth(app);
    try {
      if (emulator)
        connectAuthEmulator(auth, "http://127.0.0.1:9099", {
          disableWarnings: true,
        });
      await setPersistence(auth, inMemoryPersistence);
      const result = await createUserWithEmailAndPassword(
        auth,
        d.email,
        d.password,
      );
      await updateProfile(result.user, { displayName: d.displayName });
      return { uid: result.user.uid };
    } finally {
      await signOut(auth);
      await deleteApp(app);
    }
  },
};
