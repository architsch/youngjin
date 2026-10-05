/**
 * Pictures: the images of the picture map, and the two types that show them. A canvas shows a painting (the Arts
 * subfolder), fitted to whatever size it is; a prop shows an everyday object (the Objects subfolder), with no frame,
 * pinned to the image's own size. Paths name their subfolder, so each type accepts only its own.
 * Covers: the map's tabs and which type each serves, a tab left out while all its images are disabled, everyday
 * objects at their own scale in whole cells, disabled images left out of the built map and staging ones marked in it
 * (offered only off the live server, tabs and all, and every one found by a search for "staging"), the categories built as the
 * admin's settings list them (the manifest listing none), each image filed under those the settings give it (only
 * listed ones, built in as marked keywords ahead of its own), a recipe and sample for every image, the notices naming every third party's
 * image that ships; what a search finds an image by (a painting by its title and author, an everyday object by
 * single-word keywords of its own, none inside another, none a filler word and none marked as a category) and the
 * map shipping nothing else of either, the search itself (every word typed but filler words, as typed or singular),
 * the order images are offered in (as the map lists them, which the admin's settings set, the images they leave out
 * first; one order, which a tab or a search only narrows), an admin's rearranging of it (an image put at its place
 * in the row shown, every other left where it was among the rest), filing of an image under other categories
 * (kept in the row it was picked up in, with the tab it left) and adding, renaming and deleting of a category (one
 * that can't be a category refused, the images filed under it following), all written back as the settings file
 * holds them, a saved file's settings read and taken back as a build with them would give, and the category tabs (an image under each category it names, Misc for none, opening on the current
 * image's first, those holding nothing shown only to one who can edit them); which images a canvas and a prop accept (when set, and when added with one), what else a user may write
 * to a prop, a prop's lack of a frame, the size its image pins it to (and a canvas's freedom from any), the
 * metadata signal carrying that size, and the play-mode click map naming only props' images.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import PlayModeClickCallbackMap from "../../../src/client/object/maps/playModeClickCallbackMap";
import ImageChoiceUtil from "../../../src/client/ui/util/imageChoiceUtil";
import IMAGE_LICENSES from "../../../dev/scripts/imageMapEditor/core/imageLicenses";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import ImageMapSettingsUtil from "../../../src/shared/graphics/image/util/imageMapSettingsUtil";
import ImageMap from "../../../src/shared/graphics/image/types/imageMap";
import ImageMapSettings from "../../../src/shared/graphics/image/types/imageMapSettings";
import ImageMetadata from "../../../src/shared/graphics/image/types/imageMetadata";
import ImageMapSubfolderTab from "../../../src/shared/graphics/image/types/imageMapSubfolderTab";
import PreEncodedCompositionIndexMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import CanvasObjectTypeConfig, { CANVAS_IMAGE_SUBFOLDER } from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import PropObjectTypeConfig, { PROP_IMAGE_SUBFOLDER } from "../../../src/shared/object/types/objectTypeConfig/propObjectTypeConfig";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import QuarterTurnsUtil from "../../../src/shared/object/util/quarterTurnsUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import { FIXTURE_PICTURES, useFixturePictures } from "../helpers/pictureFixture";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import { ADMIN_ASSET_SETTINGS_FILE_NAME, PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_WORLD_SIZE,
    PICTURE_ATLAS_MAX_REGION_CELLS, PICTURE_SEARCH_FILLER_WORDS, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const ROOM_ID = "picture-room";
const USER = {id: "user-1"} as any;
const ASSETS_DIR = path.join(__dirname, "../../../public/app/assets");
const PICTURES_DIR = path.join(ASSETS_DIR, "pictures");
const DISABLED_PICTURES_DIR = path.join(__dirname, "../../../dev/assets/disabled_pictures");
const CANVAS_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Canvas");
const PROP_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Prop");

describe("the picture map", () => {
    const imageMap = ImageMapUtil.getImageMap("PictureImageMap");
    const inOrder = (images: {path: string}[]) => images.map(image => image.path);
    // A map of its own under a name of its own, registered as the game's are: that is what gives its images their
    // places (see ImageMapUtil.setImageMap).
    const register = (images: ImageMetadata[], subfolderTabs?: ImageMapSubfolderTab[]): ImageMap => {
        const map = new ImageMap("pictures", 0, {}, images.map(image => ({...image})), undefined, 0, subfolderTabs);
        ImageMapUtil.setImageMap("OrderTestImageMap", map);
        return map;
    };

    it("holds everyday objects, which props show, and paintings, which canvases show, and nothing else", () => {
        expect(readManifest().subfolders.map(tab => ({name: tab.name, title: tab.title}))).toEqual([
            {name: PROP_IMAGE_SUBFOLDER, title: "Objects"}, {name: CANVAS_IMAGE_SUBFOLDER, title: "Arts"}]);
        for (const image of readManifest().images)
            expect([PROP_IMAGE_SUBFOLDER, CANVAS_IMAGE_SUBFOLDER], image.path).toContain(ImageMap.getSubfolderName(image.path));
    });

    it("leaves out a tab while every image in it is disabled, and keeps the others as the manifest has them", () => {
        const manifest = readManifest();
        const shipping = manifest.subfolders.filter(tab => manifest.images.some(image =>
            !image.disabled && ImageMap.getSubfolderName(image.path) == tab.name));
        expect(shipping.length).toBeGreaterThan(0);
        expect(imageMap.getSubfolderNames()).toEqual(shipping.map(tab => tab.name));
        for (const tab of shipping)
            expect(imageMap.getSubfolderTitle(tab.name)).toBe(tab.title);
    });

    // Disabled ones too, from where they are parked, so each is ready to be enabled.
    it("keeps every everyday object at its own scale, in whole atlas cells no larger than an image's region, and no painting", async () => {
        const images = readManifest().images;
        const objects = images.filter(image => ImageMap.getSubfolderName(image.path) == PROP_IMAGE_SUBFOLDER);
        expect(objects.length).toBeGreaterThan(0);
        for (const image of objects)
        {
            const file = path.join(image.disabled ? DISABLED_PICTURES_DIR : PICTURES_DIR, `${image.path}.webp`);
            const {width, height} = await sharp(file).metadata();
            const label = `${image.path} (${width}x${height})`;
            expect(image.preserveScale, label).toBe(true);
            if (!image.disabled)
            {
                const built = imageMap.getImageMetadataByPath(image.path);
                expect({width: built.width, height: built.height, preserveScale: built.preserveScale}, label)
                    .toEqual({width, height, preserveScale: true});
            }
            expect(width! % PICTURE_ATLAS_CELL_SIZE, label).toBe(0);
            expect(height! % PICTURE_ATLAS_CELL_SIZE, label).toBe(0);
            expect(Math.max(width!, height!) / PICTURE_ATLAS_CELL_SIZE, label).toBeLessThanOrEqual(PICTURE_ATLAS_MAX_REGION_CELLS);
        }
        for (const image of images.filter(image => ImageMap.getSubfolderName(image.path) == CANVAS_IMAGE_SUBFOLDER))
            expect(image.preserveScale, image.path).toBeUndefined();
    });

    // The same images in no order: the built map keeps each subfolder's together, and the manifest lists them as
    // they were added.
    it("builds every image the manifest lists but the disabled ones, which keep their paths, and marks the staging ones", () => {
        const manifest = readManifest();
        const paths = (images: {path: string}[]) => images.map(image => image.path).sort();
        expect(paths(imageMap.getImageMetadataList())).toEqual(
            paths(manifest.images.filter(image => !image.disabled)));
        expect(paths(imageMap.getImageMetadataList().filter(image => image.staging))).toEqual(
            paths(manifest.images.filter(image => image.staging)));
        expect(manifest.images.filter(image => image.disabled && image.staging).map(image => image.path)).toEqual([]);
    });

    // Settings put in place without a build after them would leave the game showing the old order.
    it("lists each subfolder's images in the order the admin's settings give, those they leave out first", () => {
        const manifest = readManifest();
        const settings = readSettings();
        const tabNames = manifest.subfolders.map(tab => tab.name);
        for (const [subfolderName, indices] of Object.entries(settings.orderedIndicesBySubfolder))
        {
            expect(tabNames).toContain(subfolderName);
            expect(new Set(indices).size, subfolderName).toBe(indices.length);
            expect(indices.every(index => Number.isInteger(index) && index >= 0), subfolderName).toBe(true);
        }
        const inSubfolder = (images: {path: string}[], subfolderName: string) => images.map(image => image.path)
            .filter(imagePath => ImageMap.getSubfolderName(imagePath) == subfolderName);
        const ordered = ImageMapSettingsUtil.sort(manifest.images.filter(image => !image.disabled), settings);
        for (const subfolderName of imageMap.getSubfolderNames())
        {
            expect(inSubfolder(imageMap.getImageMetadataList(), subfolderName), subfolderName)
                .toEqual(inSubfolder(ordered, subfolderName));
        }
    });

    it("builds each tab's categories as the admin's settings list them, the manifest listing none", () => {
        const manifest = readManifest();
        const settings = readSettings();
        for (const tab of manifest.subfolders)
            expect(tab, tab.name).not.toHaveProperty("categories");
        for (const tab of manifest.subfolders.filter(tab => imageMap.getSubfolderNames().includes(tab.name)))
            expect(imageMap.getSubfolderCategories(tab.name), tab.name).toEqual(settings.categoryTabsBySubfolder[tab.name] ?? []);
        // Each can be a category beside those listed before it.
        for (const [subfolderName, categories] of Object.entries(settings.categoryTabsBySubfolder))
        {
            expect(manifest.subfolders.map(tab => tab.name)).toContain(subfolderName);
            categories.forEach((category, place) => expect(ImageMapSettingsUtil.getCategoryProblem(category,
                categories.slice(0, place)), `${subfolderName}: ${category.name}`).toBeUndefined());
        }
    });

    // A category naming no tab (a slip in a hand edit) would silently leave the image out of the tab it was meant
    // for; and settings put in place without a build after them would leave the game filing images as before.
    it("files each image under the categories the admin's settings give it, which name only ones its tab lists", () => {
        const settings = readSettings();
        for (const [subfolderName, categoriesByIndex] of Object.entries(settings.categoriesBySubfolderAndIndex))
        {
            const listed = (settings.categoryTabsBySubfolder[subfolderName] ?? []).map(category => category.name);
            for (const [index, categories] of Object.entries(categoriesByIndex))
            {
                expect(new Set(categories).size, `${subfolderName}/${index}`).toBe(categories.length);
                for (const category of categories)
                    expect(listed, `${subfolderName}/${index}: ${category}`).toContain(category);
            }
        }
        for (const image of imageMap.getImageMetadataList())
        {
            expect(ImageMap.getCategories(image.keywords), image.path)
                .toEqual(ImageMapSettingsUtil.getCategories(settings, image.path));
        }
    });

    // One rule for every tab: the editor edits any entry, painting or everyday object, from its recipe.
    it("keeps a recipe and a full-resolution sample for every image, in every tab", () => {
        const recipes = JSON.parse(fs.readFileSync(path.join(__dirname,
            "../../../dev/scripts/imageMapEditor/recipes/pictures.json"), "utf8")).recipes;
        for (const image of readManifest().images)
        {
            expect(recipes[image.path], image.path).toBeDefined();
            expect(recipes[image.path].output.preserveScale == true, image.path).toBe(image.preserveScale == true);
            expect(fs.existsSync(path.join(__dirname, `../../../dev/assets/pictures/${image.path}.webp`)), image.path)
                .toBe(true);
        }
    });

    it("names every third party's image that ships in the notices, with its author, source and license, and nothing else", () => {
        const manifest = readManifest();
        const notices = fs.readFileSync(path.join(__dirname, "../../../THIRD-PARTY-NOTICES.md"), "utf8");
        const section = /<!-- pictures:begin[^>]*-->([\s\S]*?)<!-- pictures:end -->/.exec(notices)?.[1];
        expect(section, "the notices' table of pictures").toBeDefined();
        const rows = section!.split("\n").filter(line => line.startsWith("| `"));

        const thirdParty = manifest.images.filter(image => image.license && !image.disabled);
        expect(rows.length).toBe(thirdParty.length);
        for (const image of thirdParty)
        {
            expect(IMAGE_LICENSES, image.path).toContain(image.license);
            const row = rows.find(line => line.startsWith(`| \`${image.path}.webp\` |`));
            expect(row, image.path).toBeDefined();
            for (const text of [image.title, image.author, `(${image.source})`, image.license!])
                expect(row, image.path).toContain(text);
        }
        // An everyday object is someone else's photo, with both its source and license, or ThingsPool's own, with
        // neither (see LICENSE-CONTENT.md).
        for (const image of manifest.images.filter(other => ImageMap.getSubfolderName(other.path) == PROP_IMAGE_SUBFOLDER))
        {
            expect(!!image.source, image.path).toBe(!!image.license);
            if (!image.source)
                expect(image.author, image.path).toBe("thingspool");
        }
    });

    // Disabled ones too, so each is ready to be enabled.
    it("finds a painting by its title and author, and an everyday object by keywords of its own", () => {
        const split = (keywords: string) => keywords.split(",").map(word => word.trim().toLowerCase());
        for (const image of readManifest().images)
        {
            const built = imageMap.getImageMetadataByPath(image.path);
            if (ImageMap.getSubfolderName(image.path) == CANVAS_IMAGE_SUBFOLDER)
            {
                expect(image.keywords, image.path).toBeUndefined();
                if (built)
                    expect(split(built.keywords!), image.path).toEqual([...split(image.title), image.author.toLowerCase()]);
                continue;
            }
            const words = split(image.keywords ?? "");
            expect(words.length, image.path).toBeGreaterThanOrEqual(3);
            expect(words, image.path).not.toContain(image.author.toLowerCase());
            // Single words, none inside another (which a search would find anyway), none a filler word (which a
            // search passes over), and none marked as a category (which only the admin's settings do).
            for (const word of words)
            {
                expect(word, image.path).toMatch(/^\S+$/);
                expect(word.endsWith(ImageMap.CATEGORY_MARK), `${image.path}: ${word}`).toBe(false);
                expect(PICTURE_SEARCH_FILLER_WORDS, `${image.path}: ${word}`).not.toContain(word);
                expect(words.filter(other => other != word && other.includes(word)), `${image.path}: ${word}`).toEqual([]);
            }
            // Built in behind the categories it is filed under, but for a word one of those already says.
            if (built)
            {
                const categories = ImageMap.getCategories(built.keywords);
                expect(built.keywords, image.path).toBe(ImageMap.withCategories(
                    words.filter(word => !categories.includes(word)).join(","), categories));
            }
        }
    });

    it("ships no image's title or author, which stay in the manifest for the notices", () => {
        for (const image of imageMap.getImageMetadataList())
        {
            expect(image, image.path).not.toHaveProperty("title");
            expect(image, image.path).not.toHaveProperty("author");
        }
        const built = fs.readFileSync(path.join(__dirname,
            "../../../src/shared/graphics/image/maps/pictureImageMap.ts"), "utf8");
        const list = /const imageMetadataList[^\n]*/.exec(built)?.[0];
        expect(list).toBeDefined();
        expect(list).not.toMatch(/\b(title|author):/);
    });

    it("searches for every word typed but filler words, anywhere in an image's keywords, as typed or singular", () => {
        const items = [{path: "2/a", keywords: "crate,red pepper,vegetable"}, {path: "2/b", keywords: "box,cereal"},
            {path: "1/c", keywords: "the houses of parliament,claude monet"}, {path: "2/d", keywords: "bucket"},
            {path: "2/e", keywords: "meatball,sweet,sour"}];
        const find = (input: string) => ImageChoiceUtil.getFilteredItems(items, input).map(item => item.path);
        expect(find("")).toEqual(["2/a", "2/b", "1/c", "2/d", "2/e"]);
        expect(find("the")).toEqual(["2/a", "2/b", "1/c", "2/d", "2/e"]);
        expect(find("sweet and sour")).toEqual(["2/e"]);
        expect(find("houses of parliament")).toEqual(["1/c"]);
        expect(find("  Red CRATE ")).toEqual(["2/a"]);
        expect(find("peppers")).toEqual(["2/a"]);
        expect(find("boxes, cereal")).toEqual(["2/b"]);
        expect(find("monet parliament")).toEqual(["1/c"]);
        expect(find("pepper monet")).toEqual([]);
        // Too short a word to take a letter off: "bus" is not "bu".
        expect(find("bus")).toEqual([]);
    });

    it("offers a staging image only off the live server, tabs and all, and finds every one by a search for staging", () => {
        const map = new ImageMap("pictures", 0, {}, [{path: "2/1", keywords: "kitchen*,oven,stove"},
            {path: "2/2", keywords: "office*,screen,computer", staging: true},
            {path: "2/3", keywords: "kitchen*,oven,toaster", staging: true}],
            undefined, 0, [{name: "2", title: "Objects", categories: [{name: "kitchen", title: "Kitchen"},
                {name: "office", title: "Office"}]}]);
        const paths = (items: {path: string}[]) => items.map(item => item.path).sort();

        // On the live server, neither the staging images nor a tab only they fill, so the word finds nothing.
        const live = ImageChoiceUtil.getItems(map, "2", false);
        expect(paths(live)).toEqual(["2/1"]);
        expect(paths(ImageChoiceUtil.getOffered(map, "2", false))).toEqual(["2/1"]);
        expect(ImageChoiceUtil.getCategoryTabs(map, "2", live)).toEqual([ImageMap.ALL_TAB, "kitchen"]);
        expect(ImageChoiceUtil.getFilteredItems(live, "staging")).toEqual([]);

        // Off it, every image; the word finds the staging ones as one of their keywords would, alone or with others.
        const offLive = ImageChoiceUtil.getItems(map, "2", true);
        expect(paths(offLive)).toEqual(["2/1", "2/2", "2/3"]);
        expect(ImageChoiceUtil.getCategoryTabs(map, "2", offLive)).toEqual([ImageMap.ALL_TAB, "kitchen", "office"]);
        expect(paths(ImageChoiceUtil.getFilteredItems(offLive, "staging"))).toEqual(["2/2", "2/3"]);
        expect(paths(ImageChoiceUtil.getFilteredItems(offLive, "Staging oven"))).toEqual(["2/3"]);
        expect(paths(ImageChoiceUtil.getFilteredItems(offLive, "oven"))).toEqual(["2/1", "2/3"]);
    });

    it("offers a tab for each category its images name, each image under every one it names and Misc for the rest", () => {
        const map = new ImageMap("pictures", 0, {}, [{path: "2/1", keywords: "kitchen*,dining*,plate,bread"},
            {path: "2/2", keywords: "kitchen*,oven,stove"}, {path: "2/3", keywords: "dining*,plate,steak"},
            {path: "2/4", keywords: "sock,clothes,bedroom"},
            {path: "1/1", keywords: "apollo and daphne,john singer sargent"}],
            undefined, 0, [{name: "2", title: "Objects", categories: [{name: "kitchen", title: "Kitchen"},
                {name: "dining", title: "Dining Room"}, {name: "bedroom", title: "Bedroom"}]}, {name: "1", title: "Arts"}]);
        const items = ImageChoiceUtil.getItems(map, "2", true);
        expect(items.map(item => item.path)).toEqual(["2/1", "2/2", "2/3", "2/4"]);

        // Bedroom holds none, as a keyword unmarked is only a word, so it offers no tab.
        expect(ImageChoiceUtil.getCategoryTabs(map, "2", items)).toEqual([ImageMap.ALL_TAB, "kitchen", "dining",
            ImageMap.MISC_TAB]);
        const inTab = (tab: string) => ImageChoiceUtil.getItemsInTab(map, "2", items, tab).map(item => item.path);
        expect(inTab("kitchen")).toEqual(["2/1", "2/2"]);
        expect(inTab("dining")).toEqual(["2/1", "2/3"]);
        expect(inTab(ImageMap.MISC_TAB)).toEqual(["2/4"]);
        expect(inTab(ImageMap.ALL_TAB)).toEqual(["2/1", "2/2", "2/3", "2/4"]);
        // A subfolder listing no categories offers no tabs, and All is the one order.
        const paintings = ImageChoiceUtil.getItems(map, "1", true);
        expect(ImageChoiceUtil.getCategoryTabs(map, "1", paintings)).toEqual([]);
        expect(ImageChoiceUtil.getItemsInTab(map, "1", paintings, ImageMap.ALL_TAB)).toEqual(paintings);
    });

    it("offers a subfolder's images in the order the map lists them in, which a tab or a search only narrows", () => {
        const map = register([{path: "2/5", keywords: "kitchen*,oven,stove"}, {path: "1/2", keywords: "ground swell"},
            {path: "2/1", keywords: "office*,screen,computer", staging: true}, {path: "2/9", keywords: "kitchen*,plate,oven"},
            {path: "1/7", keywords: "lenna"}, {path: "2/3", keywords: "sock,clothes"}],
            [{name: "2", title: "Objects", categories: [{name: "kitchen", title: "Kitchen"}, {name: "office", title: "Office"}]},
                {name: "1", title: "Arts"}]);
        // Each image's place is its index in the list, whatever its path or keywords.
        expect(map.getImageMetadataList().map(image => image.order)).toEqual([0, 1, 2, 3, 4, 5]);
        const items = ImageChoiceUtil.getItems(map, "2", true);
        expect(inOrder(items)).toEqual(["2/5", "2/1", "2/9", "2/3"]);
        expect(inOrder(ImageChoiceUtil.getItems(map, "2", false))).toEqual(["2/5", "2/9", "2/3"]);
        expect(inOrder(ImageChoiceUtil.getItems(map, "1", true))).toEqual(["1/2", "1/7"]);

        expect(inOrder(ImageChoiceUtil.getItemsInTab(map, "2", items, ImageMap.ALL_TAB))).toEqual(inOrder(items));
        expect(inOrder(ImageChoiceUtil.getItemsInTab(map, "2", items, "kitchen"))).toEqual(["2/5", "2/9"]);
        expect(inOrder(ImageChoiceUtil.getItemsInTab(map, "2", items, ImageMap.MISC_TAB))).toEqual(["2/3"]);
        expect(inOrder(ImageChoiceUtil.getFilteredItems(items, "oven"))).toEqual(["2/5", "2/9"]);
    });

    it("puts a rearranged image at its place in the row shown, and leaves every other where it was among the rest", () => {
        const images = ["2/1", "1/1", "2/2", "2/3", "1/2", "2/4", "2/5", "2/6"].map(imagePath => ({path: imagePath}));
        const order = (map: ImageMap, subfolderName: string) => inOrder(ImageChoiceUtil.getItems(map, subfolderName, true));

        // The whole row: where it is dropped.
        let map = register(images);
        ImageChoiceUtil.moveItem(map, order(map, "2"), "2/2", 4);
        expect(order(map, "2")).toEqual(["2/1", "2/3", "2/4", "2/5", "2/2", "2/6"]);
        ImageChoiceUtil.moveItem(map, order(map, "2"), "2/6", 0);
        expect(order(map, "2")).toEqual(["2/6", "2/1", "2/3", "2/4", "2/5", "2/2"]);
        // The other subfolder is none of its business, and the places handed out are still the list's.
        expect(order(map, "1")).toEqual(["1/1", "1/2"]);
        expect(map.getImageMetadataList().map(image => image.order!).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

        // A row narrowed to some (a tab's, a search's): right before the one it then shows after it.
        map = register(images);
        ImageChoiceUtil.moveItem(map, ["2/2", "2/4", "2/6"], "2/6", 1);
        expect(order(map, "2")).toEqual(["2/1", "2/2", "2/3", "2/6", "2/4", "2/5"]);
        // At the row's end: right after its last.
        map = register(images);
        ImageChoiceUtil.moveItem(map, ["2/2", "2/4", "2/6"], "2/2", 2);
        expect(order(map, "2")).toEqual(["2/1", "2/3", "2/4", "2/5", "2/6", "2/2"]);
        // A row of one has nowhere else to put it.
        map = register(images);
        ImageChoiceUtil.moveItem(map, ["2/4"], "2/4", 0);
        expect(order(map, "2")).toEqual(["2/1", "2/2", "2/3", "2/4", "2/5", "2/6"]);
    });

    it("keeps to that whatever row is shown and wherever the image is dropped in it", () => {
        fc.assert(fc.property(fc.uniqueArray(fc.integer({min: 1, max: 99}), {minLength: 2, maxLength: 24}),
            fc.array(fc.boolean(), {minLength: 24, maxLength: 24}), fc.nat(), fc.nat(), (numbers, shown, from, to) => {
            // Paintings among them, as a map's list holds its subfolders'.
            const map = register(numbers.flatMap(number => [{path: `2/${number}`}, {path: `1/${number}`}]));
            const before = inOrder(ImageChoiceUtil.getItems(map, "2", true));
            const row = before.filter((_, index) => shown[index]);
            fc.pre(row.length >= 2 && from % row.length != to % row.length);
            const moved = row[from % row.length];
            const rearranged = row.filter(imagePath => imagePath != moved);
            rearranged.splice(to % row.length, 0, moved);

            ImageChoiceUtil.moveItem(map, row, moved, to % row.length);
            const after = inOrder(ImageChoiceUtil.getItems(map, "2", true));
            expect(after.filter(imagePath => row.includes(imagePath))).toEqual(rearranged);
            expect(after.filter(imagePath => imagePath != moved)).toEqual(before.filter(imagePath => imagePath != moved));
            const next = rearranged[rearranged.indexOf(moved) + 1];
            if (next != undefined)
                expect(after[after.indexOf(moved) + 1]).toBe(next);
            else
                expect(after[after.indexOf(moved) - 1]).toBe(rearranged[rearranged.length - 2]);
            expect(inOrder(ImageChoiceUtil.getItems(map, "1", true))).toEqual(numbers.map(number => `1/${number}`));
        }));
    });

    it("files an image under the categories an admin sets, and keeps one picked up in its row though it leaves the tab", () => {
        const map = register([{path: "2/1", keywords: "kitchen*,oven"}, {path: "2/2", keywords: "kitchen*,office*,kettle"},
            {path: "2/3", keywords: "sock"}],
            [{name: "2", title: "Objects", categories: [{name: "kitchen", title: "Kitchen"}, {name: "office", title: "Office"}]}]);
        const items = () => ImageChoiceUtil.getItems(map, "2", true);
        const inTab = (tab: string) => inOrder(ImageChoiceUtil.getItemsInTab(map, "2", items(), tab));
        expect(ImageChoiceUtil.getCategories(map, "2/2")).toEqual(["kitchen", "office"]);
        expect(ImageChoiceUtil.getCategories(map, "2/3")).toEqual([]);

        // Taken out of a tab, and put under others, the first being the one a chooser opens on.
        ImageChoiceUtil.setCategories(map, "2/1", []);
        ImageChoiceUtil.setCategories(map, "2/3", ["office", "kitchen"]);
        expect(map.getImageMetadataByPath("2/1").keywords).toBe("oven");
        expect(map.getImageMetadataByPath("2/3").keywords).toBe("office*,kitchen*,sock");
        expect(inTab("kitchen")).toEqual(["2/2", "2/3"]);
        expect(inTab("office")).toEqual(["2/2", "2/3"]);
        expect(inTab(ImageMap.MISC_TAB)).toEqual(["2/1"]);
        expect(ImageChoiceUtil.getFirstCategoryTab(map, "2", "2/3")).toBe("office");
        expect(ImageChoiceUtil.getFirstCategoryTab(map, "2", "2/1")).toBe(ImageMap.MISC_TAB);

        // The row it was picked up in keeps it, in its place, until the row is narrowed anew.
        const narrowed = ImageChoiceUtil.getItemsInTab(map, "2", items(), "kitchen");
        expect(inOrder(ImageChoiceUtil.getRow(items(), narrowed, ["2/1"]))).toEqual(["2/1", "2/2", "2/3"]);
        expect(inOrder(ImageChoiceUtil.getRow(items(), narrowed, ["2/3"]))).toEqual(["2/2", "2/3"]);
        expect(ImageChoiceUtil.getRow(items(), narrowed, [])).toBe(narrowed);
        // And a tab emptied that way stays for as long.
        ImageChoiceUtil.setCategories(map, "2/2", ["kitchen"]);
        ImageChoiceUtil.setCategories(map, "2/3", ["kitchen"]);
        expect(ImageChoiceUtil.getCategoryTabs(map, "2", items())).toEqual([ImageMap.ALL_TAB, "kitchen", ImageMap.MISC_TAB]);
        expect(ImageChoiceUtil.getCategoryTabs(map, "2", items(), "office"))
            .toEqual([ImageMap.ALL_TAB, "kitchen", "office", ImageMap.MISC_TAB]);
    });

    it("names an image's categories ahead of its other keywords, whatever they are set to", () => {
        const names = fc.uniqueArray(fc.stringMatching(/^[a-z0-9]{1,8}$/), {maxLength: 5});
        fc.assert(fc.property(names, names, names, (before, after, others) => {
            const keywords = ImageMap.withCategories(others.join(","), before);
            expect(ImageMap.getCategories(keywords)).toEqual(before);
            const changed = ImageMap.withCategories(keywords, after);
            expect(ImageMap.getCategories(changed)).toEqual(after);
            expect(changed).toBe([...after.map(name => name + ImageMap.CATEGORY_MARK), ...others].join(","));
        }));
        expect(ImageMap.getCategories(undefined)).toEqual([]);
        expect(ImageMap.withCategories(undefined, [])).toBe("");
    });

    it("says why a category can't be one, and names one by its title's letters and digits", () => {
        expect(ImageMapSettingsUtil.toCategory("  Dining   Room! ")).toEqual({name: "diningroom", title: "Dining Room!"});
        const others = [{name: "bathroom", title: "Bathroom"}, {name: "office", title: "Office"}];
        const problem = (title: string) => ImageMapSettingsUtil.getCategoryProblem(ImageMapSettingsUtil.toCategory(title), others);
        expect(problem("Kitchen")).toBeUndefined();
        expect(problem("   ")).toMatch(/needs a title/);
        expect(problem("★")).toMatch(/needs a letter or a digit/);
        // The two tabs every chooser has, a name another has, and one inside another's or holding another's.
        expect(problem("All")).toMatch(/"all" is a tab every chooser has of its own/);
        expect(problem("MISC")).toMatch(/"misc" is a tab every chooser has of its own/);
        expect(problem("Bath Room")).toMatch(/already a category named "bathroom"/);
        expect(problem("Bath")).toMatch(/"bath" is inside "bathroom"/);
        expect(problem("Home Office")).toMatch(/"office", another category's name, is inside "homeoffice"/);
        // A name the settings file gives is held to the same.
        expect(ImageMapSettingsUtil.getCategoryProblem({name: "Dining Room", title: "Dining Room"}, others))
            .toMatch(/one word of lowercase letters and digits, not "Dining Room"/);
        fc.assert(fc.property(fc.string(), title => {
            const name = ImageMapSettingsUtil.toCategory(title).name;
            expect(name == "" || ImageMapSettingsUtil.isCategoryName(name)).toBe(true);
        }));
    });

    it("adds, renames and deletes a category for an admin, the images filed under it following", () => {
        const kitchen = {name: "kitchen", title: "Kitchen"}, office = {name: "office", title: "Office"};
        const map = register([{path: "2/1", keywords: "kitchen*,oven"},
            {path: "2/2", keywords: "office*,kitchen*,kettle", staging: true}, {path: "2/3", keywords: "sock"},
            {path: "1/1", keywords: "kitchen*,still life"}],
            [{name: "2", title: "Objects", categories: [kitchen, office]}, {name: "1", title: "Arts"}]);
        const keywords = () => map.getImageMetadataList().map(image => image.keywords);
        const names = (subfolderName: string) => map.getSubfolderCategories(subfolderName).map(category => category.name);

        // Added after the others, unless it can't be one beside them.
        const dining = ImageMapSettingsUtil.toCategory("Dining Room");
        expect(ImageChoiceUtil.addCategory(map, "2", dining)).toBeUndefined();
        expect(map.getSubfolderCategories("2")).toEqual([kitchen, office, dining]);
        expect(ImageChoiceUtil.addCategory(map, "2", ImageMapSettingsUtil.toCategory("KITCHEN"))).toMatch(/already a category/);
        expect(names("2")).toEqual(["kitchen", "office", "diningroom"]);
        // Holding nothing yet, its tab is shown only to one who can edit the tabs.
        const items = ImageChoiceUtil.getItems(map, "2", true);
        expect(ImageChoiceUtil.getCategoryTabs(map, "2", items)).toEqual([ImageMap.ALL_TAB, "kitchen", "office", ImageMap.MISC_TAB]);
        expect(ImageChoiceUtil.getCategoryTabs(map, "2", items, undefined, true))
            .toEqual([ImageMap.ALL_TAB, "kitchen", "office", "diningroom", ImageMap.MISC_TAB]);
        // A subfolder with none can be given its first.
        expect(ImageChoiceUtil.addCategory(map, "1", ImageMapSettingsUtil.toCategory("Landscape"))).toBeUndefined();
        expect(names("1")).toEqual(["landscape"]);

        // Renamed in its place, every image under it following, offered or not; the other subfolder's are not its own.
        expect(ImageChoiceUtil.renameCategory(map, "2", "kitchen", ImageMapSettingsUtil.toCategory("Galley"))).toBeUndefined();
        expect(names("2")).toEqual(["galley", "office", "diningroom"]);
        expect(keywords()).toEqual(["galley*,oven", "office*,galley*,kettle", "sock", "kitchen*,still life"]);
        // To a title naming it the same, no image is touched; to a name another has, nothing is.
        expect(ImageChoiceUtil.renameCategory(map, "2", "galley", {name: "galley", title: "The Galley"})).toBeUndefined();
        expect(map.getSubfolderCategories("2")[0]).toEqual({name: "galley", title: "The Galley"});
        expect(ImageChoiceUtil.renameCategory(map, "2", "galley", ImageMapSettingsUtil.toCategory("Office"))).toMatch(/already a category/);
        expect(keywords()).toEqual(["galley*,oven", "office*,galley*,kettle", "sock", "kitchen*,still life"]);

        // Deleted, it is gone from the list and from every image.
        ImageChoiceUtil.removeCategory(map, "2", "galley");
        expect(names("2")).toEqual(["office", "diningroom"]);
        expect(keywords()).toEqual(["oven", "office*,kettle", "sock", "kitchen*,still life"]);
        expect(inOrder(ImageChoiceUtil.getItemsInTab(map, "2", items, ImageMap.MISC_TAB))).toEqual(["2/1", "2/3"]);
        // And what is saved says so.
        expect(ImageChoiceUtil.getSettings(map).categoryTabsBySubfolder)
            .toEqual({"2": [office, dining], "1": [{name: "landscape", title: "Landscape"}]});
    });

    it("writes the settings back as their file holds them: each subfolder on a line, its images in the order shown", () => {
        const kitchen = {name: "kitchen", title: "Kitchen"}, office = {name: "office", title: "Office"};
        const map = register([{path: "2/5", keywords: "kitchen*,oven"}, {path: "1/2"},
            {path: "2/1", keywords: "office*,kitchen*,screen"}, {path: `${PROP_IMAGE_SUBFOLDER}/fixture-square`},
            {path: "1/7"}, {path: "2/30", keywords: "sock"}],
            [{name: "2", title: "Objects", categories: [kitchen, office]}, {name: "1", title: "Arts"}]);
        ImageChoiceUtil.moveItem(map, ["2/5", "2/1", "2/30"], "2/30", 0);
        ImageChoiceUtil.setCategories(map, "2/30", ["office"]);
        // One whose path ends in no number can't be listed.
        const settings = ImageChoiceUtil.getSettings(map);
        expect(settings).toEqual({categoryTabsBySubfolder: {"1": [], "2": [kitchen, office]},
            orderedIndicesBySubfolder: {"1": [2, 7], "2": [30, 5, 1]},
            categoriesBySubfolderAndIndex: {"1": {"2": [], "7": []},
                "2": {"30": ["office"], "5": ["kitchen"], "1": ["office", "kitchen"]}}});
        expect(ImageMapSettingsUtil.getMapKey("OrderTestImageMap")).toBe("orderTestImageMap");
        const text = ImageMapSettingsUtil.serializeFile({orderTestImageMap: settings});
        expect(text).toBe(`{\n    "orderTestImageMap": {\n        "categoryTabsBySubfolder": {\n            "1": [],\n`
            + `            "2": [{"name": "kitchen", "title": "Kitchen"}, {"name": "office", "title": "Office"}]\n        },\n`
            + `        "orderedIndicesBySubfolder": {\n`
            + `            "1": [2, 7],\n            "2": [30, 5, 1]\n        },\n`
            + `        "categoriesBySubfolderAndIndex": {\n            "1": {"2": [], "7": []},\n`
            + `            "2": {"30": ["office"], "5": ["kitchen"], "1": ["office", "kitchen"]}\n        }\n    }\n}\n`);
        expect(JSON.parse(text)).toEqual({orderTestImageMap: settings});

        // The picture map's own, put in the settings file's place and built, give the map as it is offered now.
        const own = ImageChoiceUtil.getSettings(imageMap);
        const rebuilt = ImageMapSettingsUtil.sort(readManifest().images.filter(image => !image.disabled), own);
        for (const subfolderName of imageMap.getSubfolderNames())
        {
            expect(inOrder(rebuilt).filter(imagePath => ImageMap.getSubfolderName(imagePath) == subfolderName), subfolderName)
                .toEqual(inOrder(ImageChoiceUtil.getItems(imageMap, subfolderName, true)));
        }
        for (const image of imageMap.getImageMetadataList())
            expect(ImageMapSettingsUtil.getCategories(own, image.path), image.path).toEqual(ImageMap.getCategories(image.keywords));
        // Untouched, they are the file's own for the images it names: one it leaves out comes before those it lists
        // and is under no category, and what it says of images the map doesn't hold is passed over.
        const file = readSettings();
        expect(own.categoryTabsBySubfolder).toEqual(file.categoryTabsBySubfolder);
        for (const [subfolderName, indices] of Object.entries(own.orderedIndicesBySubfolder))
        {
            const listed = (file.orderedIndicesBySubfolder[subfolderName] ?? []).filter(index => indices.includes(index));
            expect(indices, subfolderName).toEqual([...indices.filter(index => !listed.includes(index)), ...listed]);
        }
        for (const [subfolderName, categoriesByIndex] of Object.entries(own.categoriesBySubfolderAndIndex))
        {
            const filed = file.categoriesBySubfolderAndIndex[subfolderName] ?? {};
            for (const [index, categories] of Object.entries(categoriesByIndex))
                expect(categories, `${subfolderName}/${index}`).toEqual(filed[index] ?? []);
        }
    });

    it("reads a map's part of a settings file, none where the file holds none, and says why a file can't be used", () => {
        const text = fs.readFileSync(path.join(ASSETS_DIR, ADMIN_ASSET_SETTINGS_FILE_NAME), "utf8");
        expect(ImageMapSettingsUtil.parseFile(text, "pictureImageMap")).toEqual({settings: readSettings()});
        expect(ImageMapSettingsUtil.parseFile(text, "otherImageMap")).toEqual({});
        expect(ImageMapSettingsUtil.parseFile("{", "pictureImageMap")).toEqual({problem: "is not valid JSON"});
        expect(ImageMapSettingsUtil.parseFile("[]", "pictureImageMap")).toEqual({problem: "holds no settings"});
        // Nothing of a part that can't be used is given (the builder's own tests go through every such problem).
        expect(ImageMapSettingsUtil.parseFile(JSON.stringify({pictureImageMap: {categoryTabsBySubfolder: {},
            orderedIndicesBySubfolder: {"2": [3, 3]}, categoriesBySubfolderAndIndex: {}}}), "pictureImageMap"))
            .toEqual({problem: `lists image 3 twice under "2"`});
    });

    it("takes saved settings back as a build with them would: the categories, each image's own and the order, whatever was set before", () => {
        const kitchen = {name: "kitchen", title: "Kitchen"}, office = {name: "office", title: "Office"};
        const dining = {name: "dining", title: "Dining Room"};
        const tabs = [{name: "2", title: "Objects", categories: [kitchen, office]}, {name: "1", title: "Arts"}];
        const map = register([{path: "2/5", keywords: "kitchen*,oven"}, {path: "1/2", keywords: "ground swell"},
            {path: "2/1", keywords: "office*,kitchen*,screen"}, {path: "1/7", keywords: "lenna"},
            {path: "2/30", keywords: "sock"}, {path: "2/8", keywords: "kettle"}], tabs);
        ImageChoiceUtil.moveItem(map, ["2/5", "2/1", "2/30", "2/8"], "2/8", 0);

        // They leave 5 and 8 out, which come first as the map lists them (not as rearranged) and are under no
        // category. 99 names no image and 9 no subfolder; kitchen is no longer listed, so 1 is under office alone.
        ImageChoiceUtil.applySettings(map, {categoryTabsBySubfolder: {"2": [office, dining], "9": [kitchen]},
            orderedIndicesBySubfolder: {"2": [30, 99, 1], "9": [1]},
            categoriesBySubfolderAndIndex: {"2": {"30": ["dining", "office"], "1": ["kitchen", "office"], "99": ["office"]}}});
        expect(map.getSubfolderCategories("2")).toEqual([office, dining]);
        expect(map.getSubfolderCategories("1")).toEqual([]);
        expect(inOrder(ImageChoiceUtil.getItems(map, "2", true))).toEqual(["2/5", "2/8", "2/30", "2/1"]);
        expect(inOrder(ImageChoiceUtil.getItems(map, "1", true))).toEqual(["1/2", "1/7"]);
        expect(Object.fromEntries(map.getImageMetadataList().map(image => [image.path, image.keywords]))).toEqual({
            "2/5": "oven", "1/2": "ground swell", "2/1": "office*,screen", "1/7": "lenna",
            "2/30": "dining*,office*,sock", "2/8": "kettle"});
        // The places handed out are still the list's, each subfolder keeping its own.
        expect(map.getImageMetadataList().map(image => image.order)).toEqual([0, 1, 5, 3, 4, 2]);

        // Whatever an admin's edits, saved to a file and taken back by the map as built, they are there again.
        const offered = (shown: ImageMap) => ({
            categories: ["2", "1"].map(subfolderName => shown.getSubfolderCategories(subfolderName)),
            images: shown.getImageMetadataList().map(image => [image.path, image.keywords ?? "", image.order])});
        fc.assert(fc.property(fc.uniqueArray(fc.integer({min: 1, max: 99}), {minLength: 1, maxLength: 12}),
            fc.array(fc.tuple(fc.nat(), fc.nat(), fc.shuffledSubarray(["kitchen", "office", "dining"])), {maxLength: 12}),
            fc.boolean(), (numbers, edits, withoutOffice) => {
            const images = numbers.flatMap(number => [{path: `2/${number}`, keywords: `thing${number}`}, {path: `1/${number}`}]);
            const edited = register(images, tabs);
            expect(ImageChoiceUtil.addCategory(edited, "2", dining)).toBeUndefined();
            for (const [from, to, categories] of edits)
            {
                const row = inOrder(ImageChoiceUtil.getItems(edited, "2", true));
                ImageChoiceUtil.moveItem(edited, row, row[from % row.length], to % row.length);
                ImageChoiceUtil.setCategories(edited, row[from % row.length], categories);
            }
            if (withoutOffice)
                ImageChoiceUtil.removeCategory(edited, "2", "office");
            const saved = ImageChoiceUtil.getSettings(edited);

            const fresh = register(images, tabs);
            const {settings, problem} = ImageMapSettingsUtil.parseFile(
                ImageMapSettingsUtil.serializeFile({orderTestImageMap: saved}), "orderTestImageMap");
            expect(problem).toBeUndefined();
            ImageChoiceUtil.applySettings(fresh, settings!);
            expect(offered(fresh)).toEqual(offered(edited));
            expect(ImageChoiceUtil.getSettings(fresh)).toEqual(saved);
        }));
    });

    it("applies settings to a list: each subfolder's images in the order listed, those left out first", () => {
        const images = ["1/1", "2/1", "2/2", "1/2", "2/3", "2/4", "1/3"].map(imagePath => ({path: imagePath}));
        const ordered = (orderedIndicesBySubfolder: {[subfolderName: string]: number[]}) => inOrder(ImageMapSettingsUtil
            .sort(images, {categoryTabsBySubfolder: {}, orderedIndicesBySubfolder, categoriesBySubfolderAndIndex: {}}));
        // 99 names no image, and subfolder 9 none either: both are passed over. Subfolder 1 is not listed at all.
        expect(ordered({"2": [3, 99, 1], "9": [1]})).toEqual(["1/1", "2/2", "2/4", "1/2", "2/3", "2/1", "1/3"]);
        expect(ordered({})).toEqual(inOrder(images));
        // An image left out is under no category.
        const settings = {categoryTabsBySubfolder: {}, orderedIndicesBySubfolder: {},
            categoriesBySubfolderAndIndex: {"2": {"3": ["kitchen", "office"]}}};
        expect(ImageMapSettingsUtil.getCategories(settings, "2/3")).toEqual(["kitchen", "office"]);
        expect(ImageMapSettingsUtil.getCategories(settings, "2/4")).toEqual([]);
        expect(ImageMapSettingsUtil.getCategories(settings, "1/3")).toEqual([]);

        // What a chooser's images are written back as puts a list in that order again, however it came.
        const numbered = fc.uniqueArray(fc.tuple(fc.constantFrom("1", "2", "3"), fc.integer({min: 0, max: 60}))
            .map(([subfolderName, number]) => `${subfolderName}/${number}`), {maxLength: 30});
        fc.assert(fc.property(numbered.chain(ordered => fc.tuple(fc.constant(ordered),
            fc.shuffledSubarray(ordered, {minLength: ordered.length}))), ([ordered, shuffled]) => {
            const sorted = inOrder(ImageMapSettingsUtil.sort(shuffled.map(imagePath => ({path: imagePath})),
                ImageMapSettingsUtil.fromImages(ordered.map(imagePath => ({path: imagePath})), {})));
            for (const subfolderName of ["1", "2", "3"])
            {
                const inSubfolder = (list: string[]) => list.filter(imagePath => ImageMap.getSubfolderName(imagePath) == subfolderName);
                expect(inSubfolder(sorted)).toEqual(inSubfolder(ordered));
            }
        }));
    });

    it("opens on the category an image's foremost keyword names, Misc if it names none, All if it can't tell", () => {
        const map = new ImageMap("pictures", 0, {}, [{path: "2/1", keywords: "kitchen*,dining*,plate,bread"},
            {path: "2/2", keywords: "sock,clothes"}, {path: "2/3", keywords: "kitchen,oven"},
            {path: "1/1", keywords: "apollo and daphne,john singer sargent"}],
            undefined, 0, [{name: "2", title: "Objects", categories: [{name: "kitchen", title: "Kitchen"},
                {name: "dining", title: "Dining Room"}]}, {name: "1", title: "Arts"}]);
        expect(ImageChoiceUtil.getFirstCategoryTab(map, "2", "2/1")).toBe("kitchen");
        expect(ImageChoiceUtil.getFirstCategoryTab(map, "2", "2/2")).toBe(ImageMap.MISC_TAB);
        // Unmarked, a category's name is only a word.
        expect(ImageChoiceUtil.getFirstCategoryTab(map, "2", "2/3")).toBe(ImageMap.MISC_TAB);
        // An image the map doesn't hold (say, disabled since it was set), and a subfolder listing no categories.
        expect(ImageChoiceUtil.getFirstCategoryTab(map, "2", "2/9")).toBe(ImageMap.ALL_TAB);
        expect(ImageChoiceUtil.getFirstCategoryTab(map, "1", "1/1")).toBe(ImageMap.ALL_TAB);
    });
});

