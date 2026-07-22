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

Two contexts reach the same project, through two different auth mechanisms:

| Context | How it authenticates |
|---------|----------------------|
| VPS runtime (live & staging apps) | Service-account key file at `/root/service-account-key.json`, pointed to by `GOOGLE_APPLICATION_CREDENTIALS` (set in `ecosystem.config.js`). |
| Local development, and manual deploys (indexes, rules) | Application Default Credentials from `gcloud auth application-default login` — no key file involved. See [Local Development](local_dev.md). |

CI does **not** authenticate to Firebase at all: no workflow deploys Firebase assets (see [What the workflows deploy](#what-the-workflows-deploy)).

The service account is Firebase's auto-provisioned Admin SDK account, `firebase-adminsdk-fbsvc@thingspool.iam.gserviceaccount.com`. Uploading and rotating its key file on the VPS is covered in [Firebase Admin SDK Credentials setup](vps/networking-and-security.md#firebase-admin-sdk-credentials-setup-for-the-vps).

## IAM roles

This is the authoritative role list.

### Runtime — the app talking to Firebase

These are the **only** roles the service account needs. Keeping it to this set is deliberate: the account's key sits on the VPS and is loaded by every app process, so it is held to least privilege. Deploying indexes or rules is done manually under the user's own credentials (next section) rather than by widening this account.

| Role | Role ID | Why |
|------|---------|-----|
| Cloud Datastore User | `roles/datastore.user` | All Firestore document reads/writes, plus the collection listing done at startup. |
| Storage Object Admin | `roles/storage.objectAdmin` | Read/write/delete objects in Cloud Storage. |
| Secret Manager Secret Accessor | `roles/secretmanager.secretAccessor` | Read runtime secrets (see [Runtime secrets](#runtime-secrets-secret-manager)) — needed before the server can boot. |
| Firebase Admin SDK Administrator Service Agent | `roles/firebase.sdkAdminServiceAgent` | Auto-provisioned by Firebase for this account. Redundant given the three roles above, but it is re-granted whenever the key is regenerated from the Firebase Console, so it is left in place rather than fought with. |

The server initializes only Firestore and Cloud Storage — no Firebase Auth, Realtime Database, App Check, or Messaging — so roles covering those services are not needed.

### Deploying indexes and rules — permissions for the user running it

Manual deploys run under your own Google account (via `gcloud auth application-default login`), so a project Owner/Editor already has everything needed. If a deploy is ever run under a narrower identity, `firebase-tools` needs more than the ability to write index definitions, because a Firestore deploy does extra work under the hood:

| Capability | Role ID | Why it's needed |
|------------|---------|-----------------|
| Manage composite indexes | `roles/datastore.indexAdmin` | Create/update/delete composite indexes — the actual point of an index deploy. |
| Read enabled APIs | `roles/serviceusage.serviceUsageViewer` | `firebase-tools` checks which Google APIs are enabled on the project before deploying. |
| Publish/validate rules | `roles/firebaserules.admin` | `firebase-tools` compiles and validates `firestore.rules` on **every** Firestore deploy — including an indexes-only one, which does not publish rules but still compiles them. |

Missing any of these produces a `403 PERMISSION_DENIED`; see [Troubleshooting](#troubleshooting) for the error-to-role mapping. Note that `roles/firebaserules.admin` confers the ability to rewrite security rules — a good reason not to attach it to the long-lived runtime service account.

## Runtime secrets (Secret Manager)

Runtime secrets are stored in Secret Manager under the `thingspool` project — **not** in GitHub Secrets. On the VPS, `dev/scripts/bootstrap.js` runs before the server bundle and loads each secret into `process.env` from `projects/thingspool/secrets/<NAME>/versions/latest`. The secrets it expects:

- `JWT_SECRET_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

Reading them requires the Secret Manager Secret Accessor role listed above. Adding a new secret means creating it in Secret Manager and adding its name to the secret list in `bootstrap.js` (VPS) and `devRunner.js` (local dev). Local dev reads the same secrets through Application Default Credentials, so `gcloud auth application-default login` must have been run at least once.

## Firestore composite indexes

Index definitions live in `firestore.indexes.json` and are deployed **manually**. The concept, the per-environment twin-index requirement (`users` **and** `staging_users`), and the deploy command are documented in [Deployment → Firestore composite indexes](vps/deployment.md#firestore-composite-indexes).

## What the workflows deploy

**No workflow deploys anything to Firebase.** `deploy-staging.yml`, `promote-live.yml`, and `rollback-live.yml` build bundles and restart PM2 processes; none of them invokes `firebase-tools`.

| Firebase asset | Kept in sync by |
|----------------|-----------------|
| Composite indexes and `fieldOverrides` (`firestore.indexes.json`) | Manual deploy — see [Deployment → Firestore composite indexes](vps/deployment.md#firestore-composite-indexes) |
| Firestore security rules (`firestore.rules`) | Manual deploy |
| Cloud Storage rules (`storage.rules`) | Manual deploy |
| Firestore location, storage bucket, Secret Manager entries | Console-managed; not deployable |

This is deliberate. Firebase configuration changes very rarely, so automating it on every push bought little while costing a lot: it required granting the runtime service account three extra roles (including the ability to publish security rules), and it coupled unrelated code deploys to Firebase permissions — a failure there would break a deploy that had nothing to do with Firebase. Deploying by hand keeps the blast radius visible and the service account at least privilege.

Because a deploy is project-wide, it is also worth remembering that an index deploy affects **live and staging together** — the whole file is reconciled, both `users` and `staging_users` entries included.

What guards against a forgotten index is not automation but logging: the stale-guest cleanup logs a distinct error when its query fails, so a missing composite index surfaces immediately in the process logs instead of silently doing nothing. Any new query that depends on a composite index should follow the same pattern.

Since nothing deploys rules, editing `firestore.rules` or `storage.rules` has no effect on production until deployed by hand:
```
firebase deploy --only firestore:rules,storage
```
This has not caused trouble so far because both rulesets are deny-all backstops and all application access goes through the server's Admin SDK, which bypasses security rules entirely.

## Troubleshooting

**A manual `firebase deploy` fails with `403 PERMISSION_DENIED`.** The identity running the deploy lacks a required permission. Match the API named in the error to the role, grant it, and retry:

| Error mentions | Missing role |
|----------------|--------------|
| `datastore.googleapis.com` / an index operation | Cloud Datastore Index Admin |
| `serviceusage.googleapis.com` | Service Usage Viewer |
| `firebaserules.googleapis.com` | Firebase Rules Admin |

**A server query returns no results in staging/live but works locally, or the logs show `FAILED_PRECONDITION` / "DB Query Error".** The composite index that query needs is missing for that environment's collection. The Firestore emulator does not enforce composite indexes, so this never reproduces in local dev. Verify the index exists in the Firebase console (`Firestore → Indexes`) for the correct collection name — remember the `staging_` prefix — and that `firestore.indexes.json` contains a matching entry. See [Deployment → Firestore composite indexes](vps/deployment.md#firestore-composite-indexes).

**A newly created index sits in "Building" for a while.** Composite index creation is asynchronous; a large collection can take minutes. Queries needing that index keep failing with `FAILED_PRECONDITION` until it reaches "Enabled". Wait for the console to show the index as enabled before treating the deploy as effective.

**Secrets fail to load on VPS startup (`[bootstrap] Secret "..." has no payload`).** The named secret does not exist in Secret Manager, has no enabled version, or the service account lacks Secret Manager Secret Accessor.
