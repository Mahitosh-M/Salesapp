import { useState } from "react";
import { useAuth, useRows } from "../hooks";
import {
  Header,
  Panel,
  Empty,
  ErrorBox,
  PageEnd,
  Ratio,
  Metric,
} from "../components/ui";
import { today } from "../../shared/schema";
export default function Performance() {
  const { profile } = useAuth();
  const [month, setMonth] = useState(today().slice(0, 7));
  const state = useRows("staffPerformance", [["month", "==", month]]);
  return (
    <>
      <Header
        eyebrow="EXECUTION & EFFECTIVENESS"
        title={
          profile?.role === "Admin" ? "Team performance" : "My performance"
        }
        description="Understand the difference between being active and making progress."
      />
      <div className="toolbar">
        <label>
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>
      <ErrorBox message={state.error} />
      {state.rows.map((r) => {
        const c = r.counts || {};
        return (
          <Panel
            title={
              profile?.role === "Staff"
                ? profile.name
                : r.staffName || r.staffId
            }
            key={r.id}
          >
            <div className="performance-columns">
              <section>
                <h3>Activity</h3>
                {[
                  ["Calls logged", "calls"],
                  ["Visits completed", "visitsCompleted"],
                  ["Collections followed", "collectionActions"],
                  ["Follow-ups completed", "followUpsCompleted"],
                  ["Leads contacted", "leadsContacted"],
                  ["Campaign contacts", "campaignContacts"],
                  ["Opportunities handled", "opportunitiesHandled"],
                  ["Tasks completed", "tasksCompleted"],
                  ["Overdue tasks", "tasksOverdue"],
                ].map(([name, key]) => (
                  <div className="detail-row" key={key}>
                    <span>{name}</span>
                    <b>{c[key] || 0}</b>
                  </div>
                ))}
              </section>
              <section>
                <h3>Results</h3>
                {[
                  ["Leads converted", "leadsConverted"],
                  ["Opportunities won", "opportunitiesWon"],
                  ["Campaign orders", "campaignOrders"],
                  ["Requirements resolved", "requirementsResolved"],
                  ["Customers reactivated", "reactivated"],
                ].map(([name, key]) => (
                  <div className="detail-row" key={key}>
                    <span>{name}</span>
                    <b>{c[key] || 0}</b>
                  </div>
                ))}
                <h3 className="space-top">Effectiveness</h3>
                <div className="detail-row">
                  <span>Follow-up completion</span>
                  <Ratio
                    value={c.followUpsCompleted || 0}
                    total={c.followUps || 0}
                  />
                </div>
                <div className="detail-row">
                  <span>Lead conversion</span>
                  <Ratio
                    value={c.leadsConverted || 0}
                    total={c.leadsContacted || 0}
                  />
                </div>
                <div className="detail-row">
                  <span>Campaign conversion</span>
                  <Ratio
                    value={c.campaignOrders || 0}
                    total={c.campaignContacts || 0}
                  />
                </div>
              </section>
            </div>
          </Panel>
        );
      })}
      {!state.loading && !state.rows.length && (
        <Empty
          title="A new month of possibilities"
          text="Meaningful activity and outcomes will build your performance summary."
        />
      )}
      <PageEnd state={state} />
      <p className="subtle">
        Monthly summaries group work by its creation month. Results update when
        that work progresses. Collection actions measure follow-up, not money
        received.
      </p>
    </>
  );
}
