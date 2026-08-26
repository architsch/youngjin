/**
 * Which dev-log directory the tooling is working in (shared by captureRunner.js and postLength.js).
 *
 * Dev-log posts are filed one year to a directory — `public/devlog-2026/`, `public/devlog-2027/`
 * and so on — each holding one `source.txt` and the screenshots its posts reference. Nothing
 * creates next year's directory on its own, because opening a year is not only a matter of making
 * a folder: the year also has to be registered in `src/server/ssg/data/libraryData.ts` before the
 * SSG will build pages out of it.
 *
 * So this module reports rather than decides. It prefers the current calendar year's directory
 * when that exists, falls back to the newest one that does, and says which case it landed in so a
 * caller can tell the difference between "working in this year" and "still writing into last
 * year's directory because nobody has opened this one yet".
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
 * The dev-log directory to work in.
 *
 * Returns, with every path repo-relative so it reads the same in a log line as in a command:
 *   year            the year whose directory was picked
 *   dir             "public/devlog-<year>"
 *   source          "public/devlog-<year>/source.txt"
 *   exists          whether that directory is actually there
 *   currentYear     this calendar year
 *   isCurrentYear   whether the picked year is this one — false means a new year is due, and
 *                   opening it takes a libraryData.ts entry as well as a directory
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
