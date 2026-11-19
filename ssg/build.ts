// Builds the site into public/ (`npm run build`), or, with --check, only tells whether a build would change
// anything there (`npm run check`, which the pre-commit hook runs).
import SSG from "./ssg.ts";
import FileUtil from "./util/fileUtil.ts";

const MAX_LISTED_FILES = 10;

const checkOnly = process.argv.includes("--check");
FileUtil.configure({checkOnly});

try
{
    await SSG();
}
catch (err)
{
    console.error(`❌ The site could not be built: ${(err instanceof Error) ? err.message : String(err)}`);
    process.exit(1);
}

const changedFiles = FileUtil.getChangedFiles();
const listed = changedFiles.slice(0, MAX_LISTED_FILES).join(", ")
    + ((changedFiles.length > MAX_LISTED_FILES) ? `, and ${changedFiles.length - MAX_LISTED_FILES} more` : "");

if (!checkOnly)
{
    console.log(`✅ The site is built: ${FileUtil.getFileCount()} files, ${changedFiles.length} of them changed`
        + ((changedFiles.length > 0) ? ` (${listed}).` : "."));
}
else if (changedFiles.length > 0)
{
    console.error(`❌ ${changedFiles.length} of the site's files in public/ are out of date with their sources, `
        + `templates or data (${listed}). Run 'npm run build' in ssg/ first.`);
    process.exit(1);
}
else
{
    console.log("✅ The site's pages are up to date.");
}
