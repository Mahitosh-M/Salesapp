import { useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  ShieldCheck,
  ArrowDown,
  Database,
  Pause,
  Plug,
} from "lucide-react";
import { useDocument } from "../hooks";
import {
  Header,
  Panel,
  Metric,
  ErrorBox,
  when,
  Loading,
  Badge,
} from "../components/ui";
import { command } from "../services/sales";
import { emulator } from "../firebase";
import { today, type Data } from "../../shared/schema";
export default function Sync() {
  const saved = useDocument("syncState", "cisapp");
  const [state, setState] = useState<Data | null>(null);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const stop = useRef(false);
  const live = useRef(true);
  const session = useRef<typeof import("../services/cisappSession") | null>(
    null,
  );
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      stop.current = true;
      void session.current?.disconnect();
    };
  }, []);
  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      session.current = await import("../services/cisappSession");
      await session.current.connect(email, password);
      setConnected(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPassword("");
      setBusy(false);
    }
  }
  async function run(mode: string) {
    if (!session.current) return;
    stop.current = false;
    setBusy(true);
    setError("");
    try {
      do {
        const result = await command("synchronizeCisapp", {
          token: await session.current.token(),
          mode,
          month,
        });
        if (live.current) setState(result);
        if (!result.runId) break;
        mode = "RETRY";
      } while (!stop.current && live.current);
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      if (live.current) {
        setBusy(false);
        saved.reload();
      }
    }
  }
  const s = state || saved.row;
  return (
    <>
      <Header
        eyebrow="ADMIN · CONTROLLED IMPORT"
        title="CISapp Sync"
        description="Bring the latest source information into your team’s workspace."
      />
      <div className="sync-flow">
        <div>
          <Database size={22} />
          <strong>CISapp</strong>
          <span>Read-only source</span>
        </div>
        <ArrowDown className="flow-arrow" />
        <div>
          <ShieldCheck size={22} />
          <strong>Controlled sync</strong>
          <span>Admin initiated · saved checkpoints</span>
        </div>
        <ArrowDown className="flow-arrow" />
        <div>
          <Database size={22} />
          <strong>Salesapp</strong>
          <span>All everyday work stays here</span>
        </div>
      </div>
      <ErrorBox message={saved.error || error} />
      {emulator && (
        <p className="notice">
          Local emulator mode: live CISapp connections and synchronization are
          disabled. This workspace uses isolated test data.
        </p>
      )}
      <div className="two-columns">
        <Panel
          title="Synchronization status"
          action={<Badge value={s?.status || "NOT_STARTED"} />}
        >
          <div className="detail-row">
            <span>Last successful sync</span>
            <b>{when(s?.lastSuccessfulSync)}</b>
          </div>
          <div className="detail-row">
            <span>Last attempted sync</span>
            <b>{when(s?.lastAttempt)}</b>
          </div>
          <div className="detail-row">
            <span>Current stage</span>
            <b>{s?.phase || "Awaiting initial import"}</b>
          </div>
          <div className="detail-row">
            <span>Failures</span>
            <b>{s?.failureCount || 0}</b>
          </div>
          <ErrorBox message={s?.lastError} />
          <div className="metrics-grid small">
            <Metric
              label="Customers synchronized"
              value={s?.customersSynchronized || 0}
            />
            <Metric label="Source records read" value={s?.recordsRead || 0} />
            <Metric label="Records updated" value={s?.recordsUpdated || 0} />
            <Metric label="Unchanged" value={s?.recordsUnchanged || 0} />
          </div>
          <p className="subtle">
            Counts cover this run’s processed records, not the Firebase bill.
            Query minimums, authorization reads, overlap, and retries can add
            reads.
          </p>
        </Panel>
        <Panel title="Source connection">
          {!connected ? (
            <form onSubmit={connect}>
              <p className="subtle">
                Use an existing active CISapp Admin account. This separate
                session is kept in memory only.
              </p>
              <label>
                CISapp Admin email
                <input
                  required
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                CISapp password
                <input
                  required
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button disabled={busy || emulator}>
                <Plug size={17} />
                {busy ? "Connecting…" : "Connect source account"}
              </button>
            </form>
          ) : (
            <>
              <p className="success">
                Source session connected. The read-only connector verifies the
                account’s Admin role before reading.
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  await session.current?.disconnect();
                  setConnected(false);
                }}
              >
                Disconnect source
              </button>
            </>
          )}
          <label className="space-top">
            Target month
            <input
              type="month"
              value={month}
              disabled={busy}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        </Panel>
      </div>
      <Panel title="Sync controls">
        <p className="notice">
          These actions consume CISapp reads. Initial import and full
          reconciliation read all selected summary documents. Sync Now reads
          timestamp changes with a ten-minute overlap. Invoice target
          reconciliation reads the selected month’s invoices. Each regular sync
          also checks each active customer’s latest completed sales invoice for
          automatic visit planning.
        </p>
        <div className="button-row">
          {s?.runId && !busy && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await command("discardFailedSync", {});
                  setState(null);
                  saved.reload();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Discard checkpoint to start a new run
            </button>
          )}
          <button
            disabled={!connected || busy || emulator}
            onClick={() =>
              run(s?.lastSuccessfulSync ? "INCREMENTAL" : "INITIAL")
            }
          >
            <RefreshCw size={17} />
            {s?.lastSuccessfulSync ? "Sync now" : "Initial import"}
          </button>
          <button
            className="secondary"
            disabled={!connected || busy || emulator || !s?.runId}
            onClick={() => run("RETRY")}
          >
            Retry / resume saved run
          </button>
          <button
            className="secondary"
            disabled={!connected || busy || emulator || !!s?.runId}
            onClick={() => run("RECONCILE")}
          >
            Full reconciliation
          </button>
          <button
            className="secondary"
            disabled={!connected || busy || emulator || !!s?.runId}
            onClick={() => run("INVOICE_TARGET")}
          >
            Reconcile month’s targets
          </button>
          {busy && (
            <button
              className="secondary"
              onClick={() => {
                stop.current = true;
              }}
            >
              <Pause size={16} />
              Pause after this batch
            </button>
          )}
        </div>
        {busy && <Loading />}
        <p className="subtle">
          Keep this page open during sync. Closing it can interrupt a batch;
          retry resumes from the saved checkpoint. Use full reconciliation
          periodically to detect deleted or untimestamped source records.
          Incomplete source summaries remain marked unavailable.
        </p>
      </Panel>
    </>
  );
}
