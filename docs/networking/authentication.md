# Authentication Flows

Reference: @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts , @src/server/user/util/userIdentificationUtil.ts , @src/server/user/util/userTokenUtil.ts , @src/server/user/util/userAuthGoogleUtil.ts , @src/server/networking/util/cookieUtil.ts , @src/server/user/util/guestCreationLimitUtil.ts , @src/server/networking/util/rateLimitUtil.ts , @views/page/dynamic/mypage.ejs , @src/server/networking/router/api/userRouter.ts , @src/client/networking/client/userAPIClient.ts

## Client-Server Connection
1. The user requests the game page from the server. Page and API routes are rate-limited per IP.
2. The server identifies the user:
    - **If a valid auth-token cookie exists:** the token is verified and the existing user is loaded.
    - **If not:** a new guest account is created (subject to rate limits) and a token is issued as an HTTP-only cookie.
3. The server renders the game page, injecting the serialized user data and environment into it.
4. The client loads the page, parses the user data, and opens a socket connection; the auth-token cookie is sent automatically.
5. Before accepting the socket, the server runs a pre-connection check that rejects connections whose User-Agent looks like a bot or crawler.
6. The server's socket auth middleware verifies the token, looks up the user, and attaches it to the socket. On failure the connection is rejected and the client is redirected to an error page (see below).
7. Once connected, the server registers the user, joins them to a room, and tells the client which room it joined.

## Client Sign-In & Sign-Up
1. A guest selects an auth provider (e.g. Google OAuth2); the browser is redirected through the provider's authorization page.
2. The user completes the provider's sign-in flow.
3. The provider redirects back to the server's callback with an authorization code.
4. The server exchanges the code for the user's profile and takes one of three paths:
    - **New user with an existing guest session:** the guest account is upgraded to a Member in place, preserving its identity, token, and gameplay state.
    - **New user with no guest session:** a fresh Member account is created.
    - **Returning user:** a token is issued for the existing account, and any orphaned guest account is deleted.
5. The server redirects the browser back to the game, where the standard connection flow re-authenticates the user as a Member.

## Client Logout
1. The client asks the server to log out.
2. The server clears the auth-token cookie.
3. On the next page load, the user is treated as a new guest (see "Client-Server Connection").

## Guest Account Rate Limiting
Guest account creation is capped along two independent dimensions — per IP address and per User-Agent — each over a rolling time window with periodic cleanup. Both limits must be satisfied for creation to proceed; if either is exceeded, the request is rejected. This curbs automated mass account creation.

## HTTP API Rate Limiting
All page and API routes are rate-limited per IP, and violations are logged with the offending IP and path.

## Authentication Error Handling
Socket authentication failures redirect the client to one of three error pages:
- **Auth failure** — invalid or missing token, user not found, or an error in the auth middleware.
- **No permission** — the user fails an authorization check (e.g. banned or restricted).
- **Duplication** — a new connection arrived for a user who already has an active socket; the old socket is redirected here and disconnected.

On the client, a connection error carrying an error-page URL triggers a redirect to that page.

## Stale Guest Account Cleanup

Reference: @src/server/db/util/dbUserUtil.ts , @src/server/system/serverConstants.ts , @src/server/server.ts

Unused guest accounts are deleted by a periodic background task, which cycles through engagement tiers on successive runs. Each guest is classified by how many distinct logins it has accumulated, and more engaged accounts are retained longer before becoming eligible for deletion. Requests arriving in close succession belong to the same visit and count as a single login; only a return after a sufficiently long period of inactivity counts as another. This keeps the many requests fired during one play session from inflating a guest's engagement tier.

| Tier | Engagement | Retained |
|------|------------|----------|
| Disposable | barely used | shortest |
| Casual | occasionally used | medium |
| Dedicated | frequently used | longest |

For the active tier, the task finds guests whose last login is older than that tier's cutoff and deletes them. If the lookup for stale guests fails, the task logs the failure rather than silently treating it as "nothing to delete", so a persistently broken cleanup does not masquerade as a healthy one.

The lookup requires a Firestore composite index; see the [deployment guide](../devOps/vps/deployment.md) for how indexes are kept in sync with the DB.
