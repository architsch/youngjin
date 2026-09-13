// Must be imported first, to capture console output for the "log" debug command from the start.
import "./system/util/consoleLogCaptureUtil";

import SocketsClient from "./networking/client/socketsClient";
import App from "./app";
import AutomationBridgeUtil from "./system/util/automationBridgeUtil";
import AutomationSetupUtil from "./system/util/automationSetupUtil";
import UIManager from "./ui/uiManager";
import VersionSyncUtil from "./system/util/versionSyncUtil";
import { ongoingClientProcessExists } from "./system/types/clientProcess";

import "../shared/graphics/image/imageMapDependencies.ts";
import "../shared/graphics/mesh/composition/instancedMeshCompositionBuilderMapDependencies.ts";

// Store the client-side env variables that were injected by the server via the game page route.
const env = (window as any).thingspool_env;
App.setEnv(env);

// Automation surfaces for playtests and screen capture: one only reports, the other only arranges.
// Installed before the first room, and not on the public site (see AutomationBridgeUtil).
AutomationBridgeUtil.install(env);
AutomationSetupUtil.install(env);

SocketsClient.init(env); // Starting establishing a socket connection.
UIManager.load(env, App.getUser()); // Initialize the UI system.

// A backgrounded page may have missed a deployment; check the build on return (also checked on
// socket reconnect, see SocketsClient).
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible")
        void VersionSyncUtil.reloadIfOutdated(env.gitCommit);
});

// A bfcache-restored page after an auth redirect or sign-out is stale (no socket, no context, maybe
// a different account), so reload it.
window.addEventListener("pageshow", (ev: PageTransitionEvent) => {
    if (ev.persisted && ongoingClientProcessExists("pageTerminated"))
        window.location.reload();
});