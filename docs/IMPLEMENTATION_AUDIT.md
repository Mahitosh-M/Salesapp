> Spark update, 6 September 2026: the owner explicitly requires the free tier. The deployed architecture now uses browser transactions enforced by firestore.spark.rules, derived performance reports, and manual Admin browser sync. No Functions or scheduler is deployed. Source schema findings below remain valid; server-only/callable sections are historical and superseded by README.md.

# Salesapp implementation audit

Audit date: 6 September 2026. Reference: `D:\CISapp`. Destination: `D:\SALESapp`.

This audit is based on local source code and rules, not a scan of production data. No source data was accessed during development. The audit was presented before implementation. CISapp's baseline tracked working tree was clean; file hashes are recorded in `cisapp-baseline.json`.

## 1. Source projects and collections

Project A: `cisapp-236ab`. Project B: `salesapp-aaa7b`.

| Source collection | Why read it | Destination (Admin only unless noted) |
|---|---|---|
| customers | Stable document ID, contact fields, stored outstanding | adminCis_customers; projected staffCustomers and collectionSnapshots |
| customerCreditProfiles | Stored overdue amount, due dates, credit controls | adminCis_customerCreditProfiles; collection allowlist only |
| customerIntelligenceSummaries | Existing scores, financial performance, tier, risk | adminCis_customerIntelligenceSummaries |
| customerMonthlySnapshots | Stored monthly totals and completeness flag | adminCis_customerMonthlySnapshots; target-only staff aggregate |
| businessMonthlySnapshots | Company monthly target achievement | adminCis_businessMonthlySnapshots; businessTargetProgress |
| pcBalances | Existing PC balances | adminCis_pcBalances |
| invoices (optional, one selected month) | Exact branch target totals when no aggregate exists | adminInvoiceTargets; aggregate target progress only |
| users/{sourceAuthUid} | Confirm existing active source Admin | Transient authorization check; never mirrored |

`customerCreditSummaries` duplicates selected fields already available in the richer credit profile, so no redundant read is needed. `dueCustomers` is a manually refreshed cache with hard deletion behavior; it is not used as authoritative overdue truth. `monthlyCustomerStats` overlaps with existing monthly snapshots/intelligence and is unnecessary for V1. No payment, loyalty ledger, reward-history, settings, cash, or historical invoice scan is part of normal synchronization.

## 2. Explicit field reuse

| CISapp field | Salesapp field / audience |
|---|---|
| customers document ID | customerId, always the permanent ID |
| customers.name | staffCustomers.name |
| customers.mobile | phone and WhatsApp number |
| customers.area | area |
| customers.status | active availability; unrecognized status retained only in source projection |
| customers.totalOutstandingAmount | collectionSnapshots.outstandingAmount |
| customers.financialSummaryUpdatedAt | collectionSnapshots.financialSourceUpdatedAt |
| customerCreditProfiles.overdueAmount | collectionSnapshots.overdueAmount |
| customerCreditProfiles.oldestOverdueDate | collectionSnapshots.oldestDueDate |
| customerCreditProfiles.nextInvoiceDueDate / nextInvoiceDueAmount | dueDate / amountRequiringFollowUp |
| customerCreditProfiles.lastCreditReviewAt | overdueSourceUpdatedAt |
| intelligence.totalSales / totalProfit / scores / tier / risk / recommendation | Admin-only source projection, without recalculation |
| monthlySnapshots.totalSales / needsBackfill | target inputs; missing or incomplete remains unavailable |
| pcBalances.availablePc / incomingPc / redeemedPc | Admin-only PC mirror |

Customer name or phone is never a synchronization key. Customer notes are not copied into Staff-readable records because they could contain commercially sensitive text. Staff priorities use operational urgency, not customer financial value. Assignment, branch, lead links, tasks, and promises are Salesapp-owned.

## 3. Existing change tracking

Source inspection: `src/services/firestoreService.ts`, `derivedDataService.ts`, `creditService.ts`, `src/utils/creditCalculation.ts`, `src/types.ts` and `firestore.rules`.

