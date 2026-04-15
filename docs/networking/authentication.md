# Authentication Flows

Reference: @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts , @src/server/user/util/userIdentificationUtil.ts , @src/server/user/util/userTokenUtil.ts , @src/server/user/util/userAuthGoogleUtil.ts , @src/server/networking/util/cookieUtil.ts , @src/server/user/util/guestCreationLimitUtil.ts , @src/server/networking/util/rateLimitUtil.ts , @views/page/dynamic/mypage.ejs , @src/server/networking/router/api/userRouter.ts , @src/client/networking/client/userAPIClient.ts

## Client-Server Connection
1. The user sends a `/mypage` (or `/mypage/:roomID`) HTTP request to the server. HTTP rate limiting applies (20 requests per minute per IP for both page and API routes).
2. The server's `UserIdentificationUtil.identifyAnyUser` middleware identifies the user:
    - **If a valid auth token cookie exists**: The JWT is verified, and the existing user is loaded from Firestore.
    - **If no valid auth token exists**: A new guest account is created (subject to rate limits) and a JWT is issued as an HTTP-only cookie.
3. The server renders `mypage.ejs`, injecting the serialized user data and environment variables into the page.
4. The client loads the page, parses the user data, and opens a Socket.IO connection. The auth token cookie is automatically included.
5. Before accepting the socket, the server runs a pre-connection check (`allowRequest`) that inspects the User-Agent header and rejects connections from bots/crawlers (matching `/bot|crawler|spider|robot|crawling/i`) with a 403 response.
6. The server's socket auth middleware verifies the JWT from the cookie, looks up the user, and attaches it to the socket. If authentication fails, the connection is rejected and the client is redirected to an error page (see "Authentication Error Handling" below).
7. Once connected, the server registers the user, joins them to a room, and unicasts a `RoomChangedSignal` to initialize the client.

## Client Sign-In & Sign-Up
1. The client (playing as a guest) selects an auth provider (e.g. Google OAuth2). The browser is redirected to the server's login endpoint, which redirects to Google's authorization page.
2. The user completes the Google sign-in flow.
3. Google redirects back to the server's callback endpoint with an authorization code.
4. The server exchanges the code for an access token, fetches the user's profile, and takes one of three paths:
    - **New user, existing guest session**: The guest account is upgraded to a Member in-place (preserving the document ID, JWT, and all gameplay state).
    - **New user, no guest session**: A new Member account is created with a new JWT.
    - **Returning user**: A JWT is issued for the existing account. Any orphaned guest account is deleted.
5. The server redirects the browser to `/mypage`, where the standard connection flow re-authenticates the user as a Member.

## Client Logout
1. The client sends a POST request to the server's logout endpoint.
2. The server clears the auth token cookie.
3. On the next page load, the server creates a new guest account (see "Client-Server Connection" above).

## Guest Account Rate Limiting
Guest account creation is rate-limited along two independent dimensions:
- **IP-based limit**: 10 guest accounts per IP address per hour.
- **User-Agent-based limit**: 3 guest accounts per User-Agent string per hour.

Both limits use a sliding window with periodic cleanup every 10 minutes. Both limits must be satisfied for account creation to proceed. If either limit is exceeded, the request is rejected.

## HTTP API Rate Limiting
All page routes (`/mypage`, `/mypage/:roomID`) and API routes (`/api/user/*`, `/api/room/*`) are rate-limited to 20 requests per minute per IP via Express rate limiting middleware. Violations are logged with the offending IP and path.

## Authentication Error Handling
Socket authentication failures redirect the client to one of three error pages:
- **`auth-failure`**: Invalid or missing JWT token, user not found in database, or an exception in the auth middleware.
- **`auth-no-permission`**: User fails a custom authorization predicate (e.g. banned or restricted).
- **`auth-duplication`**: A new socket connection was detected for a user who already has an active socket (the old socket is redirected to this page and disconnected).

On the client side, a `connect_error` event is caught. If the error message contains a URL (starts with "http"), the client redirects the browser to that error page.

## Stale Guest Account Cleanup

Reference: @src/server/db/util/dbUserUtil.ts , @src/server/system/serverConstants.ts , @src/server/server.ts

Guest accounts that have not been used recently are automatically deleted by a periodic cleanup task. The server runs this task once per hour, cycling through three engagement tiers on each invocation (phase 0 → 1 → 2 → 0 → …).

### Engagement Tiers

Each guest account is classified into a tier based on its `loginCount` and `totalPlaytimeMs`:

| Tier | Name | Criteria | Max Age |
|------|------|----------|---------|
| 0 | Disposable | loginCount ≤ 1 or totalPlaytime < 10 min | 3 days |
| 1 | Casual | loginCount > 1 and totalPlaytime ≥ 10 min (but not Dedicated) | 7 days |
| 2 | Dedicated | loginCount > 3 and totalPlaytime ≥ 1 hour | 30 days |

### Algorithm
1. Query Firestore for all Guest-type users whose `lastLoginAt` is older than the tier's max age cutoff.
2. Filter the results in-memory by the tier's engagement criteria (loginCount and totalPlaytimeMs thresholds).
3. Delete all matching accounts from Firestore.
4. Return the number of deleted accounts.
