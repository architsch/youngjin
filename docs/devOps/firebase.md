# Firebase & Google Cloud

> Part of the DevOps guide — see also: [Local Development](local_dev.md) · VPS Hosting Guide: [Basic Setup](vps/basic-setup.md), [Networking & Security](vps/networking-and-security.md), [Deployment](vps/deployment.md)

Everything the project uses from Google Cloud lives under a single project, `thingspool`: Firestore (the database), Cloud Storage (user assets), and Secret Manager (runtime secrets). This page is the single source of truth for how that project is accessed and which IAM roles the service account needs. When a deploy or a query fails with a permission error, this is the page to check.

## Project & environment model

- **One Firebase/GCP project: `thingspool`.** The GCP project ID and the Firebase project ID are the same string. The default project is pinned in `.firebaserc`.
- Firestore location: `nam5`. Cloud Storage bucket: `thingspool.firebasestorage.app`.
- **Live and staging share this one project.** They are isolated by a collection-name prefix, not by separate projects. The `DB_PREFIX` environment variable controls it (set per-app in `ecosystem.config.js`):
  - **Live** (PM2 app `live`, port 3000): no prefix → collections `users`, `rooms`, …
  - **Staging** (PM2 app `staging`, port 3001): `DB_PREFIX="staging_"` → collections `staging_users`, `staging_rooms`, …
- **Consequence:** any per-collection configuration — composite indexes especially — must exist once for the live name and once for the `staging_` name. `users` and `staging_users` are distinct collection groups as far as Firestore is concerned. See [Firestore composite indexes](vps/deployment.md#firestore-composite-indexes).

## Credentials

Three contexts reach the same project through two different auth mechanisms:

| Context | How it authenticates |
|---------|----------------------|
| VPS runtime (live & staging apps) | Service-account key file at `/root/service-account-key.json`, pointed to by `GOOGLE_APPLICATION_CREDENTIALS` (set in `ecosystem.config.js`). |
| CI index deploy (self-hosted runner) | The same key file, via `GOOGLE_APPLICATION_CREDENTIALS` set on the "Deploy Firestore indexes" step of `deploy-staging.yml`. |
| Local development | Application Default Credentials from `gcloud auth application-default login` — no key file involved. See [Local Development](local_dev.md). |

The service account is Firebase's auto-provisioned Admin SDK account, `firebase-adminsdk-fbsvc@thingspool.iam.gserviceaccount.com`. Uploading and rotating its key file on the VPS is covered in [Firebase Admin SDK Credentials setup](vps/networking-and-security.md#firebase-admin-sdk-credentials-setup-for-the-vps).

## IAM roles

This is the authoritative role list. The service account needs **all** of these. They split into two groups by what uses them; because the VPS runner reuses the runtime service account to deploy indexes, the same account must hold both groups.

### Runtime — the app talking to Firebase

| Role | Role ID | Why |
|------|---------|-----|
| Datastore User | `roles/datastore.user` | Read/write Firestore documents. |
| Storage Object Admin | `roles/storage.objectAdmin` | Read/write user assets in Cloud Storage. |
| Secret Manager Secret Accessor | `roles/secretmanager.secretAccessor` | Read runtime secrets (see [Runtime secrets](#runtime-secrets-secret-manager)). |

### CI/CD — deploying Firestore indexes

The staging workflow runs `firebase-tools deploy --only firestore:indexes`. Even though the intent is indexes-only, firebase-tools does more under the hood than write index definitions, so it needs three roles beyond the runtime set:

| Role | Role ID | Why it's needed |
|------|---------|-----------------|
| Cloud Datastore Index Admin | `roles/datastore.indexAdmin` | Create/update/delete composite indexes — the actual point of the deploy. |
| Service Usage Viewer | `roles/serviceusage.serviceUsageViewer` | firebase-tools checks which Google APIs are enabled on the project before deploying. |
| Firebase Rules Admin | `roles/firebaserules.admin` | firebase-tools compiles and validates `firestore.rules` on **every** Firestore deploy, including an indexes-only one. |

Missing any CI role makes the deploy step fail with a `403 PERMISSION_DENIED`; see [Troubleshooting](#troubleshooting) for the error-to-role mapping. Grant roles in the Google Cloud Console under `IAM & Admin → IAM`: find the service account, edit it, and add the role.

## Runtime secrets (Secret Manager)

Runtime secrets are stored in Secret Manager under the `thingspool` project — **not** in GitHub Secrets. On the VPS, `dev/scripts/bootstrap.js` runs before the server bundle and loads each secret into `process.env` from `projects/thingspool/secrets/<NAME>/versions/latest`. The secrets it expects:

- `JWT_SECRET_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

Reading them requires the Secret Manager Secret Accessor role listed above. Adding a new secret means creating it in Secret Manager and adding its name to the secret list in `bootstrap.js` (VPS) and `devRunner.js` (local dev). Local dev reads the same secrets through Application Default Credentials, so `gcloud auth application-default login` must have been run at least once.

## Firestore composite indexes

Index definitions live in `firestore.indexes.json` and are deployed automatically by the staging workflow on every push to `main`. The concept, the per-environment twin-index requirement (`users` **and** `staging_users`), and manual deployment are documented in [Deployment → Firestore composite indexes](vps/deployment.md#firestore-composite-indexes).

## Troubleshooting

**The CI "Deploy Firestore indexes" step fails with `403 PERMISSION_DENIED`.** The service account is missing a CI role. Match the API named in the error to the role, grant it, and re-run the failed job:

| Error mentions | Missing role |
|----------------|--------------|
| `datastore.googleapis.com` / an index operation | Cloud Datastore Index Admin |
| `serviceusage.googleapis.com` | Service Usage Viewer |
| `firebaserules.googleapis.com` | Firebase Rules Admin |

**A server query returns no results in staging/live but works locally, or the logs show `FAILED_PRECONDITION` / "DB Query Error".** The composite index that query needs is missing for that environment's collection. The Firestore emulator does not enforce composite indexes, so this never reproduces in local dev. Verify the index exists in the Firebase console (`Firestore → Indexes`) for the correct collection name — remember the `staging_` prefix — and that `firestore.indexes.json` contains a matching entry. See [Deployment → Firestore composite indexes](vps/deployment.md#firestore-composite-indexes).

**A newly created index sits in "Building" for a while.** Composite index creation is asynchronous; a large collection can take minutes. Queries needing that index keep failing with `FAILED_PRECONDITION` until it reaches "Enabled". Wait for the console to show the index as enabled before treating the deploy as effective.

**Secrets fail to load on VPS startup (`[bootstrap] Secret "..." has no payload`).** The named secret does not exist in Secret Manager, has no enabled version, or the service account lacks Secret Manager Secret Accessor.
