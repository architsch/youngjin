# Authentication Flows

Reference: @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts , @src/server/user/util/userIdentificationUtil.ts , @src/server/user/util/userTokenUtil.ts , @src/server/user/util/userSignInUtil.ts , @src/server/user/maps/signInProviderMap.ts , @src/server/user/util/guestCreationLimitUtil.ts , @src/server/networking/util/rateLimitUtil.ts , @src/server/networking/router/api/userRouter.ts

## Connecting
1. The client requests the game page. All page and API routes are rate-limited per IP.
2. Paths that do not look like a room address get a 404 before any user lookup happens.
3. `UserIdentificationUtil` identifies the user:
   - a valid auth-token cookie loads the existing user;
   - a crawler, scanner, link-preview fetcher, scripted client or request with no User-Agent (`BotDetectionUtil`) gets the page without a session and no guest is created (the page shows a plain site description). Headless Chromium is not one of them, since E2E and playtests arrive as it;
   - otherwise a guest account is created (rate-limited) and its token is set as an HTTP-only cookie.

   The cookie is the only copy of a session, so never replace it by accident. **A failed lookup is refused, not treated as a missing account**, and only anonymous-facing routes ever create guests.
4. The server renders the page with the serialized user and environment injected.
5. The client opens a socket, and the cookie is sent with it. A pre-connection check rejects bot User-Agents. The auth middleware verifies the token and attaches the user to the socket.
6. The server registers the user, joins them to a room and tells the client which room.

AI agents use neither cookie nor socket: each request to the MCP endpoint carries the agent's key (see [agents.md](agents.md)). An agent's camera page identifies nobody: it is served without a session, and its socket carries the camera link's token instead of the cookie, which ties it to the agent watched rather than to a user (see [agents.md](agents.md#the-camera)).

## Sign-in / sign-up (OAuth)
A person signs in through a provider (`SignInProviderMap`: Google, GitHub, Discord), from the person button's row in edit mode; the browser is offered only the providers whose OAuth client is set up (all of them in dev, where `DevOAuthUtil` fakes the sign-in). Each provider has its own routes, and the flow after the provider is one (`UserSignInUtil`).

The sign-in route puts a random `state` in the provider URL and in a short-lived cookie, and the callback goes on only when the two match: only the browser that started a sign-in can finish it. The room it was started from is kept beside the state, and the callback sends the person back there, whichever account they now hold.

Accounts are found by email, so a provider must vouch for it: an email it hasn't verified is refused, since anyone could claim one.

After the provider callback, the server takes one of three paths:
- **New user with a guest session**: the guest is upgraded to a Member in place, keeping its id, token and state, and named after the provider's handle.
- **New user without a session**: a new Member is created.
- **Returning user**: a token for the existing account is issued, and the orphaned guest is deleted.

A session that already belongs to a Member is never overwritten or deleted. No person is given a room of their own (see [my_room.md](my_room.md)).

AI agents' hosts sign in by an OAuth of ThingsPool's own, which the server answers rather than asks (see [agents.md](agents.md#signing-in)).

## Rate limiting
Reference: @src/server/user/util/userBudgetUtil.ts , @src/server/user/util/userSignalDispatchUtil.ts

- **Guest creation and agent registration** share two rolling-window caps: a looser one per IP and a tighter one per IP + User-Agent (a User-Agent alone would be a global key). Both caps are checked before either is charged.
- **HTTP routes** are limited per IP, and violations are logged. The agents' endpoint has a looser limit of its own, since an agent calls it for every look and word, and its log line leaves out the path, which may hold a key.
- **What a user does in a room** is paid for from budgets of their own (`UserBudgetUtil`, `USER_BUDGETS`): edits, speech, reported moves, the distance their player covers, switches between play and edit mode, and an agent's tool calls, with the tools that only look budgeted apart from the rest. Each fills back up at a steady rate, set well above anything a person does, so only scripts meet them. They are kept by user, not by connection, so coming back refills nothing.
- In the dispatch browsers and agents share, an edit past its budget is refused and answered as one its own checks refuse is (see [voxel_grid_update.md](voxel_grid_update.md), [object_update.md](object_update.md)): the browser has applied it already, and left unanswered its room would part from the stored one until it came in again. A line of speech, a reported move or a switch of mode past its budget is dropped unanswered, as a throttled signal is. Agents' tools check first and say what was left undone (see [agents.md](agents.md)).

## Socket auth errors
Failures redirect to an error page: **auth failure** (bad token, missing user, middleware error), **no permission**, or **duplication** (the older socket of a user who connected again).

## Stale guest and agent cleanup
Reference: @src/server/db/util/dbUserUtil.ts , @src/server/system/serverConstants.ts

A periodic task deletes inactive guests, and inactive agents with their rooms (see [agents.md](agents.md)), cycling through engagement tiers (disposable, casual, dedicated). More engaged guests are kept longer. Agents go by the same tiers until they have built; one that has built is kept far longer in each, and for good past enough logins (`AgentCleanupUtil`). Requests close together count as one login. A failed lookup is logged rather than treated as "nothing to delete". The query needs a Firestore composite index (see [deployment.md](../devOps/vps/deployment.md)).
