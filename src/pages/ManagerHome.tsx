import { useState } from "react";
import { CheckCircle2, ListTodo, Users, Wallet } from "lucide-react";
import { useAuth, useRows } from "../hooks";
import { RecordEditor } from "../components/RecordEditor";
import {
  Header,
  Panel,
  ErrorBox,
  PageEnd,
  Badge,
  Empty,
  Metric,
  money,
} from "../components/ui";
import { type Row } from "../services/sales";
import { collectionDue } from "../../shared/collections";
import { today } from "../../shared/schema";

export default function ManagerHome() {
  const { profile, logout } = useAuth();
  const [tab, setTab] = useState("tasks");
  const tasks = useRows("tasks");
  const team = useRows(
    "users",
    [],
    undefined,
    tab === "team" || tab === "collections",
  );
  const customers = useRows(
    "collectionSnapshots",
    [],
    undefined,
    tab === "collections",
  );
  const staffCustomers = useRows(
    "staffCustomers",
    [],
    undefined,
    tab === "followups",
  );
  const [edit, setEdit] = useState<Row | null | undefined>();
  const followups = tasks.rows.filter(
    (task) => task.sourceType === "followUps",
  );
  const openTasks = tasks.rows.filter(
    (task) => !["COMPLETED", "CANCELLED", "PAID"].includes(String(task.status)),
  ).length;
  const overdueTasks = tasks.rows.filter(
    (task) =>
      String(task.dueDate || "") < today() &&
      !["COMPLETED", "CANCELLED", "PAID"].includes(String(task.status)),
  ).length;
  const collectionTasks = tasks.rows.filter((task) =>
    String(task.title || "").startsWith("Collect "),
  ).length;
  const collectionStatus = (task: Row) =>
    task.status === "UNREACHABLE"
      ? `UNREACHABLE DAYS: ${task.unreachableDays || 1}`
      : task.status === "PROMISED"
        ? `PROMISED: ${money(task.collectionAmount)} by ${task.collectionPromiseDate || "date not set"}`
        : "";
  return (
    <main className="manager-workspace">
      <Header
        eyebrow={`${profile?.branchId || "BRANCH"} MANAGEMENT`}
        title="Move your branch forward"
        description="See branch work, assign the next action, and keep collections moving."
        actions={<button onClick={() => setEdit(null)}>Assign task</button>}
      />
      <div className="admin-banner">
        <div>
          <div className="eyebrow">
            {profile?.branchId || "BRANCH"} WORKSPACE
          </div>
          <h2>
            {openTasks} <span>open tasks</span>
          </h2>
          <p>
            {overdueTasks
              ? `${overdueTasks} task${overdueTasks === 1 ? "" : "s"} need attention today.`
              : "Your branch has no overdue tasks."}
          </p>
        </div>
        <button className="light" onClick={logout}>
          Sign out
        </button>
      </div>
      <ErrorBox
        message={
          tasks.error || team.error || customers.error || staffCustomers.error
        }
      />
      <div className="metrics-grid">
        <Metric
          label="Open tasks"
          value={openTasks}
          note="Assigned to branch Staff"
        />
        <Metric
          label="Overdue tasks"
          value={overdueTasks}
          note="Need a next action"
          accent
        />
        <Metric
          label="Follow-ups"
          value={followups.length}
          note="Generated for branch customers"
        />
        <Metric
          label="Collection work"
          value={collectionTasks}
          note="Tasks requiring payment follow-up"
        />
      </div>
      <div className="toolbar">
        <button onClick={() => setTab("tasks")}>Branch tasks</button>
        <button onClick={() => setTab("followups")}>Follow-ups</button>
        <button onClick={() => setTab("collections")}>Collections</button>
        <button onClick={() => setTab("team")}>Branch Staff</button>
      </div>
      {tab === "tasks" && (
        <div className="two-columns">
          <Panel title="Branch tasks">
            {tasks.rows.length ? (
              <div className="record-list">
                {tasks.rows.map((task) => (
                  <article
                    className={`record-card followup-card status-${String(task.status || "pending").toLowerCase()}`}
                    key={task.id}
                  >
                    <div>
                      <Badge value={task.status} />
                      <h3>{task.title}</h3>
                      {collectionStatus(task) && (
                        <p className="last-order-highlight">
                          {collectionStatus(task)}
                        </p>
                      )}
                      <p>
                        {task.assignedStaffName} · Due {task.dueDate}
                      </p>
                      {task.staffNote || task.notes ? (
                        <p>{task.staffNote || task.notes}</p>
                      ) : null}
                    </div>
                    {task.sourceType === "ADMIN" && (
                      <button onClick={() => setEdit(task)}>
                        Update / delegate
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="No branch tasks"
                text="Assign a task when a Staff member needs a clear next action."
              />
            )}
            <PageEnd state={tasks} />
          </Panel>
          <Panel title="Needs attention">
            <div className="alert-row">
              <span className="alert-dot red" />
              <div>
                <b>{overdueTasks} overdue tasks</b>
                <p>Review ownership and set the next action.</p>
              </div>
              <ListTodo size={18} />
            </div>
            <div className="alert-row">
              <span className="alert-dot amber" />
              <div>
                <b>{collectionTasks} collection tasks</b>
                <p>Check payment promises and current due amounts.</p>
              </div>
              <Wallet size={18} />
            </div>
            <div className="alert-row">
              <span className="alert-dot purple" />
              <div>
                <b>{followups.length} follow-ups</b>
                <p>Keep customers with no recent order moving.</p>
              </div>
              <CheckCircle2 size={18} />
            </div>
          </Panel>
        </div>
      )}
      {tab === "followups" && (
        <Panel title="Branch follow-ups">
          <div className="record-list">
            {followups.map((row) => (
              <article
                className={`record-card followup-card status-${String(row.status || "").toLowerCase()}`}
                key={row.id}
              >
                <h3>{row.title}</h3>
                <p className="followup-highlight last-order-highlight">
                  Last order:{" "}
                  {(() => {
                    const c = staffCustomers.rows.find(
                      (x) => x.id === row.customerId,
                    );
                    return c?.lastOrderDate
                      ? `${Math.max(0, Math.floor((Date.parse(today() + "T00:00:00Z") - Date.parse(String(c.lastOrderDate) + "T00:00:00Z")) / 86400000))} days`
                      : "unknown";
                  })()}
                </p>
                <Badge value={row.status} />
                {row.staffNote || row.notes ? (
                  <p>{row.staffNote || row.notes}</p>
                ) : null}
              </article>
            ))}
          </div>
          <PageEnd state={tasks} />
        </Panel>
      )}
      {tab === "collections" && (
        <Panel title="Collections">
          {customers.rows
            .map((customer) => ({
              customer,
              due: collectionDue(customer.invoices || [], today()),
            }))
            .filter((row) => row.due.amount > 0)
            .map(({ customer, due }) => (
              <article
                className="record-card followup-card status-promised"
                key={customer.id}
              >
                <div>
                  <h3>{customer.name}</h3>
                  <p className="last-order-highlight">
                    {money(due.amount)} to collect
                  </p>
                </div>
              </article>
            ))}
          <PageEnd state={customers} />
        </Panel>
      )}
      {tab === "team" && (
        <Panel title="Branch Staff">
          {team.rows.map((staff) => (
            <article className="record-card" key={staff.id}>
              <div>
                <h3>{staff.name}</h3>
                <p>
                  {staff.email} · {staff.active ? "Active" : "Disabled"}
                </p>
              </div>
              <Users size={18} />
            </article>
          ))}
          <PageEnd state={team} />
        </Panel>
      )}
      <nav className="manager-mobile-nav">
        <button onClick={() => setTab("tasks")}>Tasks</button>
        <button onClick={() => setTab("followups")}>Follow-ups</button>
        <button onClick={() => setTab("collections")}>Collections</button>
        <button onClick={() => setTab("team")}>Staff</button>
      </nav>
      {edit !== undefined && (
        <RecordEditor
          kind="tasks"
          record={edit || undefined}
          preset={edit ? {} : { assignedStaffId: "" }}
          onClose={() => setEdit(undefined)}
          onSaved={tasks.reload}
        />
      )}
    </main>
  );
}
