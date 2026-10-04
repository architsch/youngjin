import ImageMap from "../types/imageMap";
import ImageMapCategory from "../types/imageMapCategory";
import ImageMapSettings from "../types/imageMapSettings";
import AdminAssetSettings from "../../../system/types/adminAssetSettings";

// The number an image's path ends in, as the settings name it.
const IMAGE_INDEX_PATTERN = /^(0|[1-9]\d*)$/;

// An image map's admin settings both ways (see ImageMapSettings): applied to its images as the map is built, and
// written from the images as a chooser offers them. What may be a category, and what a settings file may hold, is
// one rule for the build and the game.
const ImageMapSettingsUtil =
{
    // What a map's settings go by in the settings file: the name of its module.
    getMapKey: (mapName: string): string =>
    {
        return mapName[0].toLowerCase() + mapName.substring(1);
    },
    // A category's name is the keyword that files an image under it: one word of lowercase letters and digits.
    isCategoryName: (name: string): boolean =>
    {
        return /^[a-z0-9]+$/.test(name);
    },
    // The category a tab's title makes, named by the title's own letters and digits.
    toCategory: (title: string): ImageMapCategory =>
    {
        const tidied = title.trim().replace(/\s+/g, " ");
        return {name: tidied.toLowerCase().replace(/[^a-z0-9]/g, ""), title: tidied};
    },
    // Why a subfolder can't list a category beside its others, or nothing if it can. No name is a tab every
    // chooser has of its own, or lies inside another's, which a search for it would find too.
    getCategoryProblem: (category: ImageMapCategory, others: ImageMapCategory[]): string | undefined =>
    {
        if (category.title.trim().length == 0)
            return "A category needs a title.";
        if (category.name.length == 0)
            return "A category's title needs a letter or a digit to name it by.";
        if (!ImageMapSettingsUtil.isCategoryName(category.name))
            return `A category's name is one word of lowercase letters and digits, not "${category.name}".`;
        if (category.name == ImageMap.ALL_TAB || category.name == ImageMap.MISC_TAB)
            return `"${category.name}" is a tab every chooser has of its own.`;
        const other = others.find(listed =>
            listed.name.includes(category.name) || category.name.includes(listed.name));
        if (other == undefined)
            return undefined;
        if (other.name == category.name)
            return `There is already a category named "${category.name}".`;
        return other.name.includes(category.name)
            ? `"${category.name}" is inside "${other.name}", another category's name.`
            : `"${other.name}", another category's name, is inside "${category.name}".`;
    },
    // The images in the order the settings list them, each subfolder's keeping the places its images had: those
    // left out first, as they came, then those listed.
    sort: <T extends {path: string}>(images: T[], settings: ImageMapSettings): T[] =>
    {
        const placeByPath = new Map<string, number>();
        for (const [subfolderName, indices] of Object.entries(settings.orderedIndicesBySubfolder))
            indices.forEach((index, place) => placeByPath.set(toPath(subfolderName, `${index}`), place));

        const imagesBySubfolder = new Map<string, T[]>();
        for (const image of images)
        {
            const subfolderName = ImageMap.getSubfolderName(image.path);
            if (!imagesBySubfolder.has(subfolderName))
                imagesBySubfolder.set(subfolderName, []);
            imagesBySubfolder.get(subfolderName)!.push(image);
        }
        // Those left out tie, and a tie keeps the order they came in.
        for (const subfolderImages of imagesBySubfolder.values())
            subfolderImages.sort((a, b) => (placeByPath.get(a.path) ?? -1) - (placeByPath.get(b.path) ?? -1));

        const numTaken = new Map<string, number>();
        return images.map(image => {
            const subfolderName = ImageMap.getSubfolderName(image.path);
            const taken = numTaken.get(subfolderName) ?? 0;
            numTaken.set(subfolderName, taken + 1);
            return imagesBySubfolder.get(subfolderName)![taken];
        });
    },
    // The categories the settings file an image under; none for one they leave out.
    getCategories: (settings: ImageMapSettings, path: string): string[] =>
    {
        const subfolderName = ImageMap.getSubfolderName(path);
        return settings.categoriesBySubfolderAndIndex[subfolderName]?.[toIndex(subfolderName, path)] ?? [];
    },
    // The settings that describe images as they come, browsed by those categories: their order, and the categories
    // their keywords name. One whose path ends in no number can't be listed.
    fromImages: (images: {path: string, keywords?: string}[],
        categoryTabsBySubfolder: {[subfolderName: string]: ImageMapCategory[]}): ImageMapSettings =>
    {
        const settings: ImageMapSettings = {categoryTabsBySubfolder, orderedIndicesBySubfolder: {},
            categoriesBySubfolderAndIndex: {}};
        for (const image of images)
        {
            const subfolderName = ImageMap.getSubfolderName(image.path);
            const index = toIndex(subfolderName, image.path);
            if (!IMAGE_INDEX_PATTERN.test(index))
                continue;
            (settings.orderedIndicesBySubfolder[subfolderName] ??= []).push(Number(index));
            (settings.categoriesBySubfolderAndIndex[subfolderName] ??= {})[index] = ImageMap.getCategories(image.keywords);
        }
        return settings;
    },
    // As the settings file holds them (see AdminAssetSettings): a line per subfolder, its images in the order listed.
    serializeFile: (settingsByMapKey: AdminAssetSettings): string =>
    {
        const mapKeys = Object.keys(settingsByMapKey).filter(mapKey => settingsByMapKey[mapKey] != undefined);
        const sections = mapKeys.map(mapKey => {
            const {categoryTabsBySubfolder, orderedIndicesBySubfolder,
                categoriesBySubfolderAndIndex} = settingsByMapKey[mapKey]!;
            const tabLines = Object.entries(categoryTabsBySubfolder).map(([subfolderName, categories]) => {
                const entries = categories.map(category =>
                    `{"name": ${JSON.stringify(category.name)}, "title": ${JSON.stringify(category.title)}}`);
                return `            ${JSON.stringify(subfolderName)}: [${entries.join(", ")}]`;
            });
            const orderLines = Object.entries(orderedIndicesBySubfolder).map(([subfolderName, indices]) =>
                `            ${JSON.stringify(subfolderName)}: [${indices.join(", ")}]`);
            const subfolderNames = Object.keys(categoriesBySubfolderAndIndex);
            const categoryLines = subfolderNames.map(subfolderName => {
                const categoriesByIndex = categoriesBySubfolderAndIndex[subfolderName];
                // Written out by hand: an object's own keys come sorted when they are numbers.
                const listed = (orderedIndicesBySubfolder[subfolderName] ?? []).map(index => `${index}`);
                const indices = [...listed.filter(index => categoriesByIndex[index] != undefined),
                    ...Object.keys(categoriesByIndex).filter(index => !listed.includes(index))];
                const entries = indices.map(index =>
                    `"${index}": [${categoriesByIndex[index].map(category => JSON.stringify(category)).join(", ")}]`);
                return `            ${JSON.stringify(subfolderName)}: {${entries.join(", ")}}`;
            });
            return `    ${JSON.stringify(mapKey)}: {\n`
                + `        "categoryTabsBySubfolder": {\n${tabLines.join(",\n")}\n        },\n`
                + `        "orderedIndicesBySubfolder": {\n${orderLines.join(",\n")}\n        },\n`
                + `        "categoriesBySubfolderAndIndex": {\n${categoryLines.join(",\n")}\n        }\n    }`;
        });
        return `{\n${sections.join(",\n")}\n}\n`;
    },
    // A map's own part of a settings file, from the file's text: its settings, neither if the file holds no part for
    // it, or the problem that keeps the file from being used, worded to follow the file's name. A part may name
    // images the map doesn't hold (disabled or deleted since), but nothing that is no category, image number or
    // category name, and none twice.
    parseFile: (text: string, mapKey: string): {settings?: ImageMapSettings, problem?: string} =>
    {
        let file: unknown;
        try
        {
            file = JSON.parse(text);
        }
        catch
        {
            return {problem: "is not valid JSON"};
        }
        if (!isRecord(file))
            return {problem: "holds no settings"};
        const settings = file[mapKey];
        if (settings == undefined)
            return {};
        const problem = getSettingsProblem(settings, mapKey);
        return (problem != undefined) ? {problem} : {settings: settings as ImageMapSettings};
    },
}

