# Firebase & Google Cloud

One GCP/Firebase project, `thingspool` (pinned in `.firebaserc`), holds Firestore (`nam5`), Cloud Storage (`thingspool.firebasestorage.app`) and Secret Manager.

## Environments
Live and staging share the project and are separated by the `DB_PREFIX` collection prefix (set in `ecosystem.config.js`):
- **live** (PM2 `live`, port 3000): `users`, `rooms`, …
- **staging** (PM2 `staging`, port 3001): `staging_users`, `staging_rooms`, …

Per-collection configuration, **composite indexes in particular**, must exist for both names. A deploy reconciles the whole project, so it affects live and staging together.

## Credentials
| Context | Auth |
|---|---|
| VPS apps | Service-account key `/root/service-account-key.json` via `GOOGLE_APPLICATION_CREDENTIALS` |
| Local dev and manual deploys | Application Default Credentials (`gcloud auth application-default login`) |

CI never authenticates to Firebase. The service account is `firebase-adminsdk-fbsvc@thingspool.iam.gserviceaccount.com`. Key rotation is covered in [networking-and-security.md](vps/networking-and-security.md#firebase-admin-sdk-credentials-setup-for-the-vps).

## IAM roles
**Runtime service account (least privilege, do not widen):**
| Role ID | Why |
|---|---|
| `roles/datastore.user` | Firestore reads/writes |
| `roles/storage.objectAdmin` | Storage objects |
| `roles/secretmanager.secretAccessor` | secrets needed at boot |
| `roles/firebase.sdkAdminServiceAgent` | auto-granted by Firebase; left in place |

**A person running manual deploys** (an Owner or Editor already has these):
| Role ID | Why |
|---|---|
| `roles/datastore.indexAdmin` | index deploys |
| `roles/serviceusage.serviceUsageViewer` | firebase-tools API check |
| `roles/firebaserules.admin` | rules are compiled on every Firestore deploy |

## Runtime secrets
Secrets live in Secret Manager, not GitHub: `JWT_SECRET_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. They are loaded into `process.env` by `dev/scripts/bootstrap.js` (VPS) and `devRunner.js` (local). To add a secret, create it and add its name to both scripts.

## What is deployed manually
**No workflow deploys Firebase assets.** This keeps the runtime account at least privilege and keeps code deploys decoupled from Firebase.
| Asset | How |
|---|---|
| `firestore.indexes.json` | manual (see [deployment.md](vps/deployment.md#firestore-composite-indexes)) |
| `firestore.rules`, `storage.rules` | `firebase deploy --only firestore:rules,storage` (both are deny-all backstops; the Admin SDK bypasses them) |
| Location, bucket, secrets | console only |

A missing index is surfaced by logging: queries that depend on an index log a distinct error when they fail. New index-dependent queries should do the same.

## Troubleshooting
- **Deploy returns `403 PERMISSION_DENIED`**: an error naming `datastore` needs indexAdmin, `serviceusage` needs serviceUsageViewer, and `firebaserules` needs firebaserules.admin.
- **Query works locally but fails on the VPS with `FAILED_PRECONDITION`**: the index is missing for that environment's collection name. The emulator does not enforce indexes.
- **Index stuck in "Building"**: creation is asynchronous. Wait until it shows "Enabled".
- **`[bootstrap] Secret "..." has no payload`**: the secret or its enabled version is missing, or the accessor role is missing.
