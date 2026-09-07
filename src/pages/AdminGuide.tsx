import { BookOpen, CheckCircle2, CircleHelp, UserCog, Users } from "lucide-react";
import { Header, Panel } from "../components/ui";
import { label, modules } from "../../shared/schema";

const pages = [
  ["Overview", "Your morning summary. It shows work that is due, late, completed, and linked to results.", "Look here first. Open any number that needs attention."],
  ["Customers", "Customers copied from CISapp. Each customer must have a branch and a Staff owner.", "Open a customer to see their work, schedule a call or visit, and review their latest copied details."],
  ["Leads", "People or businesses that may become customers later.", "Give every lead an owner and a next action. Create the real customer in CISapp when the lead becomes a customer."],
  ["Tasks", "Small jobs that somebody must finish.", "Write a clear title, choose the Staff owner, choose a due date, and check that the Staff member completes it."],
  ["Collections", "Customers with money still outstanding. A zero balance is hidden.", "Staff can follow up or save a promise. Enter the actual payment only in CISapp, then sync again."],
  ["Follow-ups", "Calls or messages that must happen on a date.", "Salesapp creates one automatically when an assigned customer has no order for 10 days. Staff can also create one manually."],
  ["Visits", "A plan to meet a customer.", "Salesapp creates one automatically when an assigned customer has no order for 10 days. Staff can also plan a visit manually."],
  ["Opportunities", "A possible sale, reorder, or extra product sale.", "Give it an owner, action, and due date. Close it with the real result."],
  ["Requirements", "Something a customer has asked for.", "Staff records what is needed and updates it when stock is available, ordered, or resolved."],
  ["Targets", "The sales goal for the business, branch, or Staff member.", "Create the monthly goal here. Salesapp uses synced CISapp sales to show progress."],
  ["Performance", "A report of work done and results received.", "Use it to help Staff who have late work or many calls without useful results."],
  ["Marketing", "Campaigns and approved messages for selected customers.", "Choose the audience, approve the message, and give campaign work to Staff in small batches."],
  ["CISapp Sync", "The bridge that copies allowed information from CISapp into Salesapp.", "Run it after customer, branch, invoice, or payment changes. Keep the page open until the status says SUCCESS."],
  ["People & settings", "Where Admin creates Staff accounts and controls access.", "Choose the correct branch. A Staff member only receives customers and work assigned to that Staff member."],
] as const;

const commonFields = [
  ["Title", "A short sentence saying what must be done. Example: Call about the next order."],
  ["Status", "Where the work is now. Change it when work starts, finishes, or is cancelled."],
  ["Priority", "How quickly it needs attention. Urgent and High appear before normal work."],
  ["Owner", "The Staff member responsible for doing the work."],
  ["Customer", "The CISapp customer connected to this work."],
  ["Lead", "A possible future customer connected to this work."],
  ["Due date", "The day the work should be finished. Open work becomes overdue after this day."],
  ["Next follow-up", "The next day Staff should contact the person again."],
  ["Notes", "A small, true explanation of what happened and what should happen next."],
] as const;

const setupSteps = [
  ["Put a branch on every CISapp customer", "Open CISapp → Customers → Edit. Choose SINDHANUR or MASKI and save. Medicals use the branch of their linked customer."],
  ["Create each Staff account", "Open Salesapp → People & settings. Enter the Staff name, email, a password with at least six characters, and the correct branch. Keep Access enabled."],
  ["Connect CISapp", "Open Salesapp → CISapp Sync. Enter an active CISapp Admin email and password. This connection is used only to read the allowed CISapp information."],
  ["Run the first import", "Choose Initial import. Do not close the page. Wait until the status says SUCCESS."],
  ["Check customer owners", "Open Customers. A customer and Staff member with the same branch are matched automatically. If a customer has no owner, check both branches and sync again, or assign the owner manually."],
  ["Set this month’s targets", "Open Targets. Add the business, branch, or Staff goal for the month. Synced CISapp sales will fill the achieved amount."],
] as const;

const dailyAdminSteps = [
  ["1. Sync CISapp", "Open CISapp Sync and press Sync Now. Keep this page open until SUCCESS. This brings in customer changes, outstanding money, payments, sales, branches, and last-order dates."],
  ["2. Open Overview", "Look for overdue work, work due today, collection needs, and target progress. A large or red number means somebody needs help."],
  ["3. Check unassigned customers", "Open Customers. Make sure every active customer has the correct Staff owner. No owner means no Staff member can receive that customer’s automatic visit or follow-up."],
  ["4. Check Collections", "Only balances above zero appear. Ask the owner to contact important or overdue customers. Payments are recorded in CISapp, then copied by the next sync."],
  ["5. Check Follow-ups and Visits", "Look for overdue items and customers waiting too long. A visit and follow-up appear after 10 days without an order, after sync has checked the last order."],
  ["6. Give clear new work", "Create or reassign a task only when needed. Choose one owner, a useful title, the right priority, and a real due date."],
  ["7. Check Performance", "See what each Staff member completed and what results they recorded. Speak to the Staff member when work stays open or overdue."],
  ["8. End the day", "Check Overview again. Confirm urgent work is completed or has a clear next date. Sync once more if invoices or payments changed in CISapp during the day."],
] as const;

