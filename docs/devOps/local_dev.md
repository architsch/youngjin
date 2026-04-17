# Local Development

## Prerequisite

1. Log into Google Cloud by running the following command. This will allow `devRunner.js` to fetch secrets from Google Secret Manager based on the local credentials.
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

3. Open up the browser and visit `http://127.0.0.1:3000/mypage` to access the app on `dev` mode (In the production environment (VPS), the app runs on `prod` mode and is accessible via either `https://app.thingspool.net/mypage` (live server) or `https://staging.thingspool.net/mypage` (staging server)).

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

Append `?devuser=N` to the `/mypage` URL to log in as a specific dev user:

- `http://127.0.0.1:3000/mypage?devuser=1` — logs in as DevMember1
- `http://127.0.0.1:3000/mypage?devuser=2` — logs in as DevMember2
- `http://127.0.0.1:3000/mypage?devuser=3` — logs in as DevMember3

This sets a JWT cookie, so subsequent visits to `http://127.0.0.1:3000/mypage` (without the query param) will remain logged in as that user. To switch to a different dev user, simply visit with a different `?devuser=N` value.

**Note:** The `?devuser` parameter is only available in `dev` mode and has no effect in staging or production.

## How to Push to GitHub

1. Stage the changes you want to commit.

2. Run `npm run beforeCommit` to make sure that the app bundles are production bundles.

3. Run `git commit -m "[Your Comment]"`

4. Run `git push` (Make sure that the remote origin is set)