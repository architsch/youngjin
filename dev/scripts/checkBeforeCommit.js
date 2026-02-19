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

checkBundle("../../dist/client/bundle.js");
checkBundle("../../dist/server/bundle.js");

console.log("✅ Production build verified.");
process.exit(0);