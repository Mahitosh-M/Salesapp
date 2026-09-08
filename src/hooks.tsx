import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc as firestoreDoc, onSnapshot as onDocumentSnapshot } from "firebase/firestore";
import { salesAuth, salesDb } from "./firebase";
import {
  readOne,
  page,
  clearCache,
  type Row,
  type Filter,
} from "./services/sales";
import type { Profile } from "../shared/schema";
const AuthContext = createContext<{
  profile: Profile | null;
  loading: boolean;
  error: string;
  login: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  profile: null,
  loading: true,
  error: "",
  login: async () => {},
  logout: async () => {},
});
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(
    () =>
      onAuthStateChanged(salesAuth, async (user) => {
        clearCache();
        setProfile(null);
        setLoading(true);
        setError("");
        try {
          if (user) {
            const p = await readOne("users", user.uid);
            if (!p || !p.active || !["Admin", "Manager", "Staff"].includes(p.role))
              throw new Error(
                "Your Salesapp access has not been enabled. Ask your Admin to create an active user profile.",
              );
            setProfile({ ...p, uid: user.uid } as unknown as Profile);
          }
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setLoading(false);
        }
      }),
    [],
  );
  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        error,
        login: async (e, p) => {
          setError("");
          await signInWithEmailAndPassword(salesAuth, e.trim(), p);
        },
        logout: async () => {
          clearCache();
          setProfile(null);
          await signOut(salesAuth);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useRows(
  name: string,
  filters: Filter[] = [],
  sort?: [string, "asc" | "desc"],
) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<any>();
  const [hasMore, setMore] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setRevision((r) => r + 1);
    window.addEventListener("salesapp:records-changed", changed);
    return () =>
      window.removeEventListener("salesapp:records-changed", changed);
  }, []);
  const key = JSON.stringify([name, filters, sort, profile?.uid, revision]);
  useEffect(() => {
    let active = true;
    setRows([]);
    setLoading(true);
    setError("");
    if (!profile) return;
    page(name, profile, filters, undefined, sort)
      .then((r) => {
        if (active) {
          setRows(r.rows);
          setCursor(r.cursor);
          setMore(r.hasMore);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [key]);
  const loadMore = async () => {
    if (!profile || loading || !hasMore) return;
    setLoading(true);
    try {
      const r = await page(name, profile, filters, cursor, sort);
      setRows((old) => [
        ...old,
        ...r.rows.filter((x: Row) => !old.some((v) => v.id === x.id)),
      ]);
      setCursor(r.cursor);
      setMore(r.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return {
    rows,
    loading,
    error,
    hasMore,
    loadMore,
    reload: () => {
      clearCache();
      setRevision((r) => r + 1);
    },
  };
}
export function useDocument(name: string, id: string) {
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setRevision((r) => r + 1);
    window.addEventListener("salesapp:records-changed", changed);
    return () =>
      window.removeEventListener("salesapp:records-changed", changed);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setRow(null);
    setError("");
    readOne(name, id)
      .then((r) => active && setRow(r))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [name, id, revision]);
  return { row, loading, error, reload: () => setRevision((x) => x + 1) };
}
export function useLiveDocument(name: string, id: string) {
  const { profile } = useAuth();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!profile || !id) return;
    setLoading(true);
    setError("");
    return onDocumentSnapshot(
      firestoreDoc(salesDb, name, id),
      (snapshot) => {
        setRow(
          snapshot.exists()
            ? ({ ...snapshot.data(), id: snapshot.id } as Row)
            : null,
        );
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message);
        setLoading(false);
      },
    );
  }, [profile?.uid, name, id]);
  return { row, loading, error };
}
