// Puts the plugin package together, as the plugin's own repository holds it (see docs/networking/agents.md): the
// manifests and README of dev/plugin/robot-rooms, the agents' manual as its skill, the site's logo as its icon, and
// the code's license.
//
//   node dev/scripts/plugin/buildPlugin.js [outDir]     default: temp/plugin/robot-rooms
//
// It only adds and replaces files, so it can write straight into a clone of that repository.

const fs = require("fs");
const path = require("path");

// The game's project folder; the site's pages and the license lie beside it, at the repository's root.
const PROJECT_ROOT = path.join(__dirname, "../../..");
const SOURCE_DIR = path.join(PROJECT_ROOT, "dev/plugin/robot-rooms");
const DEFAULT_OUT_DIR = path.join(PROJECT_ROOT, "temp/plugin/robot-rooms");

// What the package takes from elsewhere in this repository, by its path in the package.
const BORROWED_FILES = {
    "skills/robot-rooms/SKILL.md": "../public/RobotRooms/skill.md",
    ".claude-plugin/icon.png": "../public/extraLargeLogo.png",
    "LICENSE": "../LICENSE",
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
for (const [packagePath, projectPath] of Object.entries(BORROWED_FILES))
{
    const to = path.join(outDir, packagePath);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(PROJECT_ROOT, projectPath), to);
}
console.log(outDir);
