import { HEALTH_ROUTE_PATH } from "../../../shared/system/sharedConstants";

// Whether this page is still running the build the server is serving — and a reload onto the
// current one when it is not.
//
// The page carries the commit of the build that produced it, and a ready server names the commit it
// is running. When those disagree, this page was loaded before a deployment that has since landed,
// and everything it assumes about the server — how signals are encoded, which assets exist, what the
// API answers — is a build out of date. None of that can be repaired in place, so the page is
// re-loaded rather than left to run against a server it no longer agrees with.
//
// The question is asked at the two moments a page can have fallen behind without noticing: coming
// back to the foreground after a spell in the background, and re-establishing a socket that had
// dropped. A client that was awake through a deployment needs neither — the server disconnects it
// outright, and it reloads by that route instead (see @src/client/networking/client/socketsClient.ts).
const VersionSyncUtil =
{
    reloadIfOutdated: async (pageGitCommit: string): Promise<void> =>
    {
        // A build made outside a git checkout names no commit, and so has nothing to compare
        // against. A reload already on its way must also not be raced by a second one.
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

// The commit the server is running, or undefined whenever the question could not be answered: a
// server on its way out, a request that failed, a response that is not what this expects. An
// unanswered question is never taken for a mismatch — throwing the page away over a momentary
// network failure would cost the user their session for no reason at all.
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
