import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Phone,
  MessageCircle,
  MapPin,
  ArrowUpRight,
  Search,
  Plus,
  UserRound,
} from "lucide-react";
import { useAuth, useRows, useDocument } from "../hooks";
import {
  Header,
  Panel,
  Empty,
  ErrorBox,
  Loading,
  PageEnd,
  money,
  when,
  Badge,
  Modal,
} from "../components/ui";
import { RecordEditor, Picker } from "../components/RecordEditor";
import { command, clearCache, type Row } from "../services/sales";
import {
  branchIds,
  today,
  renderTemplate,
  whatsappUrl,
  type Data,
} from "../../shared/schema";
export default function Customers() {
  const state = useRows("staffCustomers");
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const visibleCustomers = state.rows.filter((r) =>
    [r.name, r.area, r.phone]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <Header
        eyebrow="RELATIONSHIPS"
        title="Customers"
        description="A useful conversation starts with a clear next step."
      />
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search loaded customers"
            placeholder="Search loaded names, areas, or phone numbersâ€¦"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="subtle">{state.rows.length} loaded</span>
      </div>
      <ErrorBox message={state.error} />
      {state.loading && !state.rows.length ? (
        <Loading />
      ) : (
        <div className="customer-grid">
          {profile?.role === "Admin" ? (
            <AdminCustomerCards customers={visibleCustomers} />
          ) : (
            visibleCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                assignedStaffName={customer.assignedStaffId === profile?.uid ? profile?.name || "Assigned Staff" : "Unassigned"}
              />
            ))
          )}
        </div>
      )}
      {!state.loading && !state.rows.length && (
        <Empty
          title="Your customers will appear here"
          text="An Admin imports CISapp customers and assigns them to the team."
        />
      )}
      <PageEnd state={state} />
    </>
  );
}

function AdminCustomerCards({ customers }: { customers: Row[] }) {
  const users = useRows("users");
  const staffNames = new Map(users.rows.map((user) => [user.id, user.name]));
  return customers.map((customer) => (
    <CustomerCard
      key={customer.id}
      customer={customer}
      assignedStaffName={customer.assignedStaffId ? staffNames.get(customer.assignedStaffId) || "Staff account unavailable" : "Unassigned"}
    />
  ));
}

function CustomerCard({ customer, assignedStaffName }: { customer: Row; assignedStaffName: string }) {
  return (
    <Link className="customer-card" to={`/customers/${customer.id}`}>
      <div className="row-between">
        <div className="avatar">{customer.name.slice(0, 2).toUpperCase()}</div>
        <ArrowUpRight size={20} />
      </div>
      <h3>{customer.name}</h3>
      <p><MapPin size={14} />{customer.area || "Area not set"}</p>
      <p><UserRound size={14} /><b>Assigned Staff:</b> {assignedStaffName}</p>
      <div className="customer-footer">
        <span>{customer.phone || "No phone number"}</span>
        <span className="dot-label">{customer.active ? "Active" : "Source unavailable"}</span>
      </div>
    </Link>
  );
}

