/**
 * Which dev-log directory to work in (used by postLength.js and the `devlog-post` skill). Posts are filed per
 * year (`public/devlog-<year>/`); a new year also needs a `src/server/ssg/data/libraryData.ts` entry, so
 * this prefers the current year's directory, falls back to the newest existing one, and reports which.
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");
const DEVLOG_DIR_PATTERN = /^devlog-(\d{4})$/;

/** Every dev-log year that has a directory under public/, oldest first. */
function listDevlogYears()
{
    if (!fs.existsSync(PUBLIC_DIR))
        return [];
    return fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name.match(DEVLOG_DIR_PATTERN))
        .filter(Boolean)
        .map(match => Number(match[1]))
        .sort((a, b) => a - b);
}

/**
 * The dev-log directory to work in. Returns repo-relative paths:
 *   year            the year whose directory was picked
 *   dir             "public/devlog-<year>"
 *   source          "public/devlog-<year>/source.txt"
 *   exists          whether that directory exists
 *   currentYear     this calendar year
 *   isCurrentYear   false means a new year is due (a directory plus a libraryData.ts entry)
 */
function resolveDevlogDir()
{
    const currentYear = new Date().getFullYear();
    const years = listDevlogYears();
    const year = years.includes(currentYear)
        ? currentYear
        : (years.length > 0 ? years[years.length - 1] : currentYear);

    const dir = `public/devlog-${year}`;
    return {
        year,
        dir,
        source: `${dir}/source.txt`,
        exists: fs.existsSync(path.join(REPO_ROOT, dir)),
        currentYear,
        isCurrentYear: year == currentYear,
    };
}

module.exports = { listDevlogYears, resolveDevlogDir };
