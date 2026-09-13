// Per-source funnel and retention report, read from the counters ServerAnalyticsManager records per
// (source, arrival day). Rates are shares of arrivals, ranked by retention (raw arrivals mislead).
// Read-only and may target live; the DB handle comes from lib/dbGuard.js.
//
// Usage:
//   node dev/scripts/analytics/funnelReport.js report  [--app live|staging|local] [--since YYYY-MM-DD] [--days N] [--min-cohort N]
//   node dev/scripts/analytics/funnelReport.js sources [--app ...] [--since ...] [--days N]
//   node dev/scripts/analytics/funnelReport.js raw     [--app ...] [--since ...] [--days N]
//
// Every command prints JSON on stdout, and names the target it read.

const DBGuard = require("../playtest/lib/dbGuard");

const COLLECTION = "acquisition";

// Mirrors src/server/analytics/types/funnelMilestone.ts (TypeScript, so not requirable). Unknown codes
// are reported under "unknownCodes", so a new server milestone shows up as a gap.
const MILESTONES = [
    { code: "a", key: "arrived",        label: "Arrived" },
    { code: "t", key: "tutorialDone",   label: "Finished or skipped the tutorial" },
    { code: "r", key: "enteredRoom",    label: "Entered a multiplayer room" },
    { code: "b", key: "built",          label: "Changed the world (built something)" },
    { code: "c", key: "chatted",        label: "Said something to the room" },
    { code: "o", key: "ownedRoom",      label: "Came to own a room" },
    { code: "s", key: "signedUp",       label: "Signed up (guest to member)" },
    { code: "n", key: "returned",       label: "Came back on a later day" },
    { code: "d", key: "retainedRepeat", label: "Came back more than once" },
];

// Below this many arrivals a rate is noise; small cohorts are still shown, flagged.
const DEFAULT_MIN_COHORT = 25;

function arg(name, fallback)
{
    const i = process.argv.indexOf(name);
    return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

function dayString(date)
{
    return date.toISOString().slice(0, 10);
}

// Defaults to the last 30 days of cohorts; "--since" wins over "--days".
function resolveWindow()
{
    const since = arg("--since", null);
    if (since)
    {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(since))
            throw new Error(`--since must be YYYY-MM-DD (got "${since}")`);
        return { since, until: dayString(new Date()) };
    }

    const days = parseInt(arg("--days", "30"), 10);
    if (!Number.isFinite(days) || days <= 0)
        throw new Error(`--days must be a positive number (got "${arg("--days", "30")}")`);

    const from = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    return { since: dayString(from), until: dayString(new Date()) };
}

async function loadCohorts(db, window, source)
{
    // cohortDay is a YYYY-MM-DD string, so a string comparison is a date comparison.
    const docs = await db.readWhere(COLLECTION, "cohortDay", ">=", window.since);
    return docs.filter(doc =>
        typeof doc.cohortDay === "string"
        && doc.cohortDay <= window.until
        && (!source || doc.source === source));
}

// Sums the per-day cohort documents into one row per source.
function rollUp(docs)
{
    const bySource = new Map();
    const unknownCodes = new Set();

    for (const doc of docs)
    {
        const source = typeof doc.source === "string" && doc.source.length > 0 ? doc.source : "(unattributed)";
        if (!bySource.has(source))
            bySource.set(source, { source, cohortDays: 0, firstDay: null, lastDay: null, counts: {} });

        const row = bySource.get(source);
        row.cohortDays += 1;
        if (row.firstDay === null || doc.cohortDay < row.firstDay) row.firstDay = doc.cohortDay;
        if (row.lastDay === null || doc.cohortDay > row.lastDay) row.lastDay = doc.cohortDay;

        const counts = doc.counts && typeof doc.counts === "object" ? doc.counts : {};
        for (const [code, value] of Object.entries(counts))
        {
            if (typeof value !== "number") continue;
            if (!MILESTONES.some(m => m.code === code)) unknownCodes.add(code);
            row.counts[code] = (row.counts[code] || 0) + value;
        }
    }

    return { rows: [...bySource.values()], unknownCodes: [...unknownCodes] };
}

// Every rate uses arrivals as the denominator, so a leaky step can't hide behind a step-to-step percentage.
function withRates(row)
{
    const arrived = row.counts.a || 0;
    const counts = {};
    const rates = {};

    for (const m of MILESTONES)
    {
        const n = row.counts[m.code] || 0;
        counts[m.key] = n;
        rates[m.key] = arrived > 0 ? Number((n / arrived).toFixed(4)) : null;
    }

    return {
        source: row.source,
        cohortDays: row.cohortDays,
        firstDay: row.firstDay,
        lastDay: row.lastDay,
        arrived,
        counts,
        rates,
    };
}

function buildReport(docs, minCohort)
{
    const { rows, unknownCodes } = rollUp(docs);
    const sources = rows.map(withRates).sort((a, b) => b.arrived - a.arrived);

    // Ranked by returned rate alone: retention can't be inflated by sending more people.
    const ranked = sources
        .filter(s => s.arrived >= minCohort)
        .sort((a, b) => (b.rates.returned || 0) - (a.rates.returned || 0));

    const belowThreshold = sources
        .filter(s => s.arrived < minCohort)
        .map(s => ({ source: s.source, arrived: s.arrived }));

    const totals = sources.reduce((acc, s) => {
        acc.arrived += s.arrived;
        for (const m of MILESTONES) acc.counts[m.key] += s.counts[m.key];
        return acc;
    }, { arrived: 0, counts: Object.fromEntries(MILESTONES.map(m => [m.key, 0])) });

    return {
        milestones: MILESTONES.map(m => ({ key: m.key, label: m.label })),
        minCohort,
        ranking: {
            by: "returned rate (came back on a later day, as a share of arrivals)",
            rankable: ranked.map(s => ({
                source: s.source,
                arrived: s.arrived,
                returnedRate: s.rates.returned,
                repeatRate: s.rates.retainedRepeat,
                builtRate: s.rates.built,
                signedUpRate: s.rates.signedUp,
            })),
            belowThreshold,
        },
        sources,
        totals,
        unknownCodes,
    };
}

async function main()
{
    const command = process.argv[2] || "report";
    const conn = DBGuard.connectReadOnly(process.argv);
    const window = resolveWindow();

    // Narrows every command to one known source tag (e.g. checking that a playtest's visits landed).
    const source = arg("--source", null);
    const docs = await loadCohorts(conn.db, window, source);

    const envelope = {
        command,
        target: conn.describe(),
        window,
        source: source || "(all)",
        cohortDocuments: docs.length,
        generatedAt: new Date().toISOString(),
    };

    if (command === "raw")
    {
        print({ ...envelope, documents: docs.sort((a, b) => a.id.localeCompare(b.id)) });
        return;
    }

    if (command === "sources")
    {
        const { rows } = rollUp(docs);
        print({ ...envelope, sources: rows.map(withRates).sort((a, b) => b.arrived - a.arrived) });
        return;
    }

    if (command !== "report")
        throw new Error(`Unknown command "${command}". Valid: report, sources, raw.`);

    const minCohort = parseInt(arg("--min-cohort", String(DEFAULT_MIN_COHORT)), 10);
    print({ ...envelope, ...buildReport(docs, minCohort) });
}

function print(obj)
{
    process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

if (require.main === module)
{
    main().catch(err => {
        process.stdout.write(`${JSON.stringify({ error: err.message }, null, 2)}\n`);
        process.exit(1);
    });
}

// Exported so playtest tooling shares this table. Requiring this file runs nothing (see the guard above).
module.exports = { MILESTONES };