const staffSteps = [
  ["1. Sign in", "Staff opens Salesapp and sees only their own assigned customers and work."],
  ["2. Open Today", "Start with urgent, overdue, and today’s work. Do the first important item before moving to the next one."],
  ["3. Contact or visit", "Open the customer, call, message, or visit them, and ask the reason for delay or what they need."],
  ["4. Save the result", "Choose the true outcome, write a short note, and mark completed only when the action is really finished."],
  ["5. Choose the next step", "If another contact is needed, enter Next follow-up. If the customer promises payment, save a Payment promise. If they request a product, save a Requirement."],
  ["6. Tell Admin about source changes", "Orders and payments belong in CISapp. After they are entered there, Admin runs Sync Now so Salesapp receives the new result."],
] as const;

function Steps({ items }: { items: readonly (readonly [string, string])[] }) {
  return <div className="guide-grid">{items.map(([name, meaning]) => (
    <article className="guide-card" key={name}><CheckCircle2 size={19} /><h3>{name}</h3><p>{meaning}</p></article>
  ))}</div>;
}

export default function AdminGuide() {
  return (
    <>
      <Header eyebrow="ADMIN HELP" title="Admin guide: what to do every day" description="Follow these steps in order. Each step explains what you do, what Salesapp does, and what Staff sees next." />
      <Panel title="The easy idea">
        <div className="guide-card">
          <h3>CISapp is the main record. Salesapp is the team’s work list.</h3>
          <p>CISapp keeps customers, invoices, payments, branches, and orders. Salesapp copies the information Staff needs and turns it into calls, follow-ups, visits, collection work, and targets.</p>
          <p><b>Admin prepares and checks the work.</b> <b>Staff does the work and saves the result.</b> Then Admin checks the result and helps with anything unfinished.</p>
        </div>
      </Panel>
      <Panel title="Do this once before daily work starts"><Steps items={setupSteps} /></Panel>
      <Panel title="Admin: do these steps every day"><Steps items={dailyAdminSteps} /></Panel>
      <Panel title="What happens for Staff after Admin finishes">
        <div className="guide-card">
          <UserCog size={20} />
          <p>When Admin assigns a customer or task, it appears in that Staff member’s Salesapp. Other Staff members cannot see or change it.</p>
          <p>After a successful sync, outstanding balances above zero appear in Collections. Last-order dates are checked. Assigned customers can then receive an automatic Visit and Follow-up after 10 days.</p>
          <p>If nothing appears, first check that the customer has a branch, the Staff account has the same branch, the customer has an owner, and CISapp Sync says SUCCESS.</p>
        </div>
        <Steps items={staffSteps} />
      </Panel>
      <Panel title="Example 1: customer has not ordered">
        <div className="guide-card">
          <Users size={20} /><h3>Ravi Medical has not ordered for 10 days</h3>
          <p><b>Admin:</b> In CISapp, Ravi Medical has branch MASKI. In Salesapp, Staff member Asha also has branch MASKI. Admin runs Sync Now and waits for SUCCESS.</p>
          <p><b>Salesapp:</b> Ravi Medical is assigned to Asha. After 10 days without an order, a Visit and a pending Follow-up appear for Asha.</p>
          <p><b>Staff:</b> Asha opens Today or Follow-ups, calls Ravi Medical, chooses the true outcome, writes “Call again on Friday,” enters Friday as Next follow-up, and completes today’s follow-up.</p>
          <p><b>Result:</b> Today’s work closes and Friday’s follow-up appears. Admin can see this progress in Overview and Performance.</p>
        </div>
      </Panel>
      <Panel title="Example 2: customer promises payment">
        <div className="guide-card">
          <Users size={20} /><h3>Lakshmi Stores has ₹5,000 outstanding</h3>
          <p><b>Admin:</b> Admin runs Sync Now. Because the balance is above zero, Lakshmi Stores appears in Collections for its assigned Staff owner.</p>
          <p><b>Staff:</b> The Staff member calls the customer. The customer promises to pay on Monday. Staff saves a Payment promise for Monday and writes a short note.</p>
          <p><b>When payment arrives:</b> The payment is entered in CISapp. Admin runs Sync Now again.</p>
          <p><b>Result:</b> If the new outstanding balance becomes zero, Lakshmi Stores disappears from Collections. The promise and call remain in Salesapp history so Admin can see what happened.</p>
        </div>
      </Panel>
      <Panel title="What every page does">
        <div className="guide-grid">{pages.map(([name, first, second]) => <article className="guide-card" key={name}><BookOpen size={19} /><h3>{name}</h3><p>{first}</p><p>{second}</p></article>)}</div>
      </Panel>
      <Panel title="What the common fields mean">
        <div className="guide-grid field-guide">{commonFields.map(([name, meaning]) => <article className="guide-card" key={name}><CircleHelp size={18} /><h3>{name}</h3><p>{meaning}</p></article>)}</div>
      </Panel>
      <Panel title="Fields on each work form">
        <div className="guide-grid">{Object.entries(modules).map(([key, module]) => (
          <article className="guide-card" key={key}><h3>{module.label}</h3><p>{module.description}</p><p><b>Fill these fields:</b> {["Title", "Status", "Priority", "Owner", ...module.fields.map((field) => field.label)].join(", ")}.</p><p><b>Status choices:</b> {module.statuses.map(label).join(", ")}.</p></article>
        ))}</div>
      </Panel>
    </>
  );
}
