import { BookOpen, CircleHelp } from "lucide-react";
import { Header, Panel } from "../components/ui";
import { label, modules } from "../../shared/schema";

const pages = [
  [
    "Overview",
    "See company targets, completed work, overdue tasks, and sales outcomes.",
    "Use it every morning to decide where the team needs attention.",
  ],
  [
    "Customers",
    "See customers imported from CISapp and assign each customer to a staff member.",
    "Open a customer to call, message, plan a visit, record a promise, or review Admin-only details.",
  ],
  [
    "Leads",
    "Record new prospects before they become CISapp customers.",
    "Move the status as the conversation progresses; an Admin links the customer when converted.",
  ],
  [
    "Tasks",
    "Create and assign clear actions with a priority and due date.",
    "Refresh overdue items when needed and use completion to measure follow-through.",
  ],
  [
    "Collections",
    "Shows only customers whose current outstanding balance is greater than zero.",
    "Create follow-up tasks or record a payment promise; actual payments stay in CISapp.",
  ],
  [
    "Follow-ups",
    "Schedule the next contact after a call, message, or meeting.",
    "Complete it with an outcome so the next action is clear.",
  ],
  [
    "Visits",
    "Plan customer visits manually or use visits created 10 days after the last order.",
    "Record the purpose and result; a new order cancels an obsolete pending automatic visit.",
  ],
  [
    "Opportunities",
    "Track reorder, upsell, product, and reactivation opportunities.",
    "Assign an owner, recommended action, due date, and final result.",
  ],
  [
    "Requirements",
    "Record products or services requested by customers.",
    "Update availability and close the requirement when ordered or resolved.",
  ],
  [
    "Targets",
    "Set monthly targets for staff, branches, or the whole business.",
    "Achievement comes from synchronized CISapp summaries and remains unavailable when source data is incomplete.",
  ],
  [
    "Performance",
    "Compares activity such as calls and visits with results such as orders and conversions.",
    "Use the month selector to review staff execution without allowing staff to edit totals.",
  ],
  [
    "Marketing",
    "Create campaigns, choose an audience, approve messages, and review objections.",
    "Assign campaign pages in small batches to stay within the Firebase free quota.",
  ],
  [
    "CISapp Sync",
    "Copies approved customer summaries and last-order dates from CISapp into Salesapp.",
    "Connect an existing CISapp Admin, keep the page open, and use Sync now after the first import.",
  ],
  [
    "People & settings",
    "Create Staff accounts, choose roles, branches, and whether access is active.",
    "Staff passwords may be six characters; use Firebase Console for password resets or Auth account deletion.",
  ],
] as const;

const commonFields = [
  [
    "Title",
    "A short name that tells the team what the record or action is about.",
  ],
  [
    "Status",
    "The current stage; update it whenever work moves forward or closes.",
  ],
  [
    "Priority",
    "Urgent and High records appear ahead of normal work in the daily queue.",
  ],
  [
    "Owner",
    "The staff member responsible for the customer and the next action.",
  ],
  [
    "Customer",
    "Links the work to an assigned CISapp customer and its history.",
  ],
  ["Lead", "Links the work to a prospect that has not yet become a customer."],
  [
    "Due date",
    "The date the action should be completed; older open work becomes overdue.",
  ],
  [
    "Next follow-up",
    "Creates the next follow-up so a conversation does not stop without a date.",
  ],
  [
    "Notes",
    "A short factual record of what happened and what should happen next.",
  ],
] as const;

export default function AdminGuide() {
  return (
    <>
      <Header
        eyebrow="ADMIN HELP"
        title="How Salesapp works"
        description="A simple reference for every page and the information you enter."
      />
      <Panel title="Admin: first setup and daily routine">
        <div className="guide-card">
          <h3>First setup</h3>
          <p>Open <b>CISapp Sync</b>, connect the CISapp Admin account, and run Initial import. Then open <b>People & settings</b>, add each Staff member, select SINDHANUR or MASKI, and keep Access enabled only for active users.</p>
          <p>Open <b>Customers</b>, assign an owner and branch, then open <b>Targets</b> to set the monthly amount. These assignments control which records Staff can read and which sales count toward their target.</p>
          <h3>Daily routine</h3>
          <p>Start with <b>Overview</b> and <b>Performance</b>. Check overdue tasks, open collection balances, visits, target progress, and work completed by each Staff member.</p>
          <p>Create or reassign work where action is needed. Use Sync now after important CISapp changes; Salesapp then refreshes customer summaries and checks whether a last order is 10 days old enough to create a visit.</p>
        </div>
      </Panel>
      <Panel title="Simple technical terms">
        <div className="guide-grid field-guide">
          <article className="guide-card"><h3>Record</h3><p>One saved item in Firestore, such as one task, lead, visit, or payment promise.</p></article>
          <article className="guide-card"><h3>Owner</h3><p>The assigned Staff UID. Security rules use it to stop Staff from reading another person’s work.</p></article>
          <article className="guide-card"><h3>Status</h3><p>The workflow stage of a record. Open statuses keep work active; completed, lost, or cancelled statuses close it.</p></article>
          <article className="guide-card"><h3>Sync</h3><p>A controlled copy of approved CISapp data into Salesapp. Salesapp does not edit the original CISapp data.</p></article>
          <article className="guide-card"><h3>Snapshot</h3><p>A current read-only summary, such as a customer’s outstanding balance. A new sync can replace it with newer data.</p></article>
          <article className="guide-card"><h3>Firebase rules</h3><p>Server-side access checks. They enforce Admin and Staff permissions even if someone changes browser code.</p></article>
        </div>
      </Panel>
      <Panel title="Pages">
        <div className="guide-grid">
          {pages.map(([name, first, second]) => (
            <article className="guide-card" key={name}>
              <BookOpen size={19} />
              <h3>{name}</h3>
              <p>{first}</p>
              <p>{second}</p>
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="Common fields">
        <div className="guide-grid field-guide">
          {commonFields.map(([name, meaning]) => (
            <article className="guide-card" key={name}>
              <CircleHelp size={18} />
              <h3>{name}</h3>
              <p>{meaning}</p>
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="Fields on each work form">
        <div className="guide-grid">
          {Object.entries(modules).map(([key, module]) => (
            <article className="guide-card" key={key}>
              <h3>{module.label}</h3>
              <p>{module.description}</p>
              <p>
                <b>Fields:</b>{" "}
                {[
                  "Title",
                  "Status",
                  "Priority",
                  "Owner",
                  ...module.fields.map((field) => field.label),
                ].join(", ")}
                .
              </p>
              <p>
                <b>Status choices:</b> {module.statuses.map(label).join(", ")}.
              </p>
            </article>
          ))}
        </div>
      </Panel>
    </>
  );
}

