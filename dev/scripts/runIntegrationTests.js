// Runs the integration test suite with a Firestore emulator available to it.
//
// Most of the suite mocks the DB layer away and needs nothing. The DB suite is the exception: it
// drives the real query runners, so it needs a real Firestore to drive them against, and it skips
// itself when there is none. Leaving that to chance would mean the DB layer is covered only on the
// runs where somebody happened to have an emulator open — so this script makes sure there is one.
//
//   - An emulator is already listening (a `npm run dev` session, typically) -> reuse it. Starting a
//     second one would fail on the taken port, and the tests keep to their own collections anyway.
//   - Otherwise -> start a throwaway emulator that lives exactly as long as the test run.
//
// If no emulator can be started, the run fails rather than quietly proceeding without DB coverage.

const { spawn, spawnSync } = require("child_process");
const http = require("http");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "../..");
// Kept in step with the host the tests themselves default to (see vitest.config.ts).
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const VITEST_COMMAND = "npx vitest run";

function isEmulatorListening()
{
    const [host, port] = EMULATOR_HOST.split(":");
    return new Promise(resolve => {
        const request = http.get({ host, port: parseInt(port), path: "/", timeout: 1500 }, response => {
            response.resume();
            resolve(response.statusCode === 200);
        });
        request.on("timeout", () => { request.destroy(); resolve(false); });
        request.on("error", () => resolve(false));
    });
}

function isFirebaseCLIInstalled()
{
    return spawnSync("firebase", ["--version"], { stdio: "ignore", shell: true }).status === 0;
}

function run(command)
{
    return new Promise(resolve => {
        spawn(command, { cwd: REPO_ROOT, stdio: "inherit", shell: true })
            .on("close", code => resolve(code ?? 1));
    });
}

async function main()
{
    if (await isEmulatorListening())
    {
        console.log(`🔌 Using the Firestore emulator already running at ${EMULATOR_HOST}.`);
        process.exit(await run(VITEST_COMMAND));
    }

    if (!isFirebaseCLIInstalled())
    {
        console.error(
            `❌ No Firestore emulator at ${EMULATOR_HOST}, and the Firebase CLI is not installed for this Node.js version,` +
            `\n   so one cannot be started — the DB tests would be skipped.` +
            `\n   Globally installed CLIs belong to the Node.js version that installed them, so a version switch strands them.` +
            `\n   Fix: npm install -g firebase-tools   (or start an emulator yourself: npm run dev)`);
        process.exit(1);
    }

    console.log("🚀 Starting a throwaway Firestore emulator for this run...");
    process.exit(await run(`firebase emulators:exec --only firestore "${VITEST_COMMAND}"`));
}

main();
