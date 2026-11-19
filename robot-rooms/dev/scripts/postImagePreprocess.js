// Scales the pictures for a post by a percentage: every .png and .jpg in temp/post_images is saved as a
// JPEG in temp/post_images/out, encoded like the pictures already published in public/devlog-2026.
//
//   npm run postImagePreprocess 50

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const INPUT_DIR = path.join(__dirname, "../../temp/post_images");
const OUTPUT_DIR = path.join(INPUT_DIR, "out");

const INPUT_EXTENSIONS = [".png", ".jpg", ".jpeg"];

const JPEG_OPTIONS = {quality: 70, progressive: true, chromaSubsampling: "4:4:4"};

// A JPEG has no transparency, so transparent parts take the page background a post is shown on (body in
// public/style.css).
const BACKGROUND = "#303030";

function parsePercentage(arg)
{
    const match = /^(\d+)%?$/.exec(arg ?? "");
    const percentage = match == null ? 0 : Number(match[1]);
    if (percentage <= 0)
    {
        console.error(`❌ Expected a whole percentage above 0, as in \`npm run postImagePreprocess 50\`, but got [${arg ?? ""}].`);
        process.exit(1);
    }
    return percentage;
}

function listPictures()
{
    if (!fs.existsSync(INPUT_DIR))
    {
        console.error(`❌ No folder at [${INPUT_DIR}]. Create it and put the pictures in it.`);
        process.exit(1);
    }
    // A "._name.png" beside a picture is macOS metadata, not a PNG.
    return fs.readdirSync(INPUT_DIR, {withFileTypes: true})
        .filter((entry) => entry.isFile() && !entry.name.startsWith(".")
            && INPUT_EXTENSIONS.includes(path.extname(entry.name).toLowerCase()))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
}

function outputName(fileName)
{
    return `${path.parse(fileName).name}.jpg`;
}

// "a.png" and "a.jpg" would both be written to out/a.jpg, the second over the first (as would "A.png", on
// a case-insensitive disk).
function exitOnClashes(fileNames)
{
    const byOutput = Map.groupBy(fileNames, (fileName) => outputName(fileName).toLowerCase());
    const clashes = [...byOutput.values()].filter((group) => group.length > 1);
    if (clashes.length == 0)
        return;
    console.error("❌ Each of these groups would be saved to the same file in out/. Rename all but one in each:");
    for (const group of clashes)
        console.error(`  ${group.join(", ")}`);
    process.exit(1);
}

async function scalePicture(fileName, factor)
{
    const inputPath = path.join(INPUT_DIR, fileName);
    // The size as displayed: a phone photo is often stored sideways, with an EXIF tag saying how to turn it.
    const {width, height} = (await sharp(inputPath).metadata()).autoOrient;
    const outWidth = Math.max(1, Math.round(width * factor));
    const outHeight = Math.max(1, Math.round(height * factor));

    await sharp(inputPath, {autoOrient: true})
        .resize(outWidth, outHeight, {fit: "fill"})
        .flatten({background: BACKGROUND})
        .jpeg(JPEG_OPTIONS)
        .toFile(path.join(OUTPUT_DIR, outputName(fileName)));

    console.log(`  ${fileName} (${width}x${height}) -> out/${outputName(fileName)} (${outWidth}x${outHeight})`);
}

async function main()
{
    const percentage = parsePercentage(process.argv[2]);
    const fileNames = listPictures();
    if (fileNames.length == 0)
    {
        console.error(`❌ No .png or .jpg files in [${INPUT_DIR}].`);
        process.exit(1);
    }
    exitOnClashes(fileNames);

    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
    console.log(`Scaling ${fileNames.length} picture(s) to ${percentage}%:`);

    let failures = 0;
    for (const fileName of fileNames)
    {
        try
        {
            await scalePicture(fileName, percentage / 100);
        }
        catch (err)
        {
            failures++;
            console.error(`  ❌ ${fileName}: ${err.message}`);
        }
    }

    if (failures > 0)
    {
        console.error(`❌ ${failures} of ${fileNames.length} picture(s) could not be scaled.`);
        process.exit(1);
    }
    console.log("✅ Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
