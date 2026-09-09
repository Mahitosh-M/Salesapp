import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  CheckCircle2,
  Phone,
  CalendarDays,
  Wallet,
  Target,
  Users,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useAuth, useRows, useDocument, useLiveDocument } from "../hooks";
import {
  Header,
  Panel,
  Metric,
  Empty,
  ErrorBox,
  Loading,
  Badge,
  money,
  when,
} from "../components/ui";
import { RecordEditor } from "../components/RecordEditor";
import { today, label, targetMetrics } from "../../shared/schema";
export default function Dashboard() {
  const { profile } = useAuth();
  return profile?.role === "Admin" ? <AdminDashboard /> : <Today />;
}
export function Today() {
  const { profile } = useAuth();
  const month = today().slice(0, 7);
  const target = useLiveDocument("staffTargetProgress", `${profile?.uid || "pending"}_${month}`);
  const queue = useRows(
    "tasks",
    [
      ["status", "in", ["PENDING", "IN_PROGRESS", "OVERDUE"]],
      ["dueDate", "<=", today()],
    ],
    ["dueDate", "asc"],
  );
  const performance = useRows("staffPerformance", [["month", "==", month]]);
  const [quick, setQuick] = useState(false);
  const [edit, setEdit] = useState<any>();
  const dayWork = useRows("staffDailyWork", [["day", "==", today()]]);
  const openWork = useRows("staffWorkSummaries");
  const dayCounts = dayWork.rows[0]?.counts || {};
  const openCounts = openWork.rows[0]?.counts || {};
  const t = target.row;
  const counts = performance.rows[0]?.counts || {};
  const first = profile!.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const types = [
    ["Collections", "collectionPromises", Wallet],
    ["Follow-ups", "followUps", Phone],
    ["Opportunities", "opportunities", Target],
    ["Visits", "visits", CalendarDays],
    ["Leads", "leads", Users],
    ["Campaign work", "campaignAssignments", Layers],
  ] as const;
  return (
    <>
      <Header
        eyebrow={new Date()
          .toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })
          .toUpperCase()}
        title={`${greeting}, ${first}`}
        description="A little focus. A meaningful next step."
        actions={
          <button onClick={() => setQuick(true)}>
            <Plus size={18} />
            Log interaction
          </button>
        }
      />
      <ErrorBox
        message={
          target.error ||
          queue.error ||
          performance.error ||
          dayWork.error ||
          openWork.error
        }
      />
      <section className="target-hero">
        <div>
          <div className="eyebrow">
            YOUR{" "}
            {new Date()
              .toLocaleString("en-IN", { month: "long" })
              .toUpperCase()}{" "}
            TARGET
          </div>
          <div className="target-value">
            {money(t?.achieved)} <span>/ {money(t?.target)}</span>
          </div>
          <p>
            {t
              ? label(targetMetrics(t.target, t.achieved, month).paceStatus)
              : "Your Admin can set your monthly target."}
          </p>
          <Link to="/targets">
            See my target <ArrowUpRight size={16} />
          </Link>
        </div>
        <div
          className="target-ring"
          style={
            {
              "--progress": `${Math.min(100, t?.percentage || 0)}%`,
            } as React.CSSProperties
          }
        >
          <div>
            <strong>
              {t?.percentage ?? "—"}
              <small>%</small>
            </strong>
            <span>of monthly target</span>
          </div>
        </div>
      </section>
      <div className="section-label">
        <h2>Today’s focus</h2>
        <span>Due today + overdue</span>
      </div>
      <div className="focus-grid">
        {types.map(([title, source, Icon]) => (
          <Link to={`/work/${source}`} className="focus-tile" key={source}>
            <Icon size={20} />
            <b>
              {(dayCounts[`source_${source}`] || 0) +
                (openCounts[`overdue_${source}`] || 0)}
            </b>
            <span>{title}</span>
            <ArrowUpRight size={14} />
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Top priorities"
          action={
            <Link className="text-button" to="/work/tasks">
              All tasks <ArrowRight size={15} />
            </Link>
          }
        >
          {queue.loading ? (
            <Loading />
          ) : queue.rows.length ? (
            [...queue.rows]
              .sort(
                (a, b) =>
                  ["URGENT", "HIGH", "NORMAL", "LOW"].indexOf(a.priority) -
                    ["URGENT", "HIGH", "NORMAL", "LOW"].indexOf(b.priority) ||
                  String(a.dueDate).localeCompare(String(b.dueDate)),
              )
              .map((r) => (
                <article className="priority-row" key={r.id}>
                  <div
                    className={`priority-mark ${r.priority?.toLowerCase()}`}
                  />
                  <div className="grow">
                    <Badge value={r.priority} />
                    <h3>{r.title}</h3>
                    <p>
                      {r.dueDate < today() ? "Overdue · " : ""}
                      {r.dueDate}
                    </p>
                    {r.customerId && (
                      <Link
                        className="text-button"
                        to={`/customers/${r.customerId}`}
                      >
                        Open customer →
                      </Link>
                    )}
                  </div>
                  <button className="secondary" onClick={() => setEdit(r)}>
                    Update
                  </button>
                </article>
              ))
          ) : (
            <Empty
              title="A clear day ahead"
              text="Your due and overdue tasks will appear here. Start a conversation or plan your next visit."
            />
          )}
          {queue.hasMore && (
            <button className="text-button" onClick={queue.loadMore}>
              Load more priorities
            </button>
          )}
        </Panel>
        <div>
          <Panel title="Your month in motion">
            <div className="progress-stat">
              <span>
                <Phone size={16} />
                Calls logged
              </span>
              <b>{counts.calls || 0}</b>
            </div>
            <div className="progress-stat">
              <span>
                <CalendarDays size={16} />
                Visits completed
              </span>
              <b>{counts.visitsCompleted || 0}</b>
            </div>
            <div className="progress-stat">
              <span>
                <CheckCircle2 size={16} />
                Tasks completed
              </span>
              <b>{counts.tasksCompleted || 0}</b>
            </div>
            <div className="progress-stat">
              <span>
                <Users size={16} />
                Leads converted
              </span>
              <b>{counts.leadsConverted || 0}</b>
            </div>
            <Link className="text-button" to="/performance">
              View my performance →
            </Link>
          </Panel>
          <div className="daily-note">
            <span>MAKE THE NEXT STEP COUNT</span>
            <h3>Good relationships grow through follow-through.</h3>
            <p>Capture an outcome. Set a date. Keep your promise.</p>
          </div>
        </div>
      </div>
      {quick && (
        <RecordEditor
          kind="activities"
          onClose={() => setQuick(false)}
          onSaved={() => performance.reload()}
        />
      )}{" "}
      {edit && (
        <RecordEditor
          kind="tasks"
          record={edit}
          onClose={() => setEdit(undefined)}
          onSaved={() => {
            queue.reload();
            performance.reload();
            dayWork.reload();
            openWork.reload();
          }}
        />
      )}
    </>
  );
}
function AdminDashboard() {
  const month = today().slice(0, 7);
  const performance = useDocument("businessPerformance", month);
  const target = useDocument("businessTargetProgress", month);
  const sync = useDocument("publicState", "sync");
  const work = useDocument("adminWorkSummaries", "company");
  const c = performance.row?.counts || {};
  return (
    <>
      <Header
        eyebrow="MANAGEMENT OVERVIEW"
        title="Move the team forward"
        description="See the work, understand the results, and act where it matters."
        actions={
          <Link className="button" to="/work/tasks">
            <Plus size={18} />
            Assign a task
          </Link>
        }
      />
      <div className="admin-banner">
        <div>
          <div className="eyebrow">COMPANY MONTHLY TARGET</div>
          <h2>
            {money(target.row?.achieved)}{" "}
            <span>/ {money(target.row?.target)}</span>
          </h2>
          <p>
            {target.row
              ? label(
                  targetMetrics(target.row.target, target.row.achieved, month)
                    .paceStatus,
                )
              : "Set a company target to track progress."}
          </p>
        </div>
        <Link to="/targets" className="button light">
          Manage targets <ArrowUpRight size={17} />
        </Link>
      </div>
      <ErrorBox message={performance.error || target.error || sync.error} />
      <div className="metrics-grid">
        <Metric
          label="Tasks completed"
          value={`${c.tasksCompleted || 0} / ${c.tasks || 0}`}
          note="Work created this month"
        />
        <Metric
          label="Leads converted"
          value={c.leadsConverted || 0}
          note={`${c.leadsContacted || 0} leads contacted`}
          accent
        />
        <Metric
          label="Campaign orders"
          value={c.campaignOrders || 0}
          note={`${c.campaignContacts || 0} contacts made`}
        />
        <Metric
          label="Opportunities won"
          value={c.opportunitiesWon || 0}
          note={`${c.opportunitiesHandled || 0} handled`}
        />
      </div>
      <div className="two-columns">
        <Panel title="Needs your attention">
          <Link className="alert-row" to="/work/tasks">
            <span className="alert-dot red" />
            <div>
              <b>{work.row?.counts?.overdueTasks || 0} overdue tasks</b>
              <p>Review ownership and the next action.</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link className="alert-row" to="/work/collectionPromises">
            <span className="alert-dot amber" />
            <div>
              <b>{c.promisesMissed || 0} missed promises</b>
              <p>Review collection follow-through.</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link className="alert-row" to="/work/complaints">
            <span className="alert-dot purple" />
            <div>
              <b>{c.complaintsOpen || 0} unresolved issues</b>
              <p>Protect the customer relationship.</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        </Panel>
        <Panel title="Team outcomes">
          <div className="progress-stat">
            <span>Customer requirements resolved</span>
            <b>{c.requirementsResolved || 0}</b>
          </div>
          <div className="progress-stat">
            <span>Dormant customers reactivated</span>
            <b>{c.reactivated || 0}</b>
          </div>
          <div className="progress-stat">
            <span>Collections followed up</span>
            <b>{c.collectionActions || 0}</b>
          </div>
          <Link className="text-button" to="/performance">
            Explore team performance →
          </Link>
        </Panel>
      </div>
      <div className="freshness-strip">
        <span className="status-dot" />
        <span>Financial data synced: {when(sync.row?.lastSuccessfulSync)}</span>
        <Link to="/sync">
          CISapp Sync <ArrowUpRight size={14} />
        </Link>
      </div>
      <p className="subtle">
        Execution metrics summarize records created in {month}; later status
        updates stay with their original monthly cohort.
      </p>
    </>
  );
}
