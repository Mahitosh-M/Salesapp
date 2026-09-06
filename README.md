# Salesapp - Firebase Spark

Salesapp is a separate sales workspace connected to `salesapp-aaa7b`. It runs on Firebase Hosting, Email/Password Authentication, and Firestore on the free Spark plan. No Cloud Functions, scheduler, Cloud Run, or paid storage service is required. Do not link billing or upgrade the project.

Production: https://salesapp-aaa7b.web.app

## Features

Assigned customers, leads, tasks, calls and interactions, follow-ups, visits, collection promises, requirements, opportunities, reactivation, campaigns, WhatsApp templates, objections, competitor notes, complaints, monthly targets, and staff performance. Responsive mobile navigation is included.

The existing Admin Auth account `mahi@a.com` has the active Salesapp profile `users/NHZVRvj1pFahyt5wSs1vUSpXpGj2`. Use its existing password. Demo credentials below are local only.

## Spark architecture

- `src/spark/records.ts` uses browser transactions for workflow records and linked tasks. `firestore.spark.rules` independently enforces Staff ownership, allowed fields/statuses, customer and lead scope, immutable interactions, task provenance, and server timestamps. Frontend validation is not the security boundary.
- Only Admin can write mirrors, assignments, targets, settings, approved templates, campaigns, and user profiles. Staff-facing customer documents have strict field whitelists. Sensitive intelligence remains in Admin-only collections.
- Nobody writes performance counters. Reports derive totals from authorized B records in pages of 100, using server-created timestamps for monthly cohorts. Reads share a 60-second in-memory cache. Each workflow report stops with an explicit error after 2,000 records; it never returns a partial total. Normal lists use 25-row pages.
- Admin can create Staff accounts using a temporary in-memory secondary Auth session; this does not replace the Admin login. Disabling access changes the profile checked by every protected Firestore operation. Auth password resets, email changes, and deleting Auth accounts remain Firebase Console operations. A standalone Auth signup does not grant any Salesapp role or data access.
- Due/overdue reporting compares task dates when the page loads. There is no background scheduler. The existing Admin refresh action can persist overdue statuses in bounded batches.

## Staff passwords and automatic visits

New Staff accounts accept passwords of at least six characters, including a six-digit password. New Admin accounts retain the 12-character minimum. Existing account passwords are unchanged.

Regular CISapp sync now checks the most recent eligible sales invoice for every active customer using the existing customerId/date index, one projected invoice per query. Drafts, cancelled invoices, returns and opening balances are skipped with saved cursors. Only the last-order date and its check time are saved for staff use; no sales amount is copied into the staff customer document.

Run CISapp Sync once after this update. On app opening, on the next calendar day while the app remains open, and after sync/assignment changes, Salesapp automatically plans visits for assigned active customers whose known last order is at least 10 calendar days old. The due date is the order date plus ten days. Customers without a known order date are skipped.

Each customer/order-date cycle has one deterministic automatic visit and one linked task. Repeated checks and concurrent sessions do not reset completed visits or create duplicates. A changed order date cancels an obsolete pending automatic visit and its task. Later, that new order can trigger a new visit once it becomes ten days old. Automation uses B data only; its accuracy depends on the most recent source sync. Spark runs this automation while the application is open, without a paid background scheduler.

## CISapp sync

CISapp (`cisapp-236ab`) remains unchanged. Only the explicit Admin sync page loads the read-only source REST connector. Staff's everyday work uses B only. Existing financial intelligence is copied, not recalculated.

Sign in as the Salesapp Admin, open **CISapp Sync**, connect an existing CISapp Admin, and run **Initial import**. Keep the page open. It processes bounded source pages with B checkpoints. Closing the browser or a quota/network error may interrupt the current batch; resume retries the saved checkpoint after the lease expires. Source credentials and ID tokens remain in memory, never Firestore or local storage.

Source Firestore validates the existing source token against CISapp's unchanged rules. The connector has no source write API, but an existing source Admin token still has its original permissions; this application does not downgrade source IAM. Browser delivery means Admin code can be inspected; data access is enforced by source/B rules, not code secrecy.

Subsequent sync uses existing timestamps with a ten-minute overlap. Periodic full reconciliation detects deletions and untimestamped changes. Optional monthly invoice reconciliation supports target-only aggregates when source summaries are incomplete. Staff attribution is the full month's assigned customer portfolio, not invoice salesperson attribution. Missing or incomplete source financial totals remain unavailable.

The first production import requires the existing CISapp Admin sign-in. Tests use a fake source and never import live CISapp data.

## Free quotas