describe("with an image of each kind", () => {
    useFixturePictures();

    const setImage = (config: typeof CanvasObjectTypeConfig | typeof PropObjectTypeConfig, imagePath: string) =>
        config.canUserSetObjectMetadata(USER, {objectById: {}} as any, objectOf(PROP_TYPE_INDEX) as any,
            new SetObjectMetadataSignal(ROOM_ID, "x", ObjectMetadataKeyEnumMap.ImagePath, imagePath));
    const addWith = (config: typeof CanvasObjectTypeConfig | typeof PropObjectTypeConfig, objectTypeIndex: number,
        imagePath?: string, sourceUserID: string = USER.id) =>
        config.canUserAddObject(USER, {objectById: {}} as any, objectOf(objectTypeIndex,
            (imagePath != undefined) ? {[ObjectMetadataKeyEnumMap.ImagePath]: imagePath} : {}, sourceUserID));

    it("a canvas shows only paintings, and a prop only everyday objects", () => {
        for (const object of [FIXTURE_PICTURES.square, FIXTURE_PICTURES.wide, FIXTURE_PICTURES.tall])
        {
            expect(setImage(PropObjectTypeConfig, object), object).toBe(true);
            expect(setImage(CanvasObjectTypeConfig, object), object).toBe(false);
        }
        expect(setImage(CanvasObjectTypeConfig, FIXTURE_PICTURES.painting)).toBe(true);
        expect(setImage(PropObjectTypeConfig, FIXTURE_PICTURES.painting)).toBe(false);
        for (const config of [CanvasObjectTypeConfig, PropObjectTypeConfig])
        {
            expect(setImage(config, "no/such/image")).toBe(false);
            expect(setImage(config, `${PROP_IMAGE_SUBFOLDER}/no-such-image`)).toBe(false);
        }
    });

    it("the image one is added with is held to the same, and one may be added without", () => {
        expect(addWith(CanvasObjectTypeConfig, CANVAS_TYPE_INDEX, FIXTURE_PICTURES.painting)).toBe(true);
        expect(addWith(CanvasObjectTypeConfig, CANVAS_TYPE_INDEX, FIXTURE_PICTURES.square)).toBe(false);
        expect(addWith(PropObjectTypeConfig, PROP_TYPE_INDEX, FIXTURE_PICTURES.square)).toBe(true);
        expect(addWith(PropObjectTypeConfig, PROP_TYPE_INDEX, FIXTURE_PICTURES.painting)).toBe(false);
        expect(addWith(CanvasObjectTypeConfig, CANVAS_TYPE_INDEX)).toBe(true);
        expect(addWith(PropObjectTypeConfig, PROP_TYPE_INDEX)).toBe(true);
        // Nor on someone else's behalf.
        expect(addWith(PropObjectTypeConfig, PROP_TYPE_INDEX, FIXTURE_PICTURES.square, "someone-else")).toBe(false);
    });

    it("a user may change a prop's image and quarter-turns, and nothing else", () => {
        const setMetadata = (metadataKey: number, metadataValue: string) =>
            PropObjectTypeConfig.canUserSetObjectMetadata(USER, {objectById: {}} as any, objectOf(PROP_TYPE_INDEX) as any,
                new SetObjectMetadataSignal(ROOM_ID, "x", metadataKey, metadataValue));
        expect(setMetadata(ObjectMetadataKeyEnumMap.ImagePath, FIXTURE_PICTURES.wide)).toBe(true);
        expect(setMetadata(ObjectMetadataKeyEnumMap.QuarterTurns, QuarterTurnsUtil.encode(1))).toBe(true);
        // Not even a canvas's look, framed or not: a prop has none.
        for (const compositionIndex of PreEncodedCompositionIndexMap.Canvas.slice(0, 2))
        {
            expect(setMetadata(ObjectMetadataKeyEnumMap.InstancedMeshComposition,
                CompositionMetadataUtil.encodeIndexed(compositionIndex, 0))).toBe(false);
        }
        expect(setMetadata(ObjectMetadataKeyEnumMap.Label, "hello")).toBe(false);
    });

    it("pins a prop to its image's own size, turned with it, and leaves a canvas at any size", () => {
        const objects = [FIXTURE_PICTURES.square, FIXTURE_PICTURES.wide, FIXTURE_PICTURES.tall];
        const imageMap = ImageMapUtil.getImageMap("PictureImageMap");
        for (const imagePath of objects)
        {
            const image = imageMap.getImageMetadataByPath(imagePath);
            const scale = PropObjectTypeConfig.util.getImageScale(imagePath, 0)!;
            expect(scale, imagePath).toEqual({x: image.width! / PICTURE_ATLAS_CELL_SIZE * PICTURE_ATLAS_CELL_WORLD_SIZE,
                y: image.height! / PICTURE_ATLAS_CELL_SIZE * PICTURE_ATLAS_CELL_WORLD_SIZE, z: 1});
            expect(PropObjectTypeConfig.util.getImageScale(imagePath, 3), imagePath).toEqual({x: scale.y, y: scale.x, z: 1});
            // A size a prop can have, and the one its metadata holds it to.
            expect(ObjectScaleUtil.sanitize(PROP_TYPE_INDEX, scale), imagePath).toEqual(scale);
            const metadata = {[ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(imagePath)};
            expect(ObjectScaleUtil.getFixedScale(PROP_TYPE_INDEX, metadata), imagePath).toEqual(scale);
            expect(ObjectScaleUtil.allowsScale(PROP_TYPE_INDEX, metadata, {x: 0.5, y: 0.5, z: 1}), imagePath)
                .toBe(scale.x == 0.5 && scale.y == 0.5);
            expect(ObjectScaleUtil.getFixedScale(CANVAS_TYPE_INDEX, metadata), imagePath).toBeUndefined();
        }
        expect(PropObjectTypeConfig.util.getImageScale(FIXTURE_PICTURES.painting, 0)).toBeUndefined();
        expect(PropObjectTypeConfig.util.getImageScale("no/such/image", 0)).toBeUndefined();
        const painting = {[ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(FIXTURE_PICTURES.painting)};
        expect(ObjectScaleUtil.allowsScale(CANVAS_TYPE_INDEX, painting, {x: 3.5, y: 0.5, z: 1})).toBe(true);
    });
});

describe("a prop", () => {
    it("is its picture alone: no frame to compose, and no looks of its own", () => {
        expect(PropObjectTypeConfig.components.spawnedByAny).not.toHaveProperty("instancedMeshComposer");
        expect(PreEncodedCompositionIndexMap[PropObjectTypeConfig.objectType]).toBeUndefined();
    });

    // The two share one atlas and one mesh, which the cap sizes (see PictureGameObject).
    it("spends the same cap as a canvas", () => {
        expect(PropObjectTypeConfig.category).toBe(CanvasObjectTypeConfig.category);
    });

    it("is half a block across at the least, and a block's face at the most", () => {
        expect(ObjectScaleUtil.sanitize(PROP_TYPE_INDEX, {x: 0.1, y: 0.1, z: 1})).toEqual({x: 0.5, y: 0.5, z: 1});
        expect(ObjectScaleUtil.sanitize(PROP_TYPE_INDEX, {x: 3, y: 3, z: 1})).toEqual(
            {x: PICTURE_ATLAS_MAX_REGION_CELLS * PICTURE_ATLAS_CELL_WORLD_SIZE,
                y: PICTURE_ATLAS_MAX_REGION_CELLS * PICTURE_ATLAS_CELL_WORLD_SIZE, z: 1});
    });

    it("a change of image or turn carries the transform it needs through the wire, or none", () => {
        const transform = new ObjectTransform({x: 10.5, y: 2.25, z: 4}, {x: 0, y: 0, z: -1}, {x: 1, y: 0.5, z: 1});
        for (const sent of [undefined, transform])
        {
            const view = new Uint8Array(256);
            new SetObjectMetadataSignal(ROOM_ID, "c", ObjectMetadataKeyEnumMap.ImagePath, "2/7", sent)
                .encode(new BufferState(view));
            const decoded = SetObjectMetadataSignal.decode(new BufferState(view)) as SetObjectMetadataSignal;
            expect([decoded.roomID, decoded.objectId, decoded.metadataKey, decoded.metadataValue])
                .toEqual([ROOM_ID, "c", ObjectMetadataKeyEnumMap.ImagePath, "2/7"]);
            if (sent == undefined)
            {
                expect(decoded.transform).toBeUndefined();
                continue;
            }
            for (const field of ["pos", "dir"] as const)
                for (const axis of ["x", "y", "z"] as const)
                    expect(decoded.transform![field][axis]).toBeCloseTo(sent[field][axis], 3);
            expect(ObjectScaleUtil.sanitize(PROP_TYPE_INDEX, decoded.transform!.scale)).toEqual(sent.scale);
        }
    });

    // A disabled image keeps its callback for when it is enabled again.
    it("clicks in play mode only as types that exist, and a prop only on everyday objects the manifest lists", () => {
        const manifestPaths = readManifest().images.map(image => image.path);
        for (const [objectType, entry] of Object.entries(PlayModeClickCallbackMap))
        {
            expect(() => ObjectTypeConfigMap.getIndexByType(objectType), objectType).not.toThrow();
            if (objectType != PropObjectTypeConfig.objectType)
                continue;
            for (const imagePath of Object.keys(entry.callbacks))
            {
                expect(manifestPaths, imagePath).toContain(imagePath);
                expect(ImageMap.getSubfolderName(imagePath), imagePath).toBe(PROP_IMAGE_SUBFOLDER);
            }
        }
        expect(PlayModeClickCallbackMap).not.toHaveProperty(CanvasObjectTypeConfig.objectType);
    });
});

function objectOf(objectTypeIndex: number, metadata: {[key: number]: string} = {},
    sourceUserID: string = USER.id): AddObjectSignal
{
    const encodableMetadata: {[key: number]: EncodableByteString} = {};
    for (const key of Object.keys(metadata))
        encodableMetadata[Number(key)] = new EncodableByteString(metadata[Number(key)]);
    return new AddObjectSignal(ROOM_ID, sourceUserID, "User One", objectTypeIndex, "x",
        new ObjectTransform({x: 10.5, y: 2, z: 4.5}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}), encodableMetadata);
}

function readManifest(): {subfolders: ImageMapSubfolderTab[], images: {path: string, author: string, title: string,
    keywords?: string, preserveScale?: boolean, source?: string, license?: string, disabled?: boolean, staging?: boolean}[]}
{
    return JSON.parse(fs.readFileSync(path.join(PICTURES_DIR, "manifest.json"), "utf8"));
}

// The picture map's own part of the admin's settings.
function readSettings(): ImageMapSettings
{
    return JSON.parse(fs.readFileSync(path.join(ASSETS_DIR, ADMIN_ASSET_SETTINGS_FILE_NAME), "utf8"))
        [ImageMapSettingsUtil.getMapKey("PictureImageMap")];
}
