// Server-side observation for the playtest skill. A public server's error log is mostly background noise
// (scanners, deprecations, socket replacement), so this separates the existing backlog (`history`) from
// what a run added (a byte-offset `baseline` / `diff`).
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

// PM2 logs are `<app>-<stream>-<id>.log`, rotated `<app>-<stream>-<id>__<date>.log`; ids vary, hence globs.
// pm2-logrotate compresses rotated logs to `.log.gz`, so matching `.log` alone silently misses the backlog.
function retainedLogGlob(app, stream)
{
    return `${LOG_DIR}/${app}-${stream}-*.log ${LOG_DIR}/${app}-${stream}-*.log.gz`;
}

// Only appendable (uncompressed, current) logs, since baseline and diff use byte offsets.
function growingLogGlob(app, stream)
{
    return `${LOG_DIR}/${app}-${stream}-*.log`;
}

// An unmatched glob stays literal in the shell, so loops skip non-files.
const SKIP_UNMATCHED = `[ -f "$f" ] || continue;`;

function ssh(command)
{
    // BatchMode fails fast without an agent key instead of prompting; LogLevel=ERROR keeps banners out of
    // the output.
    return execFileSync("ssh",
        ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "LogLevel=ERROR", SSH_TARGET, command],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// ─── Classification ─────────────────────────────────────────────────────
// Background noise this server produces regardless of playtests. Explicit (and counted in the output) so
// a pattern that stops being benign stays visible.
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

// Entries are `<title> :: <json>`, optionally prefixed "Trace: " (console.trace). Grouping by title makes
// many occurrences of one bug read as one problem.
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

// The pre-playtest survey of what this server has been logging; run before seeding or playtesting.
function history(app, topN)
{
    // `zcat -f` reads compressed and uncompressed logs alike.
    const raw = ssh(`zcat -f ${retainedLogGlob(app, "error")} 2>/dev/null || true`);
    const summary = summarize(raw, topN);

    // Per-day counts show regressions as rate changes.
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

    // Per-file sizes, since pm2 may rotate a log mid-run.
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

    // `tail -c +N` is 1-indexed. A file smaller than its baseline was rotated or truncated, so it's read
    // from the start.
    const tailFrom = ([file, size]) =>
        `if [ -f "${file}" ]; then ` +
        `cur=$(stat -c %s "${file}"); ` +
        `if [ "$cur" -lt "${size}" ]; then tail -c +1 "${file}"; else tail -c +${size + 1} "${file}"; fi; ` +
        `fi`;

    // stderr (warnings, errors) and stdout (routine commentary like every DB query) are kept apart, so real
    // errors aren't buried.
    const read = (stream) => {
        const entries = Object.entries(state.sizes).filter(([file]) => file.includes(`-${stream}-`));
        return entries.length > 0 ? ssh(entries.map(tailFrom).join("; ")) : "";
    };

    const appendedErr = read("error");
    const appendedOut = read("out");
    const now = metrics();
    const before = state.metrics;

    // Restarts (a crash or the memory ceiling) are surfaced separately from the logs.
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
        // Context, not findings: evidence the server did the work, and events surrounding any error.
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