Spark has quotas, not unlimited usage. Firestore's published free allocation includes 1 GiB stored data, 50,000 reads/day and 20,000 writes/day. Sync, security-rule lookups, reports, retries and Console access consume usage. Monitor the Firebase Usage page, avoid repeated full syncs, and resume after quota reset if operations are blocked. No billing upgrade is performed by this project. See [Firebase quotas](https://firebase.google.com/docs/firestore/quotas) and [pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans).

## Develop and test

```powershell
npm install
npm --prefix functions install
npm run build:functions
firebase emulators:start --project demo-salesapp --only firestore,auth
```

In a separate terminal:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
node scripts/seed-emulator.cjs --reset
$env:VITE_USE_EMULATORS = 'true'
npm run dev
```

Preview: http://127.0.0.1:5175 . Local Admin: `admin@salesapp.test`; Staff: `arun@salesapp.test`; password: `SalesappDemo!2026`. The seed script refuses non-emulator targets. Legacy backend code is retained for baseline tests and fixture generation; it is not deployed or used by the live app.

With Firestore emulator running, run `npm run test:spark`. Rule tests clear the isolated demo database, so reseed before `npx playwright test`. The browser suite uses a fresh headless Chrome profile and covers Staff/Admin workflows, role boundaries, Admin user creation, and fake-source sync. Screenshots/logs are ignored under `artifacts/`.

## Deploy Spark

```powershell
npm run deploy:spark
```

The script forces `VITE_USE_EMULATORS=false`, builds, then deploys only Hosting, Spark rules and indexes to `salesapp-aaa7b`. Both default `firebase.json` and `firebase.spark.json` exclude Functions. `firebase.legacy-emulators.json` is retained solely for historical local backend tests; do not deploy it.

The production browser bundle still has a nonfatal Vite size warning. Android packaging and offline financial editing are not included.

See [original source audit](docs/IMPLEMENTATION_AUDIT.md) and [validation](docs/VALIDATION.md). The Spark architecture above supersedes the original server/callable design in the historical audit.
## Simple Admin guide

1. Sign in with the Admin account and open **CISapp Sync**. Run the initial import once, then use **Sync now** whenever CISapp data changes.
2. Open **People & settings** to create Staff accounts, select SINDHANUR or MASKI and set their role, and turn access on or off. Staff passwords can be six characters.
3. Open **Customers** to assign customers to Staff. Set **Targets**, create tasks or campaigns, and use **Overview** and **Performance** to monitor progress.
4. Open **Collections** for customers who still owe money. Records with an outstanding balance of zero are hidden. Record promises here; record actual payments in CISapp.
5. Open **Admin guide** inside the app for two short lines about every page and explanations of each common form field.

## Simple Staff guide

1. Sign in and start on **Today**. It shows the most useful tasks, follow-ups, visits, and customer work for you.
2. Open **Customers** to call or message an assigned customer and record what happened. Add a next follow-up so the work is not forgotten.
3. Open **Tasks**, **Visits**, and **Follow-ups** during the day and update each status when the work changes or finishes.
4. Open **Collections** to contact customers with money outstanding and save their payment promise. Zero-balance customers are hidden, and actual payments remain in CISapp.
5. Use **Targets** and **Performance** to see your progress. Staff can view and update only work assigned to them.

## Automatic GitHub deployment

The repository includes GitHub Actions for production Hosting on every push to `main` and a temporary preview for pull requests. Both workflows build the app first. They use keyless Google Workload Identity restricted to `Mahitosh-M/Salesapp`, so no Firebase private key is stored in GitHub.

The workflow deploys Firebase Hosting only and stays compatible with the Spark plan. Firestore rules and indexes are security changes and are deployed deliberately with `npm run deploy:spark` after review.

## Desktop and mobile use

Use the same production link on desktop or mobile. Desktop shows a sidebar and wider panels; mobile shows touch-friendly navigation and single-column forms. The site is installable from the browser with **Install app** or **Add to Home Screen**. The app shell can reopen after installation, while live customer and financial data still requires a connection.
## CISapp branch assignment and automatic follow-ups

CISapp customer records have a required Branch choice: SINDHANUR or MASKI. Salesapp Sync copies that branch. When an Admin creates or updates an active Staff profile with the same branch, Salesapp assigns currently unassigned customers in that branch to the Staff member. A later sync also assigns a newly imported, unassigned customer to the first active Staff UID in the matching branch. Existing manual customer assignments are preserved.

Salesapp uses the synchronized latest normal business invoice date to create automatic follow-ups after 15 calendar days without an order. Customers with no normal business order also receive a follow-up after the source check. Automatic IDs are stable, so reopening the app or running sync again does not duplicate them. Manual follow-ups remain separate. When a newer order changes the date, an obsolete pending automatic follow-up and its linked task are cancelled; completed records remain as history.
