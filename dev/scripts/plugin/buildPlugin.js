// Puts the plugin package together, as the plugin's own repository holds it (see docs/networking/agents.md): the
// manifests and README of dev/plugin/thingspool, the agents' manual as its skill, the site's logo as its icon, and
// the code's license.
//
//   node dev/scripts/plugin/buildPlugin.js [outDir]     default: temp/plugin/thingspool
//
// It only adds and replaces files, so it can write straight into a clone of that repository.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "../../..");
const SOURCE_DIR = path.join(REPO_ROOT, "dev/plugin/thingspool");
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, "temp/plugin/thingspool");

// What the package takes from elsewhere in this repository, by its path in the package.
const BORROWED_FILES = {
    "skills/thingspool/SKILL.md": "public/skill.md",
    ".claude-plugin/icon.png": "public/extraLargeLogo.png",
    "LICENSE": "LICENSE",
};

function copySource(fromDir, toDir)
{
    for (const entry of fs.readdirSync(fromDir, { withFileTypes: true }))
    {
        // Plugin directories refuse a folder that holds one of Finder's files.
        if (entry.name === ".DS_Store")
            continue;
        const from = path.join(fromDir, entry.name);
        const to = path.join(toDir, entry.name);
        if (entry.isDirectory())
        {
            fs.mkdirSync(to, { recursive: true });
            copySource(from, to);
        }
        else
            fs.copyFileSync(from, to);
    }
}

const outDir = path.resolve(process.argv[2] ?? DEFAULT_OUT_DIR);
fs.mkdirSync(outDir, { recursive: true });
copySource(SOURCE_DIR, outDir);
for (const [packagePath, repoPath] of Object.entries(BORROWED_FILES))
{
    const to = path.join(outDir, packagePath);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, repoPath), to);
}
console.log(outDir);
