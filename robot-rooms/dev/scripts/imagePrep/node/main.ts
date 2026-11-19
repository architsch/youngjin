import path from "path";
import PrepCommands from "./prepCommands";

const USAGE = `Usage: npm run imagePrep -- --survey <file>[:x,y,w,h] ...   pictures (or parts) drawn with a grid to plan by
       npm run imagePrep -- --shades <file>[:x,y,w,h] ...   their brightness read out, cell by cell
       npm run imagePrep -- --run <plan.json>                orders carried out, with a contact sheet of the results`;

// Runs the commands given and exits (see prep.js for what each does).
async function main(): Promise<void>
{
    const args = process.argv.slice(2);
    // Set by prep.js, since this runs from a bundle elsewhere.
    const repoRoot = process.env.IMAGE_PREP_ROOT ?? process.cwd();
    const workDir = path.join(repoRoot, "temp/image_prep");

    const surveys = readList(args, "--survey");
    const shades = readList(args, "--shades");
    const planPath = readList(args, "--run")?.[0];
    if (surveys == undefined && shades == undefined && planPath == undefined)
    {
        console.log(USAGE);
        process.exitCode = (args.length == 0) ? 0 : 1;
        return;
    }
    if (planPath != undefined)
        await PrepCommands.run(repoRoot, workDir, path.resolve(repoRoot, planPath));
    if (surveys != undefined)
        await PrepCommands.writeSurveys(repoRoot, workDir, surveys);
    if (shades != undefined)
        await PrepCommands.printShades(repoRoot, shades);
}

// The values after a flag up to the next flag; undefined when the flag is absent or bare.
function readList(args: string[], flag: string): string[] | undefined
{
    const index = args.indexOf(flag);
    const values: string[] = [];
    for (let i = index + 1; index >= 0 && i < args.length && !args[i].startsWith("--"); ++i)
        values.push(args[i]);
    return (values.length > 0) ? values : undefined;
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
