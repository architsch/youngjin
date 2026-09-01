// Imported first, and for its side effect: it starts copying everything the page writes to the
// browser console into a record the app can show back to the user (the "log" debug command). It has
// to come before anything else the client loads, or the app's earliest output is lost to it.
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

// Anything driving this page from outside it — an automated playtest, a scripted screen capture —
// needs to know where the room put things before it can aim at them, and needs to be standing
// somewhere sensible before it aims. The two are deliberately separate surfaces: one only reports,
// the other only arranges, and neither acts. Installed here so both are ready before the first room
// arrives, and only away from the public site (see AutomationBridgeUtil).
AutomationBridgeUtil.install(env);
AutomationSetupUtil.install(env);

SocketsClient.init(env); // Starting establishing a socket connection.
UIManager.load(env, App.getUser()); // Initialize the UI system.

// A page left sitting in a background tab can come back to a server that has deployed a newer build
// since the page was loaded, and nothing about coming back would otherwise tell it so. Returning to
// the foreground is therefore one of the two moments this page's build is checked against the
// server's — the other being a socket that had to be re-established (see SocketsClient).
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible")
        void VersionSyncUtil.reloadIfOutdated(env.gitCommit);
});

// Handing the browser over to an auth provider, or signing out, is meant to be the last thing a
// page does. A back navigation can bring such a page back all the same, and the browser's cache
// returns it exactly as it was left: its departure still showing over the screen, its socket
// dropped, its drawing context gone, and the account it was rendered for no longer necessarily the
// one now signed in. There is nothing there to pick up, so it is loaded afresh instead.
window.addEventListener("pageshow", (ev: PageTransitionEvent) => {
    if (ev.persisted && ongoingClientProcessExists("pageTerminated"))
        window.location.reload();
});