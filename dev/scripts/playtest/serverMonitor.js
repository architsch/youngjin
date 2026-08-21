// Server-side observation for the playtest skill: what the VPS was already complaining about
// before a playtest started, and what it started complaining about because of one.
//
// The distinction matters more than it sounds. A public server's error log is mostly weather —
// vulnerability scanners walking the URL space, deprecation warnings, sockets being replaced on
// page refresh. Reading the log cold, an agent will "find errors" every single time and report
// them all as regressions. So this tool works in two modes: a survey of the *existing* backlog,
// which is the ground truth to compare against, and a byte-offset diff that shows only what a
// run actually added.
//
// Usage:
//   node dev/scripts/playtest/serverMonitor.js history  [--app staging|live] [--top 20]
//   node dev/scripts/playtest/serverMonitor.js baseline  [--app staging|live]
//   node dev/scripts/playtest/serverMonitor.js diff      [--app staging|live]
//   node dev/scripts/playtest/serverMonitor.js metrics
//
// Every command prints JSON on stdout.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SSH_TARGET = "root@222.239.251.208";
const LOG_DIR = "/root/.pm2/logs";
const STATE_DIR = path.join(__dirname, "../../../temp/playtest");
const HEALTH_URL = { staging: "https://staging.thingspool.net/health", live: "https://app.thingspool.net/health" };

// PM2 names the current log `<app>-<stream>-<id>.log` and rotated ones
// `<app>-<stream>-<id>__<date>.log`. The id differs per app, so both are matched by glob.
//
// pm2-logrotate runs here with compression on, so a log ends in `.log` only while it is the one
// being written to — every rotated log is `.log.gz` within a day of being rotated. A pattern
// matching `.log` alone therefore sees the current file and nothing else, and it does not fail
// when it does: the survey simply comes back short, and a long-standing error that lives only in
// the compressed backlog reads as something a playtest just caused.
function retainedLogGlob(app, stream)
{
    return `${LOG_DIR}/${app}-${stream}-*.log ${LOG_DIR}/${app}-${stream}-*.log.gz`;
}

// Only the logs that can still be appended to. A rotated log is finished, and once compressed a
// byte offset into it means nothing anyway — so the baseline and the diff, which work by byte
// offset, stay on the uncompressed files.
function growingLogGlob(app, stream)
{
    return `${LOG_DIR}/${app}-${stream}-*.log`;
}

// A glob that matches nothing is passed through by the shell as its own literal text, which would
// then be read as a filename. Every loop over one of these globs skips what is not a real file.
const SKIP_UNMATCHED = `[ -f "$f" ] || continue;`;

