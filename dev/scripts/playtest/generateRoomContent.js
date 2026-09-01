// Loads the TypeScript room generator so a plain-JS script can call it.
//
// The generator is part of the shared game code and is written in TypeScript, with the
// extensionless relative imports the webpack build resolves. Node cannot run that directly, so
// the module is bundled in memory the first time it is asked for — with esbuild, which is
// already present as a dependency of the test runner, so this adds nothing to install and
// leaves no build artifact behind.
//
// Bundling from source rather than from `dist/` is deliberate: the point of seeding a
// procedurally generated room is that it was built by the generator the repository currently
// has, not by whatever was last compiled.

const path = require("path");
const Module = require("module");

const ENTRY = path.join(__dirname, "roomContentGenerator.ts");

let cached = null;

function load()
{
    if (cached) return cached;

    const esbuild = require("esbuild");
    const result = esbuild.buildSync({
        entryPoints: [ENTRY],
        bundle: true,
        write: false,
        platform: "node",
        format: "cjs",
        target: "node20",
        // three.js is only reached for types and math helpers here, but bundling it costs
        // seconds; leaving it external lets Node resolve the installed copy instead.
        external: ["three"],
        logLevel: "silent",
    });

    const code = result.outputFiles[0].text;
    const module_ = new Module(ENTRY, null);
    module_.filename = ENTRY;
    module_.paths = Module._nodeModulePaths(path.dirname(ENTRY));
    module_._compile(code, ENTRY);

    cached = module_.exports;
    return cached;
}

module.exports = {
    // (roomName, roomType, ownerUserID, ownerUserName, seed?) -> { texturePackPath, content, ... }
    // Passing a seed rebuilds exactly the same interior; leaving it out draws a fresh one.
    generateRoomContent: (...args) => load().generateRoomContent(...args),
};
