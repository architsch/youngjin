// Lists the audio files under the site's audio folder (../public/app/assets/audio), each with what uses it; then the
// obsolete ones, which nothing uses and which are removed by hand (see .claude/rules/audio-files.md); then any file
// something names that isn't there.
//
//   node dev/scripts/audio/findObsoleteAudio.js
//
// A file is in use while the map this build writes names it (its bundle, a stream), the audio manifest lists it (a
// recording the bundle is made from, a stream), or a build on the server plays it: staging, live, or the backup a rollback
// restores (see promoteBundles.js). The site serves them all alike, and the backup's client is served to no one, so the
// three are read off the server's disk, in one SSH round trip with a fixed, read-only command.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const AUDIO_DIR = path.join(__dirname, "../../../../public/app/assets/audio");
const MAP_FILE = path.join(__dirname, "../../../src/client/audio/maps/audioBundleMap.ts");
const SSH_TARGET = "root@222.239.251.208";
// Where Nginx serves the client from (see dev/config/nginx_default.txt).
const SERVER_CLIENT_DIR = "/root/actions-runner/_work/youngjin/youngjin/robot-rooms/dist/client";
const SERVER_COPIES = {
    "bundle.js": "the staging game",
    "bundle.live.js": "the live game",
    "bundle.backup.js": "the backup a rollback restores",
};
// A file as a map names it, under the site's assets.
const AUDIO_PATH = /\baudio\/([\w./-]+?\.(?:mp3|wav))\b/g;
const REMOTE_AUDIO_PATTERN = "audio/[A-Za-z0-9_./-]+\\.(mp3|wav)";
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".flac", ".aif", ".aiff", ".m4a", ".opus"];
const SSH_TIMEOUT_MS = 60000;

function main()
{
    const users = new Map();
    const use = (file, user) => users.set(file, [...(users.get(file) ?? []), user]);

    for (const file of namedFiles(fs.readFileSync(MAP_FILE, "utf8")))
        use(file, "this build");
    const manifest = JSON.parse(fs.readFileSync(path.join(AUDIO_DIR, "manifest.json"), "utf8"));
    for (const clip of manifest.clips ?? [])
        use(clip.file, "the manifest");
    for (const [copy, files] of readServerCopies())
    {
        // A copy naming none (missing, as while a deploy lays the workspace out anew) leaves what it plays unknown, and
        // then no file can be called obsolete.
        if (files.length == 0)
            throw new Error(`the server's ${copy} names no audio file, so what ${SERVER_COPIES[copy]} plays is unknown`);
        for (const file of files)
            use(file, SERVER_COPIES[copy]);
    }

    const present = listFiles(AUDIO_DIR).filter(file => AUDIO_EXTENSIONS.includes(path.extname(file).toLowerCase()));
    const width = Math.max(0, ...present.map(file => file.length));
    console.log("In use:");
    for (const file of present.filter(file => users.has(file)))
        console.log(`  ${file.padEnd(width)}  ${users.get(file).join(", ")}`);
    const obsolete = present.filter(file => !users.has(file));
    console.log(`Obsolete:${obsolete.length == 0 ? " none" : ""}`);
    for (const file of obsolete)
        console.log(`  ${file}`);
    const missing = [...users.keys()].filter(file => !present.includes(file)).sort();
    if (missing.length > 0)
    {
        console.log("Missing:");
        for (const file of missing)
            console.log(`  ${file}  (${users.get(file).join(", ")})`);
    }
}

// Each client copy the server keeps, with the audio files it names.
function readServerCopies()
{
    const command = `cd ${SERVER_CLIENT_DIR} && for f in ${Object.keys(SERVER_COPIES).join(" ")}; do `
        + `[ -f "$f" ] && grep -o -E '${REMOTE_AUDIO_PATTERN}' "$f" | sort -u | sed "s|^|$f |"; done; true`;
    // BatchMode fails at once without a key the agent holds, instead of prompting for one.
    const output = execFileSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "LogLevel=ERROR",
        SSH_TARGET, command], {encoding: "utf8", timeout: SSH_TIMEOUT_MS});
    const copies = new Map(Object.keys(SERVER_COPIES).map(copy => [copy, []]));
    for (const line of output.split("\n"))
    {
        const [copy, named] = line.trim().split(" ");
        if (copies.has(copy) && named != undefined)
            copies.get(copy).push(...namedFiles(named));
    }
    return copies;
}

// Each audio file the text names, once.
function namedFiles(text)
{
    return [...new Set([...text.matchAll(AUDIO_PATH)].map(match => match[1]))];
}

// Every file under dir, as a path from it with forward slashes, sorted.
function listFiles(dir, prefix = "")
{
    return fs.readdirSync(dir, {withFileTypes: true})
        .flatMap(entry => entry.isDirectory()
            ? listFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
            : [`${prefix}${entry.name}`])
        .sort();
}

try
{
    main();
}
catch (err)
{
    console.error(`${err.message.trim()}. Nothing is listed as obsolete.`);
    process.exit(1);
}
