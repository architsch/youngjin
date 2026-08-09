# Authentication Flows

Reference: @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts , @src/server/user/util/userIdentificationUtil.ts , @src/server/user/util/userTokenUtil.ts , @src/server/user/util/userAuthGoogleUtil.ts , @src/server/networking/util/cookieUtil.ts , @src/server/user/util/guestCreationLimitUtil.ts , @src/server/networking/util/rateLimitUtil.ts , @views/page/dynamic/mypage.ejs , @src/server/networking/router/api/userRouter.ts , @src/client/networking/client/userAPIClient.ts

## Client-Server Connection
1. The user requests the game page from the server. Page and API routes are rate-limited per IP.
2. A request naming a room is checked against the shape a room address has before anything else happens, and one of any other shape is answered as "not found". A room address is simply a name at the site's root, so everything the server is asked for that is not one of its own routes arrives looking like one — and identifying a user is too costly a thing to spend on a request that was never for a room.
3. The server identifies the user:
    - **If a valid auth-token cookie exists:** the token is verified and the existing user is loaded.
    - **If a self-declared crawler or link-preview fetcher is asking:** no account is made, and the page is rendered without a session. Such a client keeps no cookies, so it would otherwise mint a guest on every visit, and be refused outright once the guest allowance ran out — which is what would break the share previews and the site's standing with search engines.
    - **If neither:** a new guest account is created (subject to rate limits) and a token is issued as an HTTP-only cookie.
4. The server renders the game page, injecting the serialized user data and environment into it. Rendered without a session, the page presents a plain description of the site in place of the game, which cannot run without one.
5. The client loads the page, parses the user data, and opens a socket connection; the auth-token cookie is sent automatically.
6. Before accepting the socket, the server runs a pre-connection check that rejects connections whose User-Agent looks like a bot or crawler.
7. The server's socket auth middleware verifies the token, looks up the user, and attaches it to the socket. On failure the connection is rejected and the client is redirected to an error page (see below).
8. Once connected, the server registers the user, joins them to a room, and tells the client which room it joined.

## Client Sign-In & Sign-Up
1. A guest selects an auth provider (e.g. Google OAuth2); the browser is redirected through the provider's authorization page.
2. The user completes the provider's sign-in flow.
3. The provider redirects back to the server's callback with an authorization code.
4. The server exchanges the code for the user's profile and takes one of three paths:
    - **New user with an existing guest session:** the guest account is upgraded to a Member in place, preserving its identity, token, and gameplay state.
    - **New user with no guest session:** a fresh Member account is created.
    - **Returning user:** a token is issued for the existing account, and any orphaned guest account is deleted.

    Only a guest session is carried into the sign-in this way. A session already belonging to a Member is left exactly as it was: signing in as somebody else says nothing about the account being left, so it is never overwritten with the incoming identity nor deleted as an orphan — the browser simply ends up holding a token for the other account.
5. A user who has just become a Member and owns no room yet is given one, so that signing up is all it takes to have a place of one's own. A Member who already owns a room is signing in rather than signing up, so nothing is created for them.
6. The server redirects the browser back to the game, where the standard connection flow re-authenticates the user as a Member. A newly created room is named as the redirect target, which is what places the user inside it; everyone else resumes in the room they were in before signing in.

## Guest Account Rate Limiting
Guest account creation is capped along two dimensions, both scoped to the requesting client, each over a rolling time window with periodic cleanup:
- a looser cap per IP address, so that one shared network is not mistaken for one visitor;
- a tighter cap per client, identified by IP address and User-Agent *together*. A User-Agent on its own identifies a browser version rather than a visitor, and is shared by everyone running it, so a cap keyed on it alone would be global — a few visitors could lock out every other user of the same browser.

Both limits must be satisfied for creation to proceed, and both are evaluated before either is charged, so a request turned away by one limit does not spend budget against the other. This curbs automated mass account creation without letting one visitor's activity block unrelated visitors.

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
