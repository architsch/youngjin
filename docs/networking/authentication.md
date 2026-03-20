# Authentication Flows

Reference: @views/page/dynamic/mypage.ejs , @src/server/networking/router/api/userRouter.ts , @src/client/networking/client/userAPIClient.ts , @src/server/sockets/sockets.ts , @src/client/networking/client/socketsClient.ts , @src/server/user/util/userIdentificationUtil.ts , @src/server/user/util/userTokenUtil.ts , @src/server/user/util/userAuthGoogleUtil.ts , @src/server/networking/util/cookieUtil.ts

## Client-Server Connection
1. The user sends a `/mypage` (or `/mypage/:roomID`) HTTP request to the server.
2. The server's `PageRouter` invokes `UserIdentificationUtil.identifyAnyUser` middleware, which identifies or creates the user:
    - **If an auth token cookie exists** (cookie name: `thingspool_token`, or `thingspool_token_dev` in dev mode):
        1. `UserTokenUtil.getUserIdFromToken` verifies the JWT (using the `JWT_SECRET_KEY` env var) and extracts the user ID from its payload.
        2. `DBUserUtil.findUserById` looks up the user document in Firestore.
        3. If the user is found, `DBUserUtil.updateLastLogin` updates the `lastLoginAt` timestamp and increments `loginCount`. The existing user is used.
        4. If the user is not found (e.g. deleted account), the flow falls through to guest creation below.
    - **If no auth token cookie exists** (or the token/user is invalid):
        1. `GuestCreationLimitUtil.allowGuestCreation` checks rate limits (max 10 guests per IP per hour, max 3 per User-Agent per hour). If the limit is exceeded, the request is rejected.
        2. A unique guest name is generated as `Guest-{hexID}`, where `hexID` is derived from a combination of the current timestamp and a cycling counter.
        3. `DBUserUtil.createUser` creates a new guest document in Firestore with `userType: Guest`, empty email, `tutorialStep: 0`, and empty `lastRoomID`/`ownedRoomID`.
        4. `UserTokenUtil.addTokenForUserId` creates a JWT (with the new guest's document ID as payload) and sets it as an HTTP-only cookie (`secure: true` in production, `sameSite: "lax"`, `maxAge: ~100 years`).
3. The middleware sets `req.userString` to the user's serialized form (`User.toString()`, which returns a space-separated string: `id userName userType email tutorialStep ownedRoomID`).
4. `EJSUtil.render` renders the `mypage.ejs` template, injecting `userString` (along with `targetRoomID`, server URLs, and other env vars) into the HTML page as `window.thingspool_env`.
5. The client's browser loads the page, which fetches and runs the client app's bundle (`bundle.js`).
6. The client calls `App.setEnv(thingspool_env)`, which parses `userString` via `User.fromString()` to reconstruct the `User` object on the client side.
7. The client calls `SocketsClient.init`, which opens a Socket.IO connection. The browser automatically includes the auth token cookie in the connection request's headers.
8. The server's socket auth middleware (`makeAuthMiddleware`) authenticates the socket:
    1. It parses the cookie header from `socket.request.headers.cookie`.
    2. It extracts the auth token and verifies the JWT via `UserTokenUtil.getUserIdFromToken`.
    3. It looks up the user in Firestore via `DBUserUtil.findUserById`.
    4. It attaches the `User` object to `socket.handshake.auth` for use by the connection handler.
    5. If any step fails (no cookie, invalid token, user not found), the connection is rejected with an error URL pointing to an auth-failure page.
9. Once the socket connection is established, the server creates a `SocketUserContext`, registers the user in `UserManager`, and joins the user to a room (see `user_state_management.md` for room-joining details).
10. The server unicasts a `RoomChangedSignal` (which bundles the room's `RoomRuntimeMemory` and the user's current role) to the client, and the client initializes the game based on it.

## Client Sign-In & Sign-Up
1. If the client (user) is playing as a guest, he/she can sign up by selecting one of the auth providers (such as Google OAuth2). The client calls `UserAPIClient.loginWithGoogle()`, which redirects the browser to the server's `/user/login_google` endpoint.
2. The server's `UserAuthGoogleUtil.login` handler redirects the browser to Google's OAuth2 authorization URL (with the app's client ID, scopes `openid profile email`, a redirect URI pointing to `/user/login_google_callback`, and `prompt=consent`).
3. The user completes the Google sign-in flow in the browser.
4. Google redirects the browser back to the server's `/user/login_google_callback` endpoint with an authorization code.
5. The server's `UserAuthGoogleUtil.loginCallback` handler processes the callback:
    1. It exchanges the authorization code for an access token by POSTing to Google's token endpoint (with the app's client ID and client secret).
    2. It uses the access token to fetch the user's profile info (email, name) from Google's userinfo API.
    3. It derives a base username from the email prefix and checks `DBSearchUtil.users.withEmail` to see if the email already exists in Firestore.
    4. One of three paths is taken:
        - **New user, existing guest session**: The current auth token cookie identifies a guest account. `DBUserUtil.upgradeGuestToMember` upgrades the guest document in-place (changing `userType` from `Guest` to `Member`, setting `userName` and `email`). The document ID stays the same, so the existing JWT remains valid and all gameplay state (room, position, etc.) is preserved.
        - **New user, no guest session**: `DBUserUtil.createUser` creates a new Member document in Firestore. A new JWT is signed with the new document ID and set as a cookie.
        - **Returning user** (email already exists in Firestore): A new JWT is signed with the existing account's document ID and set as a cookie. If the current cookie identifies a different guest account, that orphaned guest is deleted (fire-and-forget).
6. The server redirects the browser to `/mypage`.
7. Once redirected, the page runs the client app again, letting the server re-authenticate the client (now as a Member) and re-send the room data for initialization (see "Client-Server Connection" above).

## Client Logout
1. The client calls `UserAPIClient.logout()`, which sends a `POST` request to the server's `/user/logout` endpoint.
2. The server's `UserTokenUtil.clearToken` handler clears the auth token cookie from the response.
3. After receiving the response, the client can reload the page. On the next `/mypage` request, the server's `identifyAnyUser` middleware will find no auth token and create a new guest account (see "Client-Server Connection" above).