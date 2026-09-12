import { useEffect, useState } from "react";
import { useAuth } from "../hooks";
import { today } from "../../shared/schema";
import { clearCache } from "../services/sales";
import { ErrorBox } from "./ui";
export function AutoVisits() {
  const { profile } = useAuth();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!profile || !["Admin", "Staff"].includes(profile.role)) return;
    let stopped = false,
      busy = false,
      completedDay = "",
      rerun = false;
    async function run(force = false) {
      if (force) completedDay = "";
      if (busy) {
        rerun ||= force;
        return;
      }
      if (stopped || completedDay === today() || !profile) return;
      busy = true;
      setError("");
      try {
        const { generateAutomaticFollowUps } = await import("../spark/autoFollowUps");
        let cursor: string | undefined,
          changed = 0;
        cursor = undefined;
        do {
          const followUps = await generateAutomaticFollowUps(profile, cursor);
          changed += followUps.changed;
          cursor = followUps.cursor;
          if (followUps.done) break;
        } while (!stopped);
        if (!stopped) completedDay = today();
        if (changed) {
          clearCache();
          window.dispatchEvent(new Event("salesapp:records-changed"));
        }
      } catch (e) {
        if (!stopped)
          setError(
            `Automatic follow-ups could not refresh: ${(e as Error).message}`,
          );
      } finally {
        busy = false;
        if (rerun && !stopped) {
          rerun = false;
          void run(true);
        }
      }
    }
    const refresh = () => void run(true),
      wake = () => void run();
    void run();
    const timer = window.setInterval(wake, 60000);
    window.addEventListener("focus", wake);
    window.addEventListener("salesapp:sync-complete", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("salesapp:sync-complete", refresh);
    };
  }, [profile?.uid, profile?.role]);
  return error ? <ErrorBox message={error} /> : null;
}