function ssh(command)
{
    // BatchMode keeps this non-interactive: without an agent key it fails fast rather than
    // hanging on a password prompt, which an agent has no way to answer. LogLevel=ERROR
    // suppresses the client's advisory banners, which would otherwise be interleaved with
    // this tool's own output and read as part of it.
    return execFileSync("ssh",
        ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "LogLevel=ERROR", SSH_TARGET, command],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// ─── Classification ─────────────────────────────────────────────────────
//
// Everything matched here is background noise this server produces whether or not anybody is
// playtesting. Keeping the list explicit — rather than filtering it out silently — means a
// pattern that stops being benign can be argued about, and the counts stay visible in the
// output either way.
const BENIGN = [
    { pattern: /^Page rate limit exceeded .*\.php/i,   why: "Vulnerability scanner probing for PHP endpoints" },
    { pattern: /^API rate limit exceeded/i,            why: "Rate limiter doing its job (may be self-inflicted during a playtest)" },
    { pattern: /^Page rate limit exceeded/i,           why: "Rate limiter doing its job (may be self-inflicted during a playtest)" },
    { pattern: /DeprecationWarning/i,                  why: "Node.js deprecation notice from a dependency" },
    { pattern: /Use `node --trace-deprecation/i,       why: "Continuation of a deprecation notice" },
    { pattern: /Replacing existing socket for userID/i,why: "Normal page refresh — old socket superseded" },
    { pattern: /Skipping stale disconnect handler/i,   why: "Normal consequence of a socket replacement" },
];

function classify(title)
{
    const hit = BENIGN.find(b => b.pattern.test(title));
    return hit ? { benign: true, why: hit.why } : { benign: false, why: null };
}

// A log entry is `<title> :: <json>`, optionally prefixed with "Trace: " when LogUtil routed it
// through console.trace. Grouping on the title alone collapses the payload — which is what makes
// 407 occurrences of one bug read as one problem rather than 407 unrelated lines.
function normalize(line)
{
    let text = line.replace(/^Trace:\s*/, "").trim();
    const sep = text.indexOf(" :: ");
    if (sep >= 0) text = text.substring(0, sep);
    // Collapse the identifiers that would otherwise split one recurring message into many.
    return text
        .replace(/\b[0-9a-fA-F]{16,}\b/g, "<id>")
        .replace(/\b[A-Za-z0-9_-]{20}\b/g, "<id>")
        .replace(/\b\d+\b/g, "<n>")
        .substring(0, 160);
}

// Stack frames belong to the entry above them, not to entries of their own.
function isStackFrame(line)
{
    return /^\s+at\s/.test(line) || /^\s*\.\.\./.test(line);
}

function summarize(text, topN)
{
    const groups = new Map();
    let stackFrames = 0;

    for (const raw of text.split("\n"))
    {
        const line = raw.replace(/\r$/, "");
        if (line.trim().length === 0) continue;
        if (isStackFrame(line)) { stackFrames++; continue; }
        // pm2 prints a banner naming the file when several are tailed at once.
        if (/^==>.*<==$/.test(line.trim())) continue;

        const title = normalize(line);
        if (!groups.has(title))
            groups.set(title, { title, count: 0, sample: line.substring(0, 300), ...classify(title) });
        groups.get(title).count++;
    }

    const all = [...groups.values()].sort((a, b) => b.count - a.count);
    return {
        distinctMessages: all.length,
        stackFrameLines: stackFrames,
        needsAttention: all.filter(g => !g.benign).slice(0, topN),
        benignNoise: all.filter(g => g.benign).map(g => ({ title: g.title, count: g.count, why: g.why })),
    };
}

// ─── Commands ───────────────────────────────────────────────────────────

// The pre-playtest survey: what has this server been logging all along? Run this before any
// seeding or playtesting so that every later finding can be checked against it.
function history(app, topN)
{
    // `zcat -f` reads the compressed backlog and the current log through the same command, since
    // with -f it passes an uncompressed file straight through.
    const raw = ssh(`zcat -f ${retainedLogGlob(app, "error")} 2>/dev/null || true`);
    const summary = summarize(raw, topN);

    // Per-day counts for the recurring offenders make a regression visible as a change in
    // rate, which a single total cannot show.
    const perFile = ssh(`for f in ${retainedLogGlob(app, "error")}; do ` +
        `${SKIP_UNMATCHED} echo "$(basename $f)|$(zcat -f "$f" | wc -l)"; done 2>/dev/null || true`)
        .split("\n").filter(Boolean).map(l => {
            const [file, lines] = l.split("|");
            return { file, lines: parseInt(lines, 10) };
        })
        .sort((a, b) => a.file.localeCompare(b.file));

    return { app, scope: "all retained error logs, compressed ones included", perFile, ...summary };
}

function statePath(app) { return path.join(STATE_DIR, `${app}-baseline.json`); }

function baseline(app)
{
    fs.mkdirSync(STATE_DIR, { recursive: true });

    // Sizes are captured per file. A single combined offset would be wrong the moment pm2
    // rotates a log mid-run, which for a long playtest is a real possibility.
    const sizes = ssh(`for f in ${growingLogGlob(app, "error")} ${growingLogGlob(app, "out")}; do ` +
        `${SKIP_UNMATCHED} echo "$f|$(stat -c %s "$f")"; done 2>/dev/null || true`)
        .split("\n").filter(Boolean).reduce((acc, l) => {
            const [file, size] = l.split("|");
            acc[file] = parseInt(size, 10);
            return acc;
        }, {});

    const state = { app, capturedAt: new Date().toISOString(), sizes, metrics: metrics() };
    fs.writeFileSync(statePath(app), JSON.stringify(state, null, 2));
    return { baselineWritten: statePath(app), files: Object.keys(sizes).length, capturedAt: state.capturedAt };
}

function diff(app)
{
    if (!fs.existsSync(statePath(app)))
        throw new Error(`No baseline for "${app}". Run: serverMonitor.js baseline --app ${app}`);

    const state = JSON.parse(fs.readFileSync(statePath(app), "utf8"));

    // `tail -c +N` is 1-indexed, hence the +1. A file smaller than its recorded size was
    // rotated or truncated since the baseline, so it is read from the beginning instead —
    // otherwise the run's own output would be skipped entirely.
    const tailFrom = ([file, size]) =>
        `if [ -f "${file}" ]; then ` +
        `cur=$(stat -c %s "${file}"); ` +
        `if [ "$cur" -lt "${size}" ]; then tail -c +1 "${file}"; else tail -c +${size + 1} "${file}"; fi; ` +
        `fi`;

    // The two streams mean different things and must not be pooled. stderr is where LogUtil
    // sends warnings and errors; stdout carries the running commentary (every DB query, every
    // room save). Summarizing them together would bury one genuine error under a hundred
    // routine "DB Query Started" lines and mark all of them as needing attention.
    const read = (stream) => {
        const entries = Object.entries(state.sizes).filter(([file]) => file.includes(`-${stream}-`));
        return entries.length > 0 ? ssh(entries.map(tailFrom).join("; ")) : "";
    };

    const appendedErr = read("error");
    const appendedOut = read("out");
    const now = metrics();
    const before = state.metrics;

    // A restart during a playtest is the loudest possible signal — it means the process died
    // or hit its memory ceiling — so it is surfaced separately from anything in the log.
    const restarts = {};
    for (const name of Object.keys(now.pm2 || {}))
    {
        const wasRestarts = before.pm2?.[name]?.restarts;
        if (wasRestarts !== undefined && now.pm2[name].restarts !== wasRestarts)
            restarts[name] = { before: wasRestarts, after: now.pm2[name].restarts };
    }

    const errors = summarize(appendedErr, 50);
    const activity = summarize(appendedOut, 50);

    return {
        app,
        since: state.capturedAt,
        appendedBytes: { error: Buffer.byteLength(appendedErr), out: Buffer.byteLength(appendedOut) },
        // What a playtest is looking for.
        needsAttention: errors.needsAttention,
        benignNoise: errors.benignNoise,
        distinctErrorMessages: errors.distinctMessages,
        stackFrameLines: errors.stackFrameLines,
        // Context rather than findings: proof the server was doing the work the playtest asked
        // of it, and the place to look when an error needs a sequence of events around it.
        activity: [...activity.needsAttention, ...activity.benignNoise]
            .map(g => ({ title: g.title, count: g.count })),
        restartsDuringWindow: restarts,
        metricsBefore: before,
        metricsAfter: now,
    };
}

function metrics()
{
    let pm2 = {};
    try {
        const raw = ssh(`pm2 jlist`);
        JSON.parse(raw).forEach(proc => {
            pm2[proc.name] = {
                status: proc.pm2_env?.status,
                restarts: proc.pm2_env?.restart_time,
                unstableRestarts: proc.pm2_env?.unstable_restarts,
                uptimeMs: proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : null,
                memoryMB: proc.monit?.memory ? Math.round(proc.monit.memory / 1048576) : null,
                cpu: proc.monit?.cpu,
            };
        });
    } catch (err) {
        pm2 = { error: err.message.substring(0, 200) };
    }

    const health = {};
    for (const [name, url] of Object.entries(HEALTH_URL))
    {
        try {
            health[name] = execFileSync("curl",
                ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "10", url],
                { encoding: "utf8" }).trim();
        } catch { health[name] = "unreachable"; }
    }

    return { pm2, health };
}

// ─── Entry point ────────────────────────────────────────────────────────

function flag(name, fallback)
{
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

function main()
{
    const command = process.argv[2];
    const app = flag("app", "staging");
    if (!["staging", "live"].includes(app))
        throw new Error(`--app must be "staging" or "live" (got "${app}")`);

    let output;
    switch (command)
    {
        case "history":  output = history(app, parseInt(flag("top", "20"), 10)); break;
        case "baseline": output = baseline(app); break;
        case "diff":     output = diff(app); break;
        case "metrics":  output = metrics(); break;
        default:
            console.error(`Unknown command: ${command || "(none)"}\n` +
                `Commands: history | baseline | diff | metrics`);
            process.exit(2);
    }

    console.log(JSON.stringify(output, null, 2));
}

try { main(); }
catch (err) {
    console.error(JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
}
