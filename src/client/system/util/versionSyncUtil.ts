import { HEALTH_ROUTE_PATH } from "../../../shared/system/sharedConstants";

// Reloads the page when the server's build commit differs from the page's. Checked on returning to
// the foreground and on socket reconnect; clients awake during a deploy are disconnected and reload
// that way (see @src/client/networking/client/socketsClient.ts).
const VersionSyncUtil =
{
    reloadIfOutdated: async (pageGitCommit: string): Promise<void> =>
    {
        // No commit (non-git build) means nothing to compare; also avoid racing a pending reload.
        if (pageGitCommit.length == 0 || reloading)
            return;

        const serverGitCommit = await fetchServerGitCommit();
        if (serverGitCommit == undefined || serverGitCommit === pageGitCommit)
            return;

        reloading = true;
        console.warn(`This page was built from ${pageGitCommit}, but the server is now running ` +
            `${serverGitCommit}. Reloading onto the current build...`);
        window.location.reload();
    },
}

let reloading = false;

// Server commit, or undefined if unknown. Unknown is never treated as a mismatch.
async function fetchServerGitCommit(): Promise<string | undefined>
{
    try
    {
        const response = await fetch(`/${HEALTH_ROUTE_PATH}`, { method: "GET", cache: "no-store" });
        if (!response.ok)
            return undefined;
        const serverGitCommit = (await response.json()).gitCommit;
        return typeof serverGitCommit === "string" && serverGitCommit.length > 0
            ? serverGitCommit
            : undefined;
    }
    catch (err)
    {
        return undefined;
    }
}

export default VersionSyncUtil;
