# Authentication Flows

Reference: @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts , @src/server/user/util/userIdentificationUtil.ts , @src/server/user/util/userTokenUtil.ts , @src/server/user/util/userAuthGoogleUtil.ts , @src/server/user/util/guestCreationLimitUtil.ts , @src/server/networking/util/rateLimitUtil.ts , @src/server/networking/router/api/userRouter.ts

## Connecting
1. The client requests the game page. All page and API routes are rate-limited per IP.
2. Paths that do not look like a room address get a 404 before any user lookup happens.
3. `UserIdentificationUtil` identifies the user:
   - a valid auth-token cookie loads the existing user;
   - a self-declared crawler or link-preview bot gets the page without a session and no guest is created (the page shows a plain site description);
   - otherwise a guest account is created (rate-limited) and its token is set as an HTTP-only cookie.

   The cookie is the only copy of a session, so never replace it by accident. **A failed lookup is refused, not treated as a missing account**, and only anonymous-facing routes ever create guests.
4. The server renders the page with the serialized user and environment injected.
5. The client opens a socket, and the cookie is sent with it. A pre-connection check rejects bot User-Agents. The auth middleware verifies the token and attaches the user to the socket.
6. The server registers the user, joins them to a room and tells the client which room.

## Sign-in / sign-up (OAuth)
After the provider callback, the server takes one of three paths:
- **New user with a guest session**: the guest is upgraded to a Member in place, keeping its id, token and state.
- **New user without a session**: a new Member is created.
- **Returning user**: a token for the existing account is issued, and the orphaned guest is deleted.

A session that already belongs to a Member is never overwritten or deleted. A new Member without a room is given one and redirected into it. Everyone else returns to the room they were in.

## Rate limiting
- **Guest creation** has two rolling-window caps: a looser one per IP and a tighter one per IP + User-Agent (a User-Agent alone would be a global key). Both caps are checked before either is charged.
- **HTTP routes** are limited per IP, and violations are logged.

## Socket auth errors
Failures redirect to an error page: **auth failure** (bad token, missing user, middleware error), **no permission**, or **duplication** (the older socket of a user who connected again).

## Stale guest cleanup
Reference: @src/server/db/util/dbUserUtil.ts , @src/server/system/serverConstants.ts

A periodic task deletes inactive guests, cycling through engagement tiers (disposable, casual, dedicated). More engaged guests are kept longer. Requests close together count as one login. A failed lookup is logged rather than treated as "nothing to delete". The query needs a Firestore composite index (see [deployment.md](../devOps/vps/deployment.md)).
