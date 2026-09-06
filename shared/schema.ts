export type Role = "Admin" | "Staff";
export type Data = Record<string, any>;
export type Profile = {
  uid: string;
  name: string;
  role: Role;
  active: boolean;
  email: string;
  branchId?: string;
};
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "date"
    | "number"
    | "select"
    | "customer"
    | "staff"
    | "lead";
  options?: string[];
  required?: boolean;
};
export type Module = {
  label: string;
  singular: string;
  description: string;
  statuses: string[];
  fields: Field[];
  adminOnly?: boolean;
  task?: boolean;
  closed: string[];
};
const field = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  required = false,
  options?: string[],
): Field => ({ key, label, type, required, options });
export const branchIds = ["SINDHANUR", "MASKI"] as const;
export const priorities = ["URGENT", "HIGH", "NORMAL", "LOW"];
export const outcomes = [
  "INTERESTED",
  "CALL_LATER",
  "ORDERED",
  "NOT_INTERESTED",
  "UNREACHABLE",
  "PRICE_ISSUE",
  "STOCK_ISSUE",
  "COMPETITOR",
  "PAYMENT_ISSUE",
  "EXISTING_STOCK_REMAINING",
  "OTHER",
];
export const activityTypes = [
  "CALL",
  "WHATSAPP",
  "VISIT",
  "MEETING",
  "COLLECTION",
  "PRODUCT_PITCH",
  "OFFER_DISCUSSION",
  "LEAD_CONTACT",
  "COMPLAINT",
  "FOLLOW_UP",
];
const customer = field("customerId", "Customer", "customer");
const next = field("nextFollowUp", "Next follow-up", "date");
const notes = field("notes", "Notes", "textarea");
const due = field("dueDate", "Due date", "date", true);
const basic = [customer, due, notes];
export const modules: Record<string, Module> = {
  leads: {
    label: "Leads",
    singular: "Lead",
    description: "Build relationships. Find the next opportunity.",
    statuses: [
      "NEW",
      "CONTACTED",
      "INTERESTED",
      "FOLLOW_UP",
      "TRIAL_OR_NEGOTIATION",
      "READY_FOR_CISAPP_CREATION",
      "CONVERTED",
      "LOST",
    ],
    closed: ["CONVERTED", "LOST"],
    task: true,
    fields: [
      field("contactPerson", "Contact person"),
      field("phone", "Phone"),
      field("whatsapp", "WhatsApp"),
      field("area", "Area"),
      field("branchId", "Branch ID", "select", true, [...branchIds]),
      field("source", "Source"),
      field("businessType", "Business type"),
      field("interest", "Interest"),
      next,
      field("linkedCustomerId", "Linked CISapp customer", "customer"),
      notes,
    ],
  },
  tasks: {
    label: "Tasks",
    singular: "Task",
    description: "A clear next step for every relationship.",
    statuses: [
      "PENDING",
      "IN_PROGRESS",
      "COMPLETED",
      "SKIPPED",
      "OVERDUE",
      "CANCELLED",
    ],
    closed: ["COMPLETED", "SKIPPED", "CANCELLED"],
    fields: [...basic, field("leadId", "Lead", "lead")],
  },
  followUps: {
    label: "Follow-ups",
    singular: "Follow-up",
    description: "Keep every conversation moving.",
    statuses: ["PENDING", "COMPLETED", "CANCELLED"],
    closed: ["COMPLETED", "CANCELLED"],
    task: true,
    fields: [
      ...basic,
      field("leadId", "Lead", "lead"),
      field("outcome", "Outcome", "select", false, outcomes),
      next,
    ],
  },
  activities: {
    label: "Activities",
    singular: "Interaction",
    description: "Capture the conversation and its next step.",
    statuses: ["RECORDED"],
    closed: [],
    fields: [
      customer,
      field("leadId", "Lead", "lead"),
      field("type", "Activity type", "select", true, activityTypes),
      field("outcome", "Outcome", "select", true, outcomes),
      next,
      notes,
    ],
  },
  visits: {
    label: "Visits",
    singular: "Visit",
    description: "Plan purposeful visits and record the result.",
    statuses: ["PLANNED", "COMPLETED", "CANCELLED"],
    closed: ["COMPLETED", "CANCELLED"],
    task: true,
    fields: [
      ...basic,
      field("purpose", "Purpose"),
      field("outcome", "Outcome", "select", false, outcomes),
      field("requirement", "Requirement"),
      next,
    ],
  },
  collectionPromises: {
    label: "Payment promises",
    singular: "Payment promise",
    description: "Track commitments. Actual payments are entered in CISapp.",
    statuses: ["PROMISED", "PARTIAL", "KEPT", "MISSED", "CANCELLED"],
    closed: ["KEPT", "CANCELLED"],
    task: true,
    fields: [
      field("customerId", "Customer", "customer", true),
      field("amount", "Promised amount", "number", true),
      field("promiseDate", "Promised date", "date", true),
      notes,
    ],
  },
  customerRequirements: {
    label: "Requirements",
    singular: "Requirement",
    description: "Turn customer needs into timely follow-through.",
    statuses: [
      "OPEN",
      "AVAILABLE",
      "CUSTOMER_INFORMED",
      "ORDERED",
      "CLOSED",
      "CANCELLED",
    ],
    closed: ["ORDERED", "CLOSED", "CANCELLED"],
    task: true,
    fields: [
      field("customerId", "Customer", "customer", true),
      field("product", "Product / service", "text", true),
      field("quantity", "Quantity"),
      due,
      notes,
    ],
  },
  opportunities: {
    label: "Opportunities",
    singular: "Opportunity",
    description: "The right action, at the right time.",
    statuses: ["OPEN", "CONTACTED", "INTERESTED", "WON", "LOST", "CANCELLED"],
    closed: ["WON", "LOST", "CANCELLED"],
    task: true,
    fields: [
      ...basic,
      field("type", "Opportunity type", "select", true, [
        "REORDER_DUE",
        "CUSTOMER_INACTIVE",
        "REACTIVATION",
        "SALES_DECLINE",
        "CROSS_SELL",
        "UPSELL",
        "NEW_PRODUCT",
        "PROMOTIONAL_OFFER",
        "COLLECTION_BEFORE_ORDER",
        "CUSTOMER_REQUIREMENT",
      ]),
      field("recommendedAction", "Recommended action"),
      field("outcome", "Outcome", "select", false, outcomes),
    ],
  },
  reactivations: {
    label: "Reactivation",
    singular: "Reactivation",
    description: "Reconnect with customers who have gone quiet.",
    statuses: [
      "INACTIVE",
      "ASSIGNED",
      "CONTACTED",
      "INTERESTED",
      "REACTIVATED",
      "NOT_INTERESTED",
    ],
    closed: ["REACTIVATED", "NOT_INTERESTED"],
    task: true,
    fields: basic,
  },
  campaigns: {
    label: "Campaigns",
    singular: "Campaign",
    description: "Focused outreach, measurable outcomes.",
    statuses: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"],
    closed: ["COMPLETED", "CANCELLED"],
    adminOnly: true,
    fields: [
      field("objective", "Objective"),
      field("description", "Description", "textarea"),
      field("segment", "Segment", "select", true, [
        "ALL_ASSIGNED",
        "COLLECTION",
        "AREA",
        "BRANCH",
        "STAFF",
        "OPEN_REQUIREMENTS",
        "DORMANT",
        "GOOD_PAYMENT",
        "REORDER",
      ]),
      field("segmentValue", "Area / branch / staff ID"),
      field("startDate", "Start date", "date", true),
      field("endDate", "End date", "date", true),
      field("offerReference", "Offer reference"),
      notes,
    ],
  },
  campaignAssignments: {
    label: "Campaign work",
    singular: "Campaign contact",
    description: "Your assigned outreach and outcomes.",
    statuses: [
      "PENDING",
      "CONTACTED",
      "INTERESTED",
      "NOT_INTERESTED",
      "CALL_LATER",
      "ORDERED",
      "ALREADY_STOCKED",
      "PRICE_ISSUE",
      "COMPETITOR",
      "OTHER",
    ],
    closed: ["NOT_INTERESTED", "ORDERED", "ALREADY_STOCKED"],
    task: true,
    fields: [...basic, field("campaignId", "Campaign ID", "text", true), next],
  },
  objections: {
    label: "Lost sales & objections",
    singular: "Objection",
    description: "Learn why an opportunity did not move forward.",
    statuses: ["OPEN", "RESOLVED", "LOST"],
    closed: ["RESOLVED", "LOST"],
    fields: [
      customer,
      field("leadId", "Lead", "lead"),
      field("reason", "Reason", "select", true, [
        "PRICE",
        "CREDIT",
        "COMPETITOR",
        "NO_DEMAND",
        "EXCESS_STOCK",
        "DELIVERY",
        "PRODUCT_UNAVAILABLE",
        "SERVICE",
        "PAYMENT_ISSUE",
        "OTHER",
      ]),
      field("campaignId", "Campaign ID"),
      notes,
    ],
  },
  competitorNotes: {
    label: "Competitor notes",
    singular: "Competitor note",
    description: "Record what you hear in the field.",
    statuses: ["RECORDED"],
    closed: [],
    fields: [
      customer,
      field("competitor", "Competitor", "text", true),
      field("product", "Product / service"),
      field("scheme", "Price / scheme"),
      field("comment", "Customer comment", "textarea"),
      notes,
    ],
  },
  complaints: {
    label: "Service recovery",
    singular: "Service issue",
    description: "Resolve issues and rebuild confidence.",
    statuses: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
    closed: ["RESOLVED", "CANCELLED"],
    task: true,
    fields: [
      ...basic,
      field("type", "Issue type", "select", true, [
        "DELIVERY",
        "SHORTAGE",
        "BILLING",
        "DAMAGED_GOODS",
        "WRONG_RATE",
        "PRODUCT",
        "SERVICE",
        "OTHER",
      ]),
    ],
  },
  messageTemplates: {
    label: "Message templates",
    singular: "Template",
    description: "Approved messages for thoughtful outreach.",
    statuses: ["DRAFT", "APPROVED", "ARCHIVED"],
    closed: ["ARCHIVED"],
    adminOnly: true,
    fields: [
      field("category", "Category", "select", true, [
        "COLLECTION_REMINDER",
        "REORDER_FOLLOW_UP",
        "PRODUCT_INTRODUCTION",
        "OFFER",
        "DORMANT_CUSTOMER",
        "LEAD_INTRODUCTION",
        "CUSTOMER_REQUIREMENT",
      ]),
      field("body", "Message", "textarea", true),
    ],
  },
};
export const label = (s: string) =>
  s
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function validateRecord(kind: string, input: Data): Data {
  const spec = modules[kind];
  if (!spec) throw new Error("Unknown record type");
  const allowed = [
    "title",
    "status",
    "priority",
    "assignedStaffId",
    ...spec.fields.map((f) => f.key),
  ];
  if (Object.keys(input).some((k) => !allowed.includes(k)))
    throw new Error("Unsupported field");
  if (
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.length > 180
  )
    throw new Error("Enter a title (maximum 180 characters)");
  if (!spec.statuses.includes(input.status)) throw new Error("Invalid status");
  if (!priorities.includes(input.priority)) throw new Error("Invalid priority");
  if (
    typeof input.assignedStaffId !== "string" ||
    !input.assignedStaffId ||
    input.assignedStaffId.includes("/")
  )
    throw new Error("Select an owner");
  const data: Data = {
    title: input.title.trim(),
    status: input.status,
    priority: input.priority,
    assignedStaffId: input.assignedStaffId,
  };
  for (const f of spec.fields) {
    const v = input[f.key];
    if (f.required && (v === undefined || v === ""))
      throw new Error(`${f.label} is required`);
    if (v === undefined || v === "") {
      data[f.key] = "";
      continue;
    }
    if (f.type === "number") {
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 1e12)
        throw new Error(`Invalid ${f.label}`);
    } else if (typeof v !== "string" || v.length > 4000)
      throw new Error(`Invalid ${f.label}`);
    if (
      f.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ||
        new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v)
    )
      throw new Error(`Invalid ${f.label}`);
    if (f.options && !f.options.includes(String(v)))
      throw new Error(`Invalid ${f.label}`);
    if (
      ["customer", "lead", "staff"].includes(f.type || "") &&
      String(v).includes("/")
    )
      throw new Error("Invalid record ID");
    data[f.key] = v;
  }
  if (kind === "campaigns" && data.endDate < data.startDate)
    throw new Error("End date must follow start date");
  return data;
}
export const monthNow = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .replace("/", "-");
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function targetMetrics(
  target: number,
  achieved: number | null,
  month: string,
  now = new Date(),
) {
  const date = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const current = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const elapsed = month < current ? days : month > current ? 0 : date.getDate();
  return {
    target,
    achieved,
    percentage:
      achieved !== null && target > 0
        ? Math.round((achieved / target) * 100)
        : null,
    remaining: achieved === null ? null : Math.max(0, target - achieved),
    daysRemaining: Math.max(0, days - elapsed),
    paceStatus:
      achieved === null
        ? "AWAITING_DATA"
        : target <= 0
          ? "SET_TARGET"
          : achieved >= target
            ? "ACHIEVED"
            : elapsed === 0
              ? "NOT_STARTED"
              : achieved >= (target * elapsed) / days
                ? "ON_PACE"
                : "BEHIND_PACE",
  };
}
export function renderTemplate(
  body: string,
  variables: Record<string, string>,
) {
  return body.replace(
    /\{\{(customerName|amount|dueDate|staffName)\}\}/g,
    (_, key) => variables[key] || "",
  );
}
export function whatsappUrl(phone: string, message: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function businessMonth(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(timestamp));
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

