# Authentication Flows

Reference: @views/page/dynamic/mypage.ejs , @src/server/networking/router/api/userRouter.ts , @src/client/networking/client/userAPIClient.ts , @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts , @src/server/user/util/userIdentificationUtil.ts , @src/server/user/util/userTokenUtil.ts , @src/server/user/util/userAuthGoogleUtil.ts , @src/server/networking/util/cookieUtil.ts

## Client-Server Connection
1. The user sends a `/mypage` (or `/mypage/:roomID`) HTTP request to the server.
2. The server's `UserIdentificationUtil.identifyAnyUser` middleware identifies the user:
    - **If a valid auth token cookie exists**: The JWT is verified, and the existing user is loaded from Firestore.
    - **If no valid auth token exists**: A new guest account is created (subject to rate limits) and a JWT is issued as an HTTP-only cookie.
3. The server renders `mypage.ejs`, injecting the serialized user data and environment variables into the page.
4. The client loads the page, parses the user data, and opens a Socket.IO connection. The auth token cookie is automatically included.
5. The server's socket auth middleware verifies the JWT from the cookie, looks up the user, and attaches it to the socket. If authentication fails, the connection is rejected.
6. Once connected, the server registers the user, joins them to a room, and unicasts a `RoomChangedSignal` to initialize the client.

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
