/**
 * Playwright `webServer` launcher (see playwright.config.ts) for the local dev stack, with reliable
 * startup and teardown:
 *  - Startup: frees emulator ports an orphaned Java emulator may hold (it runs only when Playwright found
 *    no server, so no live dev server is using them).
 *  - Teardown: npm/concurrently don't reliably forward Playwright's signal, and the Firebase CLI puts its
 *    emulators in their own process group, so this kills the child's group and sweeps the ports.
 *    `gracefulShutdown` in the config sends SIGTERM (not SIGKILL) so the handler runs.
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

// 2. Boot the dev stack in its own process group. The npm script comes from argv (see
//    playwright.config.ts), defaulting to `devnossg` (no SSG).
const npmScript = process.argv[2] || "devnossg";
const child = spawn("npm", ["run", npmScript], { stdio: "inherit", detached: true });

let cleanedUp = false;
function cleanup()
{
    if (cleanedUp)
        return;
    cleanedUp = true;
    // Kill the child's group, then sweep the emulator ports in case the Java emulator escaped it.
    try { process.kill(-child.pid, "SIGTERM"); } catch (_) { /* already exited */ }
    freeEmulatorPorts("teardown");
}

for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"])
    process.on(sig, () => { cleanup(); process.exit(0); });
process.on("exit", cleanup);

child.on("exit", (code) => process.exit(code == null ? 0 : code));
