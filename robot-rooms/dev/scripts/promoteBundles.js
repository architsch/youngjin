// Moves bundles between the three copies the VPS keeps of them: the staging build (what a deploy
// writes), the live copy the live server serves, and the backup a rollback restores from.
//
//   node dev/scripts/promoteBundles.js backup     *.live.*   -> *.backup.*
//   node dev/scripts/promoteBundles.js promote    staging    -> *.live.*
//   node dev/scripts/promoteBundles.js rollback   *.backup.* -> *.live.*
//
// The client is a set of chunks rather than one file (see webpack.config.client.js), each with a
// .gz and .br copy beside it, so the set is read off disk rather than listed here — a chunk added
// or renamed by a build is carried across without this script having to know its name.

const fs = require("fs");
const path = require("path");

const CLIENT_DIR = path.join(__dirname, "../../dist/client");
const SERVER_DIR = path.join(__dirname, "../../dist/server");

const VARIANTS = ["live", "backup"];

function isVariant(fileName)
{
    return VARIANTS.some((variant) => fileName.includes(`.${variant}.`));
}

// "vendor.three.js" + "live" -> "vendor.three.live.js". A trailing .gz/.br rides along, so
// "bundle.js.br" -> "bundle.live.js.br".
function withVariant(fileName, variant)
{
    const parts = fileName.match(/^(.*)\.(js|css)(\.gz|\.br)?$/);
    if (parts == null)
        return undefined;
    return `${parts[1]}.${variant}.${parts[2]}${parts[3] ?? ""}`;
}

function copy(dir, fromName, toName)
{
    fs.copyFileSync(path.join(dir, fromName), path.join(dir, toName));
    console.log(`  ${path.basename(dir)}/${fromName} -> ${toName}`);
}

// Everything Nginx serves off disk, plus the compressed copies beside it.
function stagingFiles()
{
    return fs.readdirSync(CLIENT_DIR).filter((fileName) =>
        /\.(js|css)(\.gz|\.br)?$/.test(fileName) && !isVariant(fileName));
}

function variantFiles(variant)
{
    return fs.readdirSync(CLIENT_DIR).filter((fileName) => fileName.includes(`.${variant}.`));
}

// A chunk that a later build renamed or dropped would otherwise be left behind and keep being
// served, because nothing else ever deletes it.
function removeStale(variant, keep)
{
    for (const fileName of variantFiles(variant))
    {
        if (!keep.has(fileName))
        {
            fs.unlinkSync(path.join(CLIENT_DIR, fileName));
            console.log(`  removed stale client/${fileName}`);
        }
    }
}

function writeVariant(fromVariant, toVariant)
{
    const sources = fromVariant == undefined ? stagingFiles() : variantFiles(fromVariant);
    const written = new Set();

    for (const fileName of sources)
    {
        const target = fromVariant == undefined
            ? withVariant(fileName, toVariant)
            : fileName.replace(`.${fromVariant}.`, `.${toVariant}.`);
        if (target == undefined)
            continue;
        copy(CLIENT_DIR, fileName, target);
        written.add(target);
    }

    removeStale(toVariant, written);
}

function copyServerBundle(fromName, toName)
{
    const fromPath = path.join(SERVER_DIR, fromName);
    if (!fs.existsSync(fromPath))
    {
        console.error(`❌ No server bundle at [dist/server/${fromName}].`);
        process.exit(1);
    }
    copy(SERVER_DIR, fromName, toName);
}

const action = process.argv[2];

switch (action)
{
    case "backup":
        console.log("Backing up the live bundles:");
        writeVariant("live", "backup");
        copyServerBundle("bundle.live.js", "bundle.backup.js");
        break;
    case "promote":
        console.log("Promoting the staging bundles to live:");
        writeVariant(undefined, "live");
        copyServerBundle("bundle.js", "bundle.live.js");
        break;
    case "rollback":
        console.log("Restoring the live bundles from backup:");
        writeVariant("backup", "live");
        copyServerBundle("bundle.backup.js", "bundle.live.js");
        break;
    default:
        console.error(`❌ Unknown action [${action}]. Expected backup, promote or rollback.`);
        process.exit(1);
}

console.log("✅ Done.");
