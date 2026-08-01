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

    const content = fs.readFileSync(bundlePath, "utf8");

    const isProdBuild = content.startsWith("(()=>") || content.startsWith("/*! For license");

    if (!isProdBuild)
    {
        console.error(`❌ The bundle at [${pathStr}] is a development build. Run 'npm run beforeCommit' first.`);
        process.exit(1);
    }
}

// `.nvmrc` is the single source of truth for the Node.js major version — CI reads it
// via `actions/setup-node`, and the VPS runtime is asserted against it at deploy time.
// Verify that the two things it cannot reach on its own agree with it: package.json's
// declared engine range, and the Node.js actually running this commit's build.
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

checkBundle("../../dist/client/bundle.js");
checkBundle("../../dist/server/bundle.js");

console.log("✅ Production build and Node.js version verified.");
process.exit(0);