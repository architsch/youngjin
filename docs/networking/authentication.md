# Authentication Flows

## Client-Server Connection Flow:
  1. The user sends a "/mypage" request to the server.
  2. The server authenticates the user (via UserIdentificationUtil) and returns the "/mypage" HTML page. This page, when loaded, fetches and runs the client app's bundle.
  3. The client sends a socket connection request (Socket.IO) to the server.
  4. The server authenticates the client (via "authMiddleware") and establishes a socket connection.
  5. Subsequently, the server puts the client (user) in a room and then returns the room's data to the client.
  6. The client receives the room's data and initializes the game based on it.

## Client Sign-In & Sign-Up
  1. If the client (user) is playing as a guest, he/she can sign-up by selecting one of the auth providers (such as Google OAuth2).
  2. Once the external sign-in/sign-up process is over, the server creates/updates the client's user-data in Firestore.
  3. Subsequently, the server lets the client reload the browser's page (i.e. "/mypage").
  4. Once reloaded, the page runs the client app again, letting the server re-authenticate the client and re-send the room data for initialization.