export function CustomerDetail() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const customer = useDocument("staffCustomers", id);
  const collection = useDocument("collectionSnapshots", id);
  const activity = useRows(
    "activities",
    [["customerId", "==", id]],
    ["createdAt", "desc"],
  );
  const requirements = useRows("customerRequirements", [
    ["customerId", "==", id],
  ]);
  const promises = useRows("collectionPromises", [["customerId", "==", id]]);
  const followups = useRows("followUps", [["customerId", "==", id]]);
  const [editor, setEditor] = useState<{ kind: string; preset?: Data } | null>(
    null,
  );
  const [assign, setAssign] = useState(false);
  const [message, setMessage] = useState(false);
  if (customer.loading) return <Loading />;
  if (customer.error) return <ErrorBox message={customer.error} />;
  const c = customer.row;
  if (!c) return <Empty title="Customer unavailable" />;
  const col = collection.row;
  const reload = () => {
    activity.reload();
    requirements.reload();
    promises.reload();
    followups.reload();
  };
  const open = (kind: string, preset: Data = {}) =>
    setEditor({
      kind,
      preset: {
        customerId: id,
        assignedStaffId: c.assignedStaffId || profile!.uid,
        ...preset,
      },
    });
  return (
    <>
      <Link className="back-link" to="/customers">
        â† Customers
      </Link>
      <Header
        eyebrow={c.area || "CUSTOMER"}
        title={c.name}
        description={c.phone || "No phone number recorded"}
        actions={
          profile?.role === "Admin" ? (
            <button className="secondary" onClick={() => setAssign(true)}>
              Assign customer
            </button>
          ) : null
        }
      />
      <div className="quick-actions">
        {c.phone && (
          <a className="button" href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>
            <Phone size={17} />
            Call
          </a>
        )}
        <button
          className="secondary"
          disabled={!c.phone}
          onClick={() => setMessage(true)}
        >
          <MessageCircle size={17} />
          WhatsApp
        </button>
        <button
          className="secondary"
          onClick={() => open("visits", { title: `Visit ${c.name}` })}
        >
          <MapPin size={17} />
          Plan visit
        </button>
        <button
          className="secondary"
          onClick={() =>
            open("followUps", { title: `Follow up with ${c.name}` })
          }
        >
          Schedule follow-up
        </button>
        <button
          className="secondary"
          onClick={() =>
            open("activities", {
              title: `Conversation with ${c.name}`,
              type: "CALL",
            })
          }
        >
          Log interaction
        </button>
      </div>
      {!c.assignedStaffId && (
        <p className="notice">
          Assign this customer to a staff member before creating customer work.
        </p>
      )}
      <div className="two-columns">
        <Panel
          title="Collection"
          action={
            <button
              className="text-button"
              onClick={() =>
                open("collectionPromises", {
                  title: `Payment promise Â· ${c.name}`,
                })
              }
            >
              Add promise <Plus size={15} />
            </button>
          }
        >
          <ErrorBox message={collection.error} />
          <div className="collection-numbers">
            <div>
              <span>Outstanding</span>
              <strong>{money(col?.outstandingAmount)}</strong>
            </div>
            <div>
              <span>Overdue</span>
              <strong className="danger-text">
                {money(col?.overdueAmount)}
              </strong>
            </div>
          </div>
          <div className="detail-row">
            <span>Next due date</span>
            <b>{col?.dueDate || "Not available"}</b>
          </div>
          <div className="detail-row">
            <span>Oldest overdue date</span>
            <b>{col?.oldestDueDate || "Not available"}</b>
          </div>
          <p className="freshness">
            Updated {when(col?.syncedAt)}
            <br />
            Balance calculated {when(col?.financialSourceUpdatedAt)} Â· Overdue
            calculated {when(col?.overdueSourceUpdatedAt)}
          </p>
          <p className="subtle">
            Payments are entered in CISapp. Verify recent payments before
            collecting.
          </p>
          {promises.rows.map((r) => (
            <div className="mini-row" key={r.id}>
              <span>
                {money(r.amount)} Â· {r.promiseDate}
              </span>
              <Badge value={r.status} />
            </div>
          ))}
          <ErrorBox message={promises.error} />
        </Panel>
        <Panel
          title="Requirements"
          action={
            <button
              className="text-button"
              onClick={() =>
                open("customerRequirements", {
                  title: `Requirement Â· ${c.name}`,
                })
              }
            >
              Add <Plus size={15} />
            </button>
          }
        >
          {requirements.rows.length ? (
            requirements.rows.map((r) => (
              <div className="mini-row" key={r.id}>
                <div>
                  <b>{r.product}</b>
                  <small>{r.dueDate}</small>
                </div>
                <Badge value={r.status} />
              </div>
            ))
          ) : (
            <Empty
              title="No requirements yet"
              text="Capture a product or service the customer needs."
            />
          )}
          <ErrorBox message={requirements.error} />
          <Link className="text-button" to="/work/customerRequirements">
            Manage requirements â†’
          </Link>
        </Panel>
        <Panel title="Recent activity">
          {activity.rows.length ? (
            activity.rows.map((r) => (
              <div className="timeline-item" key={r.id}>
                <span className="timeline-dot" />
                <div>
                  <b>{r.type.replaceAll("_", " ")}</b>
                  <small>{when(r.createdAt)}</small>
                  <p>{r.notes || r.title}</p>
                  <Badge value={r.outcome || "RECORDED"} />
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="Start the conversation"
              text="Calls, visits, and follow-ups logged in Salesapp appear here."
            />
          )}
          <ErrorBox message={activity.error} />
          <PageEnd state={activity} />
        </Panel>
        <Panel title="Next follow-ups">
          {followups.rows
            .filter((r) => r.status === "PENDING")
            .map((r) => (
              <div className="mini-row" key={r.id}>
                <div>
                  <b>{r.title}</b>
                  <small>{r.dueDate}</small>
                </div>
                <Badge value={r.priority} />
              </div>
            ))}
          {!followups.rows.length && (
            <Empty
              title="No follow-up scheduled"
              text="Give this relationship a next step."
            />
          )}
          <ErrorBox message={followups.error} />
        </Panel>
      </div>
      {profile?.role === "Admin" && <AdminInsight id={id} />}
      {editor && (
        <RecordEditor
          kind={editor.kind}
          preset={editor.preset}
          onClose={() => setEditor(null)}
          onSaved={reload}
        />
      )}
      {assign && (
        <Assignment
          customer={c}
          onClose={() => setAssign(false)}
          onSaved={() => {
            customer.reload();
            collection.reload();
          }}
        />
      )}
      {message && (
        <Message
          customer={c}
          collection={col}
          onClose={() => setMessage(false)}
        />
      )}
    </>
  );
}
function AdminInsight({ id }: { id: string }) {
  const score = useDocument("adminCis_customerIntelligenceSummaries", id);
  const credit = useDocument("adminCis_customerCreditProfiles", id);
  const pc = useDocument("adminCis_pcBalances", id);
  const s = score.row?.payload;
  const c = credit.row?.payload;
  return (
    <Panel title="Admin intelligence Â· copied from CISapp">
      <ErrorBox message={score.error || credit.error || pc.error} />
      {!s ? (
        <p className="subtle">
          No stored intelligence summary is available yet.
        </p>
      ) : (
        <>
          <div className="metrics-grid">
            <div className="metric">
              <span>Intelligence score</span>
              <strong>{s.intelligenceScore ?? "â€”"}</strong>
              <small>
                {s.tier} Â· {s.riskLevel} risk
              </small>
            </div>
            <div className="metric">
              <span>Sales in source scoring period</span>
              <strong>{money(s.totalSales)}</strong>
            </div>
            <div className="metric">
              <span>Profit in source scoring period</span>
              <strong>{money(s.totalProfit)}</strong>
            </div>
            <div className="metric">
              <span>Available PC</span>
              <strong>{pc.row?.payload.availablePc ?? "â€”"}</strong>
            </div>
          </div>
          <p>{s.recommendedAction}</p>
          <p className="freshness">
            Source calculation: {when(s.calculatedAt)}
          </p>
        </>
      )}
      {c && (
        <div className="mini-row">
          <span>
            Credit: {c.creditStatus} Â· Approved {money(c.approvedCreditLimit)}
          </span>
          <span>Available {money(c.availableCredit)}</span>
        </div>
      )}
    </Panel>
  );
}
function Assignment({
  customer,
  onClose,
  onSaved,
}: {
  customer: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [owner, setOwner] = useState(customer.assignedStaffId || "");
  const [branch, setBranch] = useState(customer.branchId || "");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Assign customer" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await command("assignCustomer", {
              customerId: customer.id,
              assignedStaffId: owner,
              branchId: branch,
              month,
            });
            clearCache();
            onSaved();
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ErrorBox message={error} />
        <label>
          Staff owner
          <Picker kind="staff" value={owner} onChange={setOwner} />
        </label>
        <label>
          Branch ID
          <select required value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">Select a branch</option>
            {branchIds.map((branchId) => (
              <option key={branchId} value={branchId}>{branchId}</option>
            ))}
          </select>
        </label>
        <label>
          Target attribution month
          <input
            required
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <p className="notice">
          This assigns the entire selected monthâ€™s customer sales to this owner
          for targets. It does not identify the original invoice salesperson.
          Existing work keeps its assigned owner.
        </p>
        <div className="form-footer">
          <button disabled={busy}>
            {busy ? "Savingâ€¦" : "Save assignment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Message({
  customer,
  collection,
  onClose,
}: {
  customer: Row;
  collection: Row | null;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const templates = useRows("messageTemplates", [["status", "==", "APPROVED"]]);
  const [selected, setSelected] = useState("");
  const template = templates.rows.find((r) => r.id === selected);
  const body = template
    ? renderTemplate(template.body, {
        customerName: customer.name,
        amount:
          typeof collection?.overdueAmount === "number"
            ? money(collection.overdueAmount)
            : "",
        dueDate: collection?.dueDate || "",
        staffName: profile!.name,
      })
    : "";
  const url = whatsappUrl(customer.whatsapp || customer.phone, body);
  return (
    <Modal title="WhatsApp message" onClose={onClose}>
      <label>
        Approved template
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a template</option>
          {templates.rows.map((r) => (
            <option value={r.id} key={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <ErrorBox message={templates.error} />
      {body && <div className="message-preview">{body}</div>}
      {!templates.loading && !templates.rows.length && (
        <p className="notice">
          An Admin can create and approve message templates in Marketing.
        </p>
      )}
      <PageEnd state={templates} />
      <div className="form-footer">
        {url && body ? (
          <a className="button" target="_blank" rel="noreferrer" href={url}>
            Open WhatsApp
          </a>
        ) : (
          <button disabled>Select a valid template</button>
        )}
      </div>
      <p className="subtle">
        Review and send in WhatsApp, then log the interaction in Salesapp.
      </p>
    </Modal>
  );
}




