import SocketsClient from "./networking/client/socketsClient";
import App from "./app";
import UIManager from "./ui/uiManager";

import "../shared/image/imageMapDependencies.ts";

// Store the client-side env variables that were injected by the server via "/mypage".
const env = (window as any).thingspool_env;
App.setEnv(env);

SocketsClient.init(env); // Starting establishing a socket connection.
UIManager.load(env, App.getUser()); // Initialize the UI system.