/**
 * Pictures: the images of the picture map, and the two types that show them. A canvas shows a painting (the Arts
 * subfolder), fitted to whatever size it is; a prop shows an everyday object (the Objects subfolder), with no frame,
 * pinned to the image's own size. Paths name their subfolder, so each type accepts only its own.
 * Covers: the map's tabs and which type each serves, a tab left out while all its images are disabled, everyday
 * objects at their own scale in whole cells, disabled images left out of the built map and staging ones marked in it
 * (offered only off the live server, tabs and all, and every one found by a search for "staging"), the categories built as the
 * manifest lists them and named by an image's leading keywords (marked, and only listed ones), a recipe and sample
 * for every image, the notices naming every third party's image that ships; what a search finds an image by (a
 * painting by its title and author, an everyday object by single-word keywords of its own, none inside another and
 * none a filler word) and the map shipping nothing else of either, the search itself (every word typed but filler
 * words, as typed or singular), the order images are offered in (alike ones together, leading keywords first,
 * categories aside) and the category tabs (an image under each category it names, Misc for none, opening on the
 * current image's first; All laid out category by category in a preset order, which names only the map's own
 * categories); which images a canvas and a prop accept (when set, and when added with one), what else a
 * user may write to a prop, a prop's lack of a frame, the size its image pins it to (and a canvas's freedom from
 * any), the metadata signal carrying that size, and the play-mode click map naming only props' images.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import PlayModeClickCallbackMap from "../../../src/client/object/maps/playModeClickCallbackMap";
import ImageChoiceUtil from "../../../src/client/ui/util/imageChoiceUtil";
import { IMAGE_ALL_TAB_CATEGORY_ORDER } from "../../../src/client/system/clientConstants";
import IMAGE_LICENSES from "../../../dev/scripts/imageMapEditor/core/imageLicenses";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import ImageMap from "../../../src/shared/graphics/image/types/imageMap";
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
import { PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_WORLD_SIZE, PICTURE_ATLAS_MAX_REGION_CELLS,
    PICTURE_SEARCH_FILLER_WORDS, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const ROOM_ID = "picture-room";
const USER = {id: "user-1"} as any;
const PICTURES_DIR = path.join(__dirname, "../../../public/app/assets/pictures");
const DISABLED_PICTURES_DIR = path.join(__dirname, "../../../dev/assets/disabled_pictures");
const CANVAS_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Canvas");
const PROP_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Prop");

describe("the picture map", () => {
    const imageMap = ImageMapUtil.getImageMap("PictureImageMap");

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

    it("builds each tab's categories as the manifest lists them", () => {
        const manifest = readManifest();
        for (const tab of manifest.subfolders.filter(tab => imageMap.getSubfolderNames().includes(tab.name)))
            expect(imageMap.getSubfolderCategories(tab.name), tab.name).toEqual(tab.categories ?? []);
    });

    // Disabled ones too, so each is ready to be enabled. A marked word naming no tab would silently leave the image out
    // of the tab it was meant for.
    it("names an image's categories by its leading keywords, marked, and only ones its tab lists", () => {
        const manifest = readManifest();
        for (const tab of manifest.subfolders)
        {
            const names = (tab.categories ?? []).map(category => category.name + ImageMap.CATEGORY_MARK);
            for (const image of manifest.images.filter(image => ImageMap.getSubfolderName(image.path) == tab.name))
            {
                const words = (image.keywords ?? "").split(",").map(word => word.trim());
                const marked = words.filter(word => word.endsWith(ImageMap.CATEGORY_MARK));
                expect(words.slice(0, marked.length), image.path).toEqual(marked);
                for (const word of marked)
                    expect(names, `${image.path}: ${word}`).toContain(word);
            }
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
            // Single words, none inside another (which a search would find anyway) and none a filler word (which a
            // search passes over).
            for (const word of words)
            {
                expect(word, image.path).toMatch(/^\S+$/);
                expect(PICTURE_SEARCH_FILLER_WORDS, `${image.path}: ${word}`).not.toContain(word);
                expect(words.filter(other => other != word && other.includes(word)), `${image.path}: ${word}`).toEqual([]);
            }
            if (built)
                expect(built.keywords, image.path).toBe(words.join(","));
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
        // One order, categories aside: the two plates sit together though only one is in the kitchen.
        const items = ImageChoiceUtil.getItems(map, "2", true);
        expect(items.map(item => item.path)).toEqual(["2/2", "2/1", "2/3", "2/4"]);

        // Bedroom holds none, as a keyword unmarked is only a word, so it offers no tab.
        expect(ImageChoiceUtil.getCategoryTabs(map, "2", items)).toEqual([ImageMap.ALL_TAB, "kitchen", "dining",
            ImageMap.MISC_TAB]);
        const inTab = (tab: string) => ImageChoiceUtil.getItemsInTab(map, "2", items, tab).map(item => item.path);
        expect(inTab("kitchen")).toEqual(["2/2", "2/1"]);
        expect(inTab("dining")).toEqual(["2/1", "2/3"]);
        expect(inTab(ImageMap.MISC_TAB)).toEqual(["2/4"]);
        expect(inTab(ImageMap.ALL_TAB).sort()).toEqual(["2/1", "2/2", "2/3", "2/4"]);
        // A subfolder listing no categories offers no tabs, and All is the one order.
        const paintings = ImageChoiceUtil.getItems(map, "1", true);
        expect(ImageChoiceUtil.getCategoryTabs(map, "1", paintings)).toEqual([]);
        expect(ImageChoiceUtil.getItemsInTab(map, "1", paintings, ImageMap.ALL_TAB)).toEqual(paintings);
    });

    it("lays All out category by category in a preset order, and leaves a category's own tab in the one order", () => {
        const images = [{path: "2/1", keywords: "living*,screen,television"}, {path: "2/2", keywords: "office*,screen,computer"},
            {path: "2/3", keywords: "accessory*,office*,calculator,math"}, {path: "2/4", keywords: "accessory*,shoe,slipper"},
            {path: "2/5", keywords: "sock,clothes"}, {path: "2/6", keywords: "office*,notebook,paper"},
            {path: "2/7", keywords: "living*,radio,music"}, {path: "2/8", keywords: "garden*,hose,water"},
            {path: "2/9", keywords: "living*,screen,projector"}];
        const map = new ImageMap("pictures", 0, {}, images, undefined, 0, [{name: "2", title: "Objects", categories: [
            {name: "living", title: "Living"}, {name: "office", title: "Office"}, {name: "accessory", title: "Accessory"},
            {name: "garden", title: "Garden"}]}]);
        const items = ImageChoiceUtil.getItems(map, "2", true);
        const inTab = (tab: string, order: string[]) =>
            ImageChoiceUtil.getItemsInTab(map, "2", items, tab, order).map(item => item.path);
        // Each run as its images would be ordered alone.
        const alone = (paths: string[]) => ImageChoiceUtil.getItems(new ImageMap("pictures", 0, {},
            images.filter(image => paths.includes(image.path))), "2", true).map(item => item.path);

        // A run per tab in the order given: an image under several goes with the last listed, one under none with
        // Misc, and those of a category left out come first.
        expect(inTab(ImageMap.ALL_TAB, ["living", "office", ImageMap.MISC_TAB, "accessory"])).toEqual([
            ["2/8"], ["2/1", "2/7", "2/9"], ["2/2", "2/6"], ["2/5"], ["2/3", "2/4"]].flatMap(alone));
        expect(inTab(ImageMap.ALL_TAB, ["accessory", "office", "living"])).toEqual([
            ["2/5", "2/8"], ["2/4"], ["2/2", "2/3", "2/6"], ["2/1", "2/7", "2/9"]].flatMap(alone));
        // No order given, it is the one order, in which the screens sit together whatever their places.
        expect(inTab(ImageMap.ALL_TAB, [])).toEqual(items.map(item => item.path));
        const screens = ["2/1", "2/2", "2/9"].map(path => items.findIndex(item => item.path == path)).sort((a, b) => a - b);
        expect(screens[2] - screens[0]).toBe(2);
        // Whatever the order, a category's own tab only narrows the one order.
        for (const order of [["living", "office", ImageMap.MISC_TAB, "accessory"], ["accessory", "office", "living"], []])
        {
            expect(inTab("office", order)).toEqual(items.map(item => item.path).filter(path =>
                ["2/2", "2/3", "2/6"].includes(path)));
        }
    });

    // A name that is none of them would silently order nothing.
    it("orders All by the picture map's own categories and Misc, each named once", () => {
        const names = [...readManifest().subfolders.flatMap(tab => (tab.categories ?? []).map(category => category.name)),
            ImageMap.MISC_TAB];
        expect(new Set(IMAGE_ALL_TAB_CATEGORY_ORDER).size).toBe(IMAGE_ALL_TAB_CATEGORY_ORDER.length);
        for (const name of IMAGE_ALL_TAB_CATEGORY_ORDER)
            expect(names, name).toContain(name);
    });

    it("orders images leaving their categories out, so a kind sits together whatever places it belongs in", () => {
        const order = (keywords: string[]) => ImageChoiceUtil.getItems(new ImageMap("pictures", 0, {},
            keywords.map((words, index) => ({path: `2/${index + 1}`, keywords: words}))), "2", true).map(item => item.path);
        // Two TVs in the living room and a computer's screen in the office, among others of those places.
        const screens = order(["living*,screen,television,tv", "office*,keyboard,computer,typing",
            "living*,radio,music,dial", "office*,screen,computer,monitor", "living*,screen,television,retro",
            "office*,notebook,paper,writing"]);
        const places = ["2/1", "2/4", "2/5"].map(path => screens.indexOf(path)).sort((a, b) => a - b);
        expect(places[2] - places[0]).toBe(2);
        // The same, with the places swapped round.
        expect(order(["office*,screen,television,tv", "living*,keyboard,computer,typing", "office*,radio,music,dial",
            "living*,screen,computer,monitor", "office*,screen,television,retro", "living*,notebook,paper,writing"]))
            .toEqual(screens);
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

    it("orders a subfolder so alike images sit together, whatever order the map lists them in", () => {
        const kitchen = ["oven,stove,kitchen,appliance", "toaster,oven,kitchen,appliance", "microwave,oven,kitchen,appliance"];
        const audio = ["loudspeaker,audio,music,speaker", "amplifier,audio,music", "radio,audio,music,vintage"];
        const books = ["book,library,shelf", "bookshelf,book,library", "notebook,paper,book"];
        const images = [...kitchen, ...audio, ...books].map((keywords, index) => ({path: `2/${index + 1}`, keywords}));
        const order = (listed: typeof images) =>
            ImageChoiceUtil.getItems(new ImageMap("pictures", 0, {}, listed), "2", true).map(item => item.keywords!);

        // Alphabetically, the three would interleave.
        const ordered = order(images);
        for (const group of [kitchen, audio, books])
        {
            const places = group.map(keywords => ordered.indexOf(keywords)).sort((a, b) => a - b);
            expect(places[places.length - 1] - places[0], group[0]).toBe(group.length - 1);
        }
        expect(order([...images].reverse())).toEqual(ordered);
    });

    it("sets images side by side by their leading keywords before the ones after", () => {
        const others = ["board,steak,meat,beef", "bowl,salad,lettuce,green", "tray,oyster,seafood,ice"];
        const platedPlaces = (plated: string[]) => {
            const images = [...plated, ...others].map((keywords, index) => ({path: `2/${index + 1}`, keywords}));
            const ordered = ImageChoiceUtil.getItems(new ImageMap("pictures", 0, {}, images), "2", true)
                .map(item => item.keywords!);
            return plated.map(keywords => ordered.indexOf(keywords)).sort((a, b) => a - b);
        };
        // Led by what they are as a whole, the plated dishes sit together; led by what's on them, each goes to its
        // twin on a board, in a bowl or on a tray.
        const led = platedPlaces(["plate,dish,steak,meat", "plate,dish,salad,lettuce", "plate,dish,oyster,seafood"]);
        expect(led[2] - led[0]).toBe(2);
        const trailed = platedPlaces(["steak,meat,plate,dish", "salad,lettuce,plate,dish", "oyster,seafood,plate,dish"]);
        expect(trailed[2] - trailed[0]).toBeGreaterThan(2);
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