- `customers.updatedAt`: creation/profile and most atomic balance changes.
- `customers.financialSummaryUpdatedAt`: separate balance-repair path updates this without `updatedAt`; both lanes are required.
- `customerIntelligenceSummaries.calculatedAt`: existing scoring write time.
- `customerCreditProfiles.updatedAt` and `lastCreditReviewAt`: ISO-string calculation/review times; sync uses updatedAt.
- Customer/business monthly snapshots: `updatedAt` and `needsBackfill`.
- PC balances: `updatedAt`.
- Invoice/payment documents often have `updatedAt`, but historical records may not; full optional monthly invoice target passes also cover corrections and deletions.

These are existing application-generated ISO strings, not a reliable server change log.

## 4. Incremental feasibility

Useful incremental synchronization is possible with seven timestamp lanes over six source collections. It is not a guaranteed complete change feed. Each lane has timestamp + document-name ordering and a stable two-part cursor, with a ten-minute overlap before the previous successful run's start time and a fixed upper boundary for the current run. A failed run never advances the successful watermark. Projection hashes distinguish changed and unchanged records in B.

Initial/reconciliation passes paginate by document ID so untimestamped records are included. Reconciliation marks B mirrors by run generation and prunes unseen source mirrors only after that source collection was read successfully. Missing source customers become inactive; Salesapp activity history remains intact.

Hard deletions, legacy timestamp omissions, source clients with substantially incorrect clocks, and updates that do not maintain timestamps require a full reconciliation. There is no source mutation, trigger installation, index deployment, or timestamp backfill.

## 5. Expected Project A reads

Let C = customers, I = intelligence summaries, R = credit profiles, P = PC balances, M = customer monthly snapshots, B = business monthly snapshots.

- Initial/reconciliation import: approximately C + I + R + P + M + B returned document reads, plus query minimums and authorization/rule evaluation overhead. Source page size is 50. B-only prune/materialize phases do not intentionally read A.
- Incremental: returned documents across seven timestamp lanes since watermark minus overlap. A customer can appear in both customer lanes. Each query may incur minimum/index-entry charges; source user authorization and rule-dependent profile reads add overhead. Empty queries are not free.
- Optional monthly invoice target reconciliation: N invoices in the selected month plus query and authorization overhead. No payments are read. All future target screens read B aggregates.
- Retry: an interrupted page can be reread. UI counts represent processed source rows, not a billing estimate.
- Normal Staff/Admin screens: zero intentional Project A reads. No source realtime listener, polling, or automatic launch sync.

Exact row counts, source index availability, timestamp coverage, and existing summary completeness require the first authorized live import. Field projections reduce transfer size, not Firestore's per-document charges.

## 6. Project B schema

Staff-readable, assignment-scoped: staffCustomers, collectionSnapshots, leads, tasks, followUps, activities, visits, collectionPromises, customerRequirements, opportunities, reactivations, campaignAssignments, objections, complaints, competitorNotes.

Own aggregates only: staffTargetProgress, staffPerformance, staffWorkSummaries, staffDailyWork.

Admin-only: six adminCis_* projections, adminInvoiceTargets, customerAssignments, monthlyAssignments, targets, branchTargetProgress, businessTargetProgress, businessPerformance, adminWorkSummaries, campaignPerformance, targetCoverage, campaigns, syncState, syncDirtyCustomers (server only).

Shared limited reads: own users profile, approved messageTemplates, settings/general, publicState/sync.

Workflow documents have title, assignedStaffId, priority, status, approved type-specific fields, server-created createdAt/updatedAt/createdBy. Child tasks use deterministic sourceCollection_sourceId IDs. Lead `linkedCustomerId` links only an imported permanent customer ID. No record in B writes a customer or payment to A.

## 7. Admin sync workflow

Admin signs into B, opens CISapp Sync, explicitly connects an existing CISapp Admin account, then selects Initial Import, Sync Now, Retry/Resume, Full Reconciliation, or selected-month Target Reconciliation. Browser sends a short-lived source ID token to a B callable function. It never receives a source Firestore handle. The source Auth session uses memory persistence and disconnects on leaving the page.

Each server call processes one bounded batch. B stores the run, mode, lane, page cursor, counts, error, and lease. Browser may continue batches while the page is open; Pause stops after the current batch. Retry resumes persisted state. A 120-second lease exceeds the callable's 90-second timeout and serializes source synchronization. Closing the page does not discard progress. No source credentials are stored or logged.

## 8. Authentication

