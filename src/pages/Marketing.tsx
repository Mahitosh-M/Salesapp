import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Users,
  MessageSquare,
  Target,
  BarChart3,
} from "lucide-react";
import { useDocument, useRows } from "../hooks";
import {
  Header,
  Panel,
  Metric,
  ErrorBox,
  Empty,
  PageEnd,
} from "../components/ui";
import { today, label } from "../../shared/schema";
export default function Marketing() {
  const state = useDocument("businessPerformance", today().slice(0, 7));
  const campaigns = useRows("campaigns");
  const c = state.row?.counts || {};
  const objections = Object.entries(c)
    .filter(([k]) => k.startsWith("objection_"))
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  return (
    <>
      <Header
        eyebrow="MARKETING"
        title="Make your outreach matter"
        description="Build focused audiences. Learn from every conversation."
        actions={
          <Link className="button" to="/work/campaigns">
            Create a campaign <ArrowUpRight size={17} />
          </Link>
        }
      />
      <div className="focus-grid marketing-links">
        {[
          ["Campaigns", "campaigns", Target],
          ["Message templates", "messageTemplates", MessageSquare],
          ["Reactivation", "reactivations", Users],
          ["Lost sales & objections", "objections", BarChart3],
        ].map(([title, path, Icon]: any) => (
          <Link className="focus-tile" to={`/work/${path}`} key={path}>
            <Icon size={21} />
            <span>{title}</span>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </div>
      <ErrorBox message={state.error || campaigns.error} />
      <div className="two-columns">
        <Panel title="Suggested next actions">
          <div className="suggestion">
            <b>{c.requirementsOpen || 0} customer requirements remain open</b>
            <p>Follow up on availability and inform the customer.</p>
            <Link to="/work/customerRequirements">Review requirements →</Link>
          </div>
          <div className="suggestion">
            <b>
              {Math.max(
                0,
                (c.campaignAssigned || 0) - (c.campaignContacts || 0),
              )}{" "}
              campaign contacts have not been reached
            </b>
            <p>Review assignment and plan the next conversation.</p>
            <Link to="/work/campaignAssignments">Review campaign work →</Link>
          </div>
          <div className="suggestion">
            <b>
              {Math.max(0, (c.reactivations || 0) - (c.reactivated || 0))}{" "}
              reactivation records to review
            </b>
            <p>Build a focused audience from tracked dormant customers.</p>
            <Link to="/work/reactivations">Review reactivation →</Link>
          </div>
        </Panel>
        <Panel title="What is getting in the way?">
          {objections.length ? (
            objections.map(([key, count]) => (
              <div className="objection-row" key={key}>
                <span>{label(key.replace("objection_", ""))}</span>
                <div className="bar">
                  <i
                    style={{
                      width: `${(Number(count) / Math.max(1, Number(objections[0][1]))) * 100}%`,
                    }}
                  />
                </div>
                <b>{String(count)}</b>
              </div>
            ))
          ) : (
            <Empty
              title="No objections recorded"
              text="Your team’s field feedback will reveal patterns here."
            />
          )}
          <Link className="text-button" to="/work/competitorNotes">
            Consolidated competitor notes →
          </Link>
        </Panel>
      </div>
      <Panel title="Campaign outcome tracking">
        {campaigns.rows.map((r) => (
          <CampaignSummary key={r.id} id={r.id} title={r.title} />
        ))}
        <PageEnd state={campaigns} />
        {!campaigns.rows.length && (
          <Empty
            title="Your next campaign starts here"
            text="Choose an audience: collections, area, branch, staff, requirements, dormant customers, good payment, or reorder opportunities."
          />
        )}
      </Panel>
      <p className="subtle">
        Suggestions use Salesapp monthly counters. Dormant and reorder segments
        use tracked reactivation/opportunity records, not invented CISapp
        scores.
      </p>
    </>
  );
}
function CampaignSummary({ id, title }: { id: string; title: string }) {
  const s = useDocument("campaignPerformance", id);
  const c = s.row?.counts || {};
  return (
    <div className="campaign-summary">
      <h3>{title}</h3>
      <ErrorBox message={s.error} />
      <div className="metrics-grid">
        <Metric label="Assigned" value={c.campaignAssigned || 0} />
        <Metric label="Contacted" value={c.campaignContacts || 0} />
        <Metric label="Orders" value={c.campaignOrders || 0} />
        <Metric
          label="Conversion"
          value={`${c.campaignContacts ? Math.round(((c.campaignOrders || 0) / c.campaignContacts) * 100) : 0}%`}
        />
      </div>
    </div>
  );
}
