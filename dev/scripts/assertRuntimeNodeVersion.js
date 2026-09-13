/**
 * Asserts a PM2 app runs on the Node.js major version in `.nvmrc`. PM2 spawns apps with the `node` its
 * daemon inherited, so a stale VPS runtime would otherwise go unnoticed after a deploy.
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

// Recorded from the spawned process itself, so it's the true runtime version.
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
