import { useState } from "react";
import { useDocument, useRows, useAuth } from "../hooks";
import {
  Header,
  Panel,
  ErrorBox,
  Empty,
  PageEnd,
  Modal,
  Badge,
} from "../components/ui";
import { command, clearCache, type Row } from "../services/sales";
import { branchIds } from "../../shared/schema";
export default function Settings() {
  const users = useRows("users");
  const settings = useDocument("settings", "general");
  const [edit, setEdit] = useState<Row | null | undefined>();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  return (
    <>
      <Header
        eyebrow="ADMINISTRATION"
        title="People & workspace"
        description="Give everyone clear ownership and the right access."
        actions={<button onClick={() => setEdit(null)}>Add team member</button>}
      />
      <ErrorBox message={users.error || settings.error || error} />
      {success && <div className="success">{success}</div>}
      <Panel title="Team access">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Access</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    <small>{u.uid}</small>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <Badge value={u.active ? "ACTIVE" : "DISABLED"} />
                  </td>
                  <td>
                    <button className="secondary" onClick={() => setEdit(u)}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PageEnd state={users} />
      </Panel>
      <Panel title="Workspace">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await command("saveSettings", { businessName: name });
              settings.reload();
              setSuccess("Workspace name saved.");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Business name
            <input
              required
              value={name}
              placeholder={settings.row?.businessName || "Your business"}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button>Save workspace</button>
        </form>
      </Panel>
      <Panel title="Access and setup">
        <p>
          Staff can access assigned work and their own performance and target
          summaries. Customer financial intelligence is reserved for Admin.
        </p>
        <p>
          Initial Admin access is provisioned with the Salesapp setup script.
          Users cannot grant themselves access or create an Admin role from the
          sign-in screen.
        </p>
        <p>
          Use Firebase Authenticationâ€™s password reset workflow to replace an
          initial password. Customer assignments are managed on each customer
          page.
        </p>
      </Panel>
      {edit !== undefined && (
        <UserForm
          user={edit || undefined}
          onClose={() => setEdit(undefined)}
          onSaved={() => {
            clearCache();
            users.reload();
          }}
        />
      )}
    </>
  );
}
function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user?: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    uid: user?.uid || "",
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    role: user?.role || "Staff",
    active: user?.active ?? true,
    branchId: user?.branchId || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={user ? "Manage team member" : "Add team member"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await command("saveUser", form);
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
        {["name", "email", ...(!user ? ["password"] : []), "branchId"].map(
          (k) => (
            <label key={k}>
              {k === "branchId"
                ? "Branch ID"
                : k === "password"
                  ? `Initial password (${form.role === "Staff" ? 6 : 12}+ characters)`
                  : k === "name"
                    ? "Name"
                    : "Email"}
              {k === "branchId" ? (
                <select
                  required
                  value={form.branchId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, branchId: e.target.value }))
                  }
                >
                  <option value="">Select a branch</option>
                  {branchIds.map((branchId) => (
                    <option key={branchId} value={branchId}>{branchId}</option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  type={k === "password" ? "password" : k === "email" ? "email" : "text"}
                  disabled={!!user && k === "email"}
                  value={(form as any)[k]}
                  minLength={k === "password" ? form.role === "Staff" ? 6 : 12 : undefined}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                />
              )}
            </label>
          ),
        )}
        <label>
          Role
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option>Staff</option>
            <option>Admin</option>
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) =>
              setForm((f) => ({ ...f, active: e.target.checked }))
            }
          />
          Access enabled
        </label>
        <div className="form-footer">
          <button disabled={busy}>{busy ? "Savingâ€¦" : "Save access"}</button>
        </div>
      </form>
    </Modal>
  );
}

