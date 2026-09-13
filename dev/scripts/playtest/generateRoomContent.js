// Loads the TypeScript room generator for plain-JS scripts, bundling it in memory with esbuild on first
// use (no artifact). Bundled from source, not `dist/`, so seeded rooms come from the current generator.

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
        // three.js stays external (bundling it costs seconds).
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
    // A seed reproduces the same interior; omitting it draws a fresh one.
    generateRoomContent: (...args) => load().generateRoomContent(...args),
};