function isRecord(value: unknown): value is {[key: string]: unknown}
{
    return typeof value == "object" && value != null && !Array.isArray(value);
}

// Why a settings file's part for a map can't be that map's settings (see parseFile), or nothing if it can.
function getSettingsProblem(settings: unknown, mapKey: string): string | undefined
{
    if (!isRecord(settings) || !isRecord(settings.categoryTabsBySubfolder))
        return `holds no "categoryTabsBySubfolder" under "${mapKey}"`;
    if (!isRecord(settings.orderedIndicesBySubfolder))
        return `holds no "orderedIndicesBySubfolder" under "${mapKey}"`;
    if (!isRecord(settings.categoriesBySubfolderAndIndex))
        return `holds no "categoriesBySubfolderAndIndex" under "${mapKey}"`;

    for (const [subfolderName, categories] of Object.entries(settings.categoryTabsBySubfolder))
    {
        if (!Array.isArray(categories) || !categories.every(category =>
            isRecord(category) && typeof category.name == "string" && typeof category.title == "string"))
            return `lists something other than categories, each a name and a title, under "${subfolderName}"`;
        for (let place = 0; place < categories.length; ++place)
        {
            const problem = ImageMapSettingsUtil.getCategoryProblem(categories[place], categories.slice(0, place));
            if (problem != undefined)
                return `lists a category under "${subfolderName}" that can't be one: ${problem}`;
        }
    }
    for (const [subfolderName, indices] of Object.entries(settings.orderedIndicesBySubfolder))
    {
        if (!Array.isArray(indices) || !indices.every(index => Number.isInteger(index) && index >= 0))
            return `lists something other than image numbers under "${subfolderName}"`;
        const repeated = indices.find((index, place) => indices.indexOf(index) != place);
        if (repeated != undefined)
            return `lists image ${repeated} twice under "${subfolderName}"`;
    }
    for (const [subfolderName, categoriesByIndex] of Object.entries(settings.categoriesBySubfolderAndIndex))
    {
        if (!isRecord(categoriesByIndex) || !Object.keys(categoriesByIndex).every(index => IMAGE_INDEX_PATTERN.test(index)))
            return `files something other than image numbers under categories in "${subfolderName}"`;
        for (const [index, categories] of Object.entries(categoriesByIndex))
        {
            if (!Array.isArray(categories)
                || !categories.every(category => typeof category == "string" && ImageMapSettingsUtil.isCategoryName(category)))
                return `files image ${index} of "${subfolderName}" under something other than category names`;
            const repeated = categories.find((category, place) => categories.indexOf(category) != place);
            if (repeated != undefined)
                return `files image ${index} of "${subfolderName}" under "${repeated}" twice`;
        }
    }
    return undefined;
}

function toPath(subfolderName: string, index: string): string
{
    return (subfolderName.length == 0) ? index : `${subfolderName}/${index}`;
}

// What a path ends in, after its subfolder.
function toIndex(subfolderName: string, path: string): string
{
    return path.substring(subfolderName.length == 0 ? 0 : subfolderName.length + 1);
}

export default ImageMapSettingsUtil;