B uses Firebase email/password Authentication plus active Admin/Staff profiles stored in B. First Admin is provisioned by a trusted operator using the B-only bootstrap script; there is no first-user self-promotion path.

A uses the existing Admin login and existing `users/{uid}` role model. Its Firestore REST endpoint validates the ID token and applies unchanged A security rules. The reader restricts the source project, collection list, methods, and query types. It exposes only `assertAdmin` and `page`.

Important boundary: an existing A Admin token itself has the permissions already granted by A. Salesapp does not turn it into a cryptographically read-only credential. Enforced source IAM read-only credentials would require source-side access configuration; that is intentionally not performed. The code adapter and tests prevent application source writes.

## 9. Security model

B rules deny all direct client mutations, including Admin mirror writes. Authenticated B callable endpoints validate roles, active accounts, assignments, allowed fields, enums, dates, positive amounts, and existing related records. Staff queries include ownership constraints before execution. Customer queries also require active source presence. List queries are bounded at 100; UI pages request 25. Staff have no bulk exports.

Admin source intelligence is kept in separate documents and never merged into staffCustomers/collectionSnapshots. Competitor notes are Staff-own only. Staff see only approved message templates, their own performance, and their own target. Role changes and user creation require an existing B Admin. Backend initialization rejects other production project IDs.

## 10. New files/modules

- `src/pages`: Today/Admin dashboard, customer profiles, collection views, workflow lists/forms, marketing, targets, performance, sync, people/settings.
- `src/services/sales.ts`: B-only bounded queries and callable commands.
- `src/services/cisappSession.ts`: lazy Admin-only source Auth session (no Firestore).
- `shared/schema.ts`: typed workflow definitions, field validation, target display math, WhatsApp templates.
- `functions/src/cisapp`: isolated REST reader, whitelist mapper, optional target invoice eligibility.
- `functions/src/sync.ts`: checkpoints, leases, projection hashes, reconciliation, materialization.
- `functions/src/records.ts`, `performance.ts`, `targets.ts`: validated operational mutations, deterministic tasks, transactional counters, target aggregation.
- Rules/indexes, emulator tests, bootstrap and demo seed scripts, web manifest and responsive styling.

## 11. Risks and operational limits

- Source summaries can be stale independently of sync. Balance calculation time, overdue calculation time, and mirror update time are displayed separately. Overdue age is not recalculated in Salesapp.
- `needsBackfill:true` prevents treating partial monthly snapshots as complete sales. Salesapp does not repair A summaries.
- No source staff attribution exists on invoices. B monthly assignment attributes the whole customer's month to one owner; it is explicitly not historical salesperson attribution. Editing assignments invalidates invoice-derived Staff attribution until refreshed.
- Branch invoice data includes `SHOP_A`, `SHOP_S`, and legacy/shared records without branch ownership. Unallocated legacy sales are kept separate.
- The optional invoice pass is a paginated current-state read, not a point-in-time accounting snapshot; edits during the pass require rerunning it. Only target amounts are aggregated; source financial/intelligence calculations are not replaced.
- Monthly performance is a creation-month cohort with current outcomes, not an immutable event-time payroll report. Today/overdue counters are separate.
- Source deletion revokes customer/contact access; already assigned Salesapp tasks/history remain. Reassigning a customer does not silently reassign old operational records.
- Functions/scheduled maintenance require an enabled Functions-compatible billing plan in B. No paid AI or WhatsApp API is used. Source authentication and backend deployment must be completed by an authorized project operator.
- PWA manifest/mobile layout are included. Offline financial reads/writes and Android packaging are intentionally not introduced; Capacitor can be added later.

## 12. Requirements that cannot be exact without changing A

No guaranteed instant financial updates; no reliable deletion/untimestamped change stream; no independent correction of stale source intelligence; no exact invoice salesperson attribution where A never recorded it; no source-permission downgrade for existing Admin tokens. Safe B-only alternatives are manual incremental sync, periodic reconciliation, unavailable/stale indicators, documented monthly attribution, and a restricted server reader.

Reference documentation: [Firestore REST authentication](https://firebase.google.com/docs/firestore/use-rest-api), [query ordering and missing fields](https://firebase.google.com/docs/firestore/query-data/queries), [pagination](https://firebase.google.com/docs/firestore/query-data/query-cursors), [callable authentication](https://firebase.google.com/docs/functions/callable).
