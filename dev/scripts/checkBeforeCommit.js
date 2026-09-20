const fs = require("fs");
const path = require("path");

function checkBundle(pathStr)
{
    const bundlePath = path.join(__dirname, pathStr);

    if (!fs.existsSync(bundlePath))
    {
        console.error(`❌ No bundle found at [${pathStr}]. Run 'npm run beforeCommit' first.`);
        process.exit(1);
    }

    // Only an unminified build carries webpack's commented bootstrap banner. Checking for its
    // absence covers every shape a production chunk comes in — the entry bundle, a chunk that
    // starts with an extracted license comment, and one that starts by registering its modules.
    const isDevBuild = fs.readFileSync(bundlePath, "utf8").startsWith("/******/");

    if (isDevBuild)
    {
        console.error(`❌ The bundle at [${pathStr}] is a development build. Run 'npm run beforeCommit' first.`);
        process.exit(1);
    }
}

// `.nvmrc` is the source of truth for the Node.js major version (CI and the VPS use it); checks that
// package.json's engines range and the running Node.js agree with it.
function checkNodeVersion()
{
    const expectedMajor = fs.readFileSync(path.join(__dirname, "../../.nvmrc"), "utf8")
        .trim()
        .replace(/^v/, "")
        .split(".")[0];

    const runningMajor = process.versions.node.split(".")[0];

    if (runningMajor !== expectedMajor)
    {
        console.error(`❌ Node v${process.versions.node} is building this commit, but .nvmrc expects v${expectedMajor}.x. Run 'nvm use'.`);
        process.exit(1);
    }

    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../../package.json"), "utf8"));
    const enginesRange = (packageJson.engines && packageJson.engines.node) || "";
    const enginesMajor = (enginesRange.match(/\d+/) || [])[0];

    if (enginesMajor !== expectedMajor)
    {
        console.error(`❌ package.json declares engines.node "${enginesRange}", which disagrees with .nvmrc (v${expectedMajor}.x).`);
        process.exit(1);
    }
}

checkNodeVersion();

// Every chunk the game page loads, not just the entry bundle — the dependency chunks beside it are
// committed too, and a stale one breaks the page just as thoroughly (see webpack.config.client.js).
const clientDir = path.join(__dirname, "../../dist/client");
const clientChunks = fs.readdirSync(clientDir).filter((fileName) => fileName.endsWith(".js")
    && !fileName.includes(".live.") && !fileName.includes(".backup."));

if (!clientChunks.includes("bundle.js"))
{
    console.error(`❌ No client bundle found in [dist/client]. Run 'npm run beforeCommit' first.`);
    process.exit(1);
}

for (const chunk of clientChunks)
    checkBundle(`../../dist/client/${chunk}`);

checkBundle("../../dist/server/bundle.js");

console.log("✅ Production build and Node.js version verified.");
process.exit(0);