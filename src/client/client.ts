// Imported first, and for its side effect: it starts copying everything the page writes to the
// browser console into a record the app can show back to the user (the "log" debug command). It has
// to come before anything else the client loads, or the app's earliest output is lost to it.
import "./system/util/consoleLogCaptureUtil";

import SocketsClient from "./networking/client/socketsClient";
import App from "./app";
import UIManager from "./ui/uiManager";
import VersionSyncUtil from "./system/util/versionSyncUtil";

import "../shared/graphics/image/imageMapDependencies.ts";
import "../shared/graphics/mesh/composition/instancedMeshCompositionBuilderMapDependencies.ts";

// Store the client-side env variables that were injected by the server via the game page route.
const env = (window as any).thingspool_env;
App.setEnv(env);

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