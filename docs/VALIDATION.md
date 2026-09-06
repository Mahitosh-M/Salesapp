# Validation - 6 September 2026

- Frontend production build and Firebase Functions TypeScript build passed.
- 52 domain, Firestore security-rule, and transactional integration tests passed against local emulators.
- All 4 browser tests passed: Staff access and customer privacy, mobile task updates/navigation, Admin screens/campaign assignment, and callable authorization.
- Repeated the mobile test with explicit loaded-customer assertions; passed and visually inspected the customer screenshot at 390px width.
- Root and Functions dependency installs reported zero known vulnerabilities.
- All 115 baseline CISapp file hashes matched; CISapp Git working tree remained clean.

Local preview: http://127.0.0.1:5175 (requires the development server and emulators).
Demo Admin: admin@salesapp.test; demo Staff: arun@salesapp.test. Password: SalesappDemo!2026. These accounts exist only in local emulators.

Production Firebase configuration targets salesapp-aaa7b. No production deployment, live source import, or CISapp modifications were performed. Source-sync integration was tested with an injected fake reader; production source permissions and indexes must be verified during the first authorized Admin sync. See README.md for deployment, Admin provisioning, and source connection instructions.

Build limitation: Vite reports a nonfatal large-chunk warning for the Firebase-based browser bundle. Android packaging and offline financial edits are outside this implementation.

## Production deployment attempt - 6 September 2026

Production frontend, Firestore rules, and indexes deployed successfully to salesapp-aaa7b. Hosting: https://salesapp-aaa7b.web.app . Backend Functions deployment was blocked by Firebase: the project must upgrade to Blaze before Cloud Build and Artifact Registry can be enabled. No live CISapp import was run. Admin provisioning and initial source sign-in remain pending; local demo credentials are not production accounts.

## Free-tier constraint

Owner explicitly requires Spark only. No billing upgrade was performed. Added firebase.spark.json and deploy:spark, excluding Functions from the supported production deployment command. Production backend migration is pending; existing emulator tests do not certify a browser-write implementation.

## Spark conversion - 6 September 2026

- 55 domain and Spark security-rule tests passed (22 domain + 33 Spark rule cases).
- Seven browser tests passed with only Auth and Firestore emulators: Staff desktop/mobile flows, Admin screens/campaign assignment, permission denial, all Staff workflow saves and derived performance, full fake-source sync, and Admin Staff-account provisioning without replacing the Admin session.
- Production Admin Auth UID verified as NHZVRvj1pFahyt5wSs1vUSpXpGj2 (mahi@a.com); created its missing active Firestore Admin profile. Password unchanged.
- All 115 CISapp baseline hashes still match; CISapp working tree is clean.
- No Functions dependencies remain in src; default deployment configuration excludes Functions. Source backend files are retained only for historical tests and demo fixtures.
- Production sync still requires an existing CISapp Admin sign-in. No live source import was run by these tests.

### Spark production deployment

Hosting and firestore.spark.rules/indexes deployed successfully to https://salesapp-aaa7b.web.app . Fresh headless-browser smoke check returned HTTP 200 with the sign-in form visible and no page errors. The Google Cloud Billing API reports billingEnabled=false; Firebase Email/Password sign-in is enabled. No Functions deployment was performed.

All 57 production Firestore composite indexes are READY. Anonymous access to the production Admin profile returns HTTP 403. Spark deployment and index initialization are complete; first live CISapp import awaits the existing CISapp Admin sign-in through the app.

## Staff password and automatic-visit update

- 45 tests passed: Spark rule security plus visit date boundaries, stable identifiers and read-only paginated latest-order lookup.
- All eight browser checks passed, including six-digit Staff account creation, automatic generation at 10/11 days but not 9 days, concurrent duplicate prevention, preserving completed visits, and cancellation of pending visits/tasks after a newer order.
- Production Auth uses the default Firebase password policy; existing passwords were not changed.
- Source lookup uses the existing CISapp customerId ASC/date DESC index and projects only date/eligibility fields. First population of order dates requires Admin CISapp Sync.

Automatic-visit/password update deployed successfully to Spark Hosting and Firestore. Confirmed CISapp's customerId/date invoice index is already READY. All 115 CISapp source baseline files remain unchanged. Existing staff passwords were not reset; the new six-character minimum applies when creating Staff accounts.
