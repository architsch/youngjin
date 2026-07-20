# Local Development

## Prerequisite

1. Log into Google Cloud by running the following command. This will allow `devRunner.js` to fetch secrets from Google Secret Manager based on the local credentials. For the full picture of the project, service account, and secrets, see [Firebase & Google Cloud](firebase.md).
```
gcloud auth application-default login
```

## How to Run the Project Locally

1. Open up the terminal and navigate to the project's root directory.

2. Run one of the following commands:
    - `npm run dev` - for full development test
    - `npm run devcss` - for testing the CSS only
    - `npm run devclient` - for testing the client only
    - `npm run devserver` - for testing the server only
    - `npm run devnossg` - for full development test except the SSG

3. Open up the browser and visit `http://127.0.0.1:3000` to access the app on `dev` mode (In the production environment (VPS), the app runs on `prod` mode and is accessible via either `https://app.thingspool.net` (live server) or `https://staging.thingspool.net` (staging server)).

4. If you want to terminate the local instance, press `Ctrl+C` to exit the inner console and then run `npm stop` to terminate the PM2 process.

## Dev User Accounts

When `npm run dev` starts, the server automatically seeds 3 **Member** user accounts in the local Firestore emulator. These accounts bypass Google OAuth and let you quickly test member-only features (creating rooms, changing texture packs, registering editors, etc.).

### Seeded Accounts

| Index | Username    | Email                 |
|-------|-------------|-----------------------|
| 1     | DevMember1  | devmember1@test.com   |
| 2     | DevMember2  | devmember2@test.com   |
| 3     | DevMember3  | devmember3@test.com   |

### How to Use

Append `?devuser=N` to the game page URL to log in as a specific dev user:

- `http://127.0.0.1:3000?devuser=1` — logs in as DevMember1
- `http://127.0.0.1:3000?devuser=2` — logs in as DevMember2
- `http://127.0.0.1:3000?devuser=3` — logs in as DevMember3

This sets a JWT cookie, so subsequent visits to `http://127.0.0.1:3000` (without the query param) will remain logged in as that user. To switch to a different dev user, simply visit with a different `?devuser=N` value.

**Note:** The `?devuser` parameter is only available in `dev` mode and has no effect in staging or production.

## Cookie Reset Across Dev Restarts

The local Firestore emulator does not persist data: every fresh `npm run dev` starts with an empty DB (re-seeded dev users get brand-new document IDs). Auth cookies, however, live in the browser and survive across restarts — so without intervention a new runtime would try to resolve a user that no longer exists, or replay browser-scoped state (e.g. the "tutorial finished" flag) against a clean DB.

To prevent this, the server stamps each browser with a **boot id** identifying the current DevRunner runtime (stored in the `thingspool_dev_boot_id` cookie). The matching server-side id is kept in a marker document in the emulated DB, so its lifetime tracks the DB itself:

- **Full restart** (`npm stop` + `npm run dev`, or `Ctrl+C` then restart) resets the emulator → the marker is gone → a new boot id is minted. On the next page load the server sees the browser's stale boot id, clears its auth-related cookies, and treats it as a brand-new browser.
- **Hot reload** (an automatic restart triggered by a file change) leaves the emulator running → the marker persists → the same boot id is reused → existing cookies stay valid and your session is undisturbed.

This is dev-only; nothing of the sort runs in staging or production.

## How to Push to GitHub

1. Stage the changes you want to commit.

2. Run `npm run beforeCommit` to make sure that the app bundles are production bundles.

3. Run `git commit -m "[Your Comment]"`

4. Run `git push` (Make sure that the remote origin is set)