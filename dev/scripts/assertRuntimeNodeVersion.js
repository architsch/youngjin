/**
 * Asserts that a PM2-managed app is actually running on the Node.js major version
 * declared in `.nvmrc`.
 *
 * `actions/setup-node` only governs the Node.js used to *build* within a workflow.
 * The PM2 daemon spawns apps with the `node` it inherited when the daemon itself
 * started, so a VPS whose system Node.js was never upgraded will keep serving
 * freshly-built bundles on a stale runtime, with nothing to indicate it. This turns
 * that silent drift into a failed deployment.
 *
 * Usage: node dev/scripts/assertRuntimeNodeVersion.js <pm2-app-name>
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const appName = process.argv[2];

if (!appName)
{
    console.error("❌ Usage: node dev/scripts/assertRuntimeNodeVersion.js <pm2-app-name>");
    process.exit(1);
}

const expectedMajor = fs
    .readFileSync(path.join(__dirname, "../../.nvmrc"), "utf8")
    .trim()
    .replace(/^v/, "")
    .split(".")[0];

// `pm2 jlist` may emit a banner ahead of its JSON, so slice out the array itself.
const raw = execSync("pm2 jlist", { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const apps = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));

const app = apps.find((entry) => entry.name === appName);

if (!app)
{
    console.error(`❌ PM2 has no app named "${appName}".`);
    process.exit(1);
}

// PM2 records this from the spawned process's own `process.versions.node`, so it is
// the true runtime version rather than whatever built the bundle.
const actualVersion = app.pm2_env && app.pm2_env.node_version;

if (!actualVersion)
{
    console.error(`❌ PM2 reported no runtime Node.js version for "${appName}" (status: ${app.pm2_env && app.pm2_env.status}).`);
    process.exit(1);
}

const actualMajor = actualVersion.split(".")[0];

if (actualMajor !== expectedMajor)
{
    console.error(`❌ "${appName}" is running on Node v${actualVersion}, but .nvmrc expects v${expectedMajor}.x.`);
    console.error(`   The PM2 daemon is still holding the old interpreter. On the VPS, install Node ${expectedMajor}.x,`);
    console.error(`   then run 'pm2 update' to respawn the daemon. See docs/devOps/vps/maintenance.md.`);
    process.exit(1);
}

console.log(`✅ "${appName}" is running on Node v${actualVersion} (matches .nvmrc: v${expectedMajor}.x).`);
process.exit(0);
