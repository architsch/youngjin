/**
 * Launcher used by Playwright's `webServer` (see playwright.config.ts) to run the
 * local dev stack for E2E tests with reliable startup AND teardown.
 *
 * Why this exists instead of pointing `webServer.command` at `npm run dev`:
 *
 *  - Startup: the Firebase emulator's Java process can outlive a previously killed
 *    run and keep holding its ports, so a fresh `firebase emulators:start` fails
 *    with "port taken". This launcher frees those ports first. It only runs when
 *    Playwright found no server on the app port (otherwise the server is reused and
 *    the command never runs), so no live dev server can be using them.
 *
 *  - Teardown: Playwright signals THIS process when the run ends. npm/concurrently
 *    don't reliably forward that signal down to the Firebase CLI, and the CLI spawns
 *    its Java emulators in a separate process group — so they orphan. Handling the
 *    signal here lets us kill the child's process group and sweep the emulator ports
 *    deterministically. `gracefulShutdown` in the config sends SIGTERM (not the
 *    default SIGKILL) so the handler below actually gets to run.
 */
const { spawn, execSync } = require("child_process");

// Firestore, Storage, Emulator Hub, reserved, Firestore websocket, Emulator UI.
const EMULATOR_PORTS = [8080, 9199, 4400, 4500, 9150, 4000];

function freeEmulatorPorts(reason)
{
    for (const port of EMULATOR_PORTS)
    {
        let pids = [];
        try
        {
            pids = execSync(`lsof -nP -tiTCP:${port} -sTCP:LISTEN`, { stdio: ["ignore", "pipe", "ignore"] })
                .toString().trim().split("\n").filter(Boolean);
        }
        catch (_) { /* lsof exits non-zero when nothing is listening — the normal case */ }

        for (const pid of pids)
        {
            try
            {
                process.kill(Number(pid), "SIGKILL");
                console.log(`[e2eDevServer] (${reason}) killed stale process ${pid} on port ${port}`);
            }
            catch (_) { /* already gone */ }
        }
    }
}

// 1. Clear any orphaned emulator left by a previously killed run before booting.
freeEmulatorPorts("startup");

// 2. Boot the dev stack in its own process group so we can signal the whole tree.
//    The npm script to run comes from argv (see playwright.config.ts) and defaults to
//    `devnossg` — the dev stack without static-site generation, which E2E doesn't need.
const npmScript = process.argv[2] || "devnossg";
const child = spawn("npm", ["run", npmScript], { stdio: "inherit", detached: true });

let cleanedUp = false;
function cleanup()
{
    if (cleanedUp)
        return;
    cleanedUp = true;
    // Terminate the child's process group, then sweep the emulator ports in case the
    // Firebase CLI's Java emulator was spawned into a group of its own and survives.
    try { process.kill(-child.pid, "SIGTERM"); } catch (_) { /* already exited */ }
    freeEmulatorPorts("teardown");
}

for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"])
    process.on(sig, () => { cleanup(); process.exit(0); });
process.on("exit", cleanup);

child.on("exit", (code) => process.exit(code == null ? 0 : code));
