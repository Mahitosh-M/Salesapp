import { useState } from "react";
import {
  modules,
  priorities,
  label,
  today,
  type Data,
} from "../../shared/schema";
import { useAuth, useRows } from "../hooks";
import { command, clearCache, type Row } from "../services/sales";
import { Modal, ErrorBox } from "./ui";
function Picker({
  kind,
  value,
  onChange,
  required = false,
}: {
  kind: "customer" | "lead" | "staff";
  value: string;
  onChange: (value: string, row?: Row) => void;
  required?: boolean;
}) {
  const { profile } = useAuth();
  const state = useRows(
    kind === "customer"
      ? "staffCustomers"
      : kind === "lead"
        ? "leads"
        : "users",
    kind === "customer" ? [["active", "==", true]] : [],
  );
  return (
    <>
      <select
        required={required}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value,
            state.rows.find((r) => r.id === e.target.value),
          )
        }
      >
        <option value="">Select {kind}</option>
        {value && !state.rows.some((r) => r.id === value) && (
          <option value={value}>{value}</option>
        )}
        {state.rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name || r.title || r.email}
          </option>
        ))}
      </select>
      {state.hasMore && (
        <button type="button" className="text-button" onClick={state.loadMore}>
          Load more {kind}s
        </button>
      )}
      <ErrorBox message={state.error} />
    </>
  );
}
export { Picker };
export function RecordEditor({
  kind,
  record,
  preset = {},
  onClose,
  onSaved,
}: {
  kind: string;
  record?: Row;
  preset?: Data;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const spec = modules[kind];
  const [form, setForm] = useState<Data>(() => ({
    title: "",
    status: spec.statuses[0],
    priority: "NORMAL",
    assignedStaffId: profile!.uid,
    ...Object.fromEntries(
      spec.fields.map((f) => [
        f.key,
        f.type === "date" && f.required
          ? today()
          : f.required && f.options
            ? f.options[0]
            : "",
      ]),
    ),
    ...record,
    ...preset,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [id] = useState(record?.id || crypto.randomUUID());
  const change = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const keys = [
        "title",
        "status",
        "priority",
        "assignedStaffId",
        ...spec.fields.map((f) => f.key),
      ];
      const payload = Object.fromEntries(keys.map((k) => [k, form[k] ?? ""]));
      await command("saveSalesRecord", { kind, id, record: payload });
      clearCache();
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${record ? "Update" : "New"} ${spec.singular.toLowerCase()}`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <div className="form-grid">
          <label className="span-2">
            {kind === "leads"
              ? "Business name"
              : kind === "campaigns"
                ? "Campaign name"
                : "Title"}
            <input
              autoFocus
              required
              maxLength={180}
              value={form.title}
              onChange={(e) => change("title", e.target.value)}
            />
          </label>
          <label>
            Status
            <select
              aria-label="Status"
              value={form.status}
              onChange={(e) => change("status", e.target.value)}
            >
              {spec.statuses
                .filter((s) => profile?.role === "Admin" || s !== "CONVERTED")
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Priority"
              value={form.priority}
              onChange={(e) => change("priority", e.target.value)}
            >
              {priorities.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {profile?.role === "Admin" && (
            <label className="span-2">
              Assigned owner
              <Picker
                kind="staff"
                value={form.assignedStaffId}
                onChange={(v) => change("assignedStaffId", v)}
              />
            </label>
          )}
          {spec.fields
            .filter(
              (f) => f.key !== "linkedCustomerId" || profile?.role === "Admin",
            )
            .map((f) => (
              <label
                key={f.key}
                className={f.type === "textarea" ? "span-2" : ""}
              >
                {f.label}
                {f.required ? " *" : ""}
                {["customer", "lead"].includes(f.type || "") ? (
                  <>
                    <Picker
                      required={f.required}
                      kind={f.type as "customer" | "lead"}
                      value={form[f.key]}
                      onChange={(v, r) =>
                        setForm((old) => ({
                          ...old,
                          [f.key]: v,
                          ...(f.key === "customerId" && r?.assignedStaffId
                            ? { assignedStaffId: r.assignedStaffId }
                            : {}),
                        }))
                      }
                    />
                    {!f.required && form[f.key] && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => change(f.key, "")}
                      >
                        Clear selection
                      </button>
                    )}
                  </>
                ) : f.type === "select" ? (
                  <select
                    required={f.required}
                    value={form[f.key]}
                    onChange={(e) => change(f.key, e.target.value)}
                  >
                    <option value="">Select an option</option>
                    {f.options?.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    required={f.required}
                    rows={3}
                    maxLength={4000}
                    value={form[f.key]}
                    onChange={(e) => change(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    required={f.required}
                    type={
                      f.type === "number"
                        ? "number"
                        : f.type === "date"
                          ? "date"
                          : "text"
                    }
                    min={f.type === "number" ? 0.01 : undefined}
                    step={f.type === "number" ? "0.01" : undefined}
                    value={form[f.key]}
                    onChange={(e) =>
                      change(
                        f.key,
                        f.type === "number" && e.target.value !== ""
                          ? Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  />
                )}
              </label>
            ))}
        </div>
        {kind === "leads" && form.status === "READY_FOR_CISAPP_CREATION" && (
          <p className="notice">
            Create the customer through the existing CISapp workflow. After
            synchronization, an Admin can link the imported customer here.
          </p>
        )}
        {kind === "collectionPromises" && (
          <p className="notice">
            This records a promise, not a payment. Verify payments in CISapp
            before marking a promise as kept.
          </p>
        )}
        {kind === "messageTemplates" && (
          <p className="notice">
            Available variables:{" "}
            {"{{customerName}}, {{amount}}, {{dueDate}}, {{staffName}}"}
          </p>
        )}
        <div className="form-footer">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button disabled={busy}>
            {busy ? "Saving…" : "Save " + spec.singular.toLowerCase()}
          </button>
        </div>
      </form>
    </Modal>
  );
}
