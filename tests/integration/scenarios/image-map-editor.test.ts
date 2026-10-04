/**
 * The image map editor's processing core (dev/scripts/imageMapEditor/core): sampling a quad of a source
 * (straightened, at its own shape, turned by a tilt of up to half a turn), a rectangle reshaped by the corners of
 * what it takes, tilted or not, the game image fitted into its cells with margins
 * (placed as aligned, smaller for a margin kept clear) or stretched to fill them, taking a background out (from the
 * border, following its shading, or clicked seeds, keeping the largest piece), erasing by hand (brush strokes and a
 * clicked color's patch), cutting to selections (rectangles, rounded or not, or ellipses, turned or not, together
 * with the rest and each other, or filling outside with a color; an inverted one taking out or filling what lies
 * inside it instead), reshaping one by hand (handles on its own turned axes and at its middle,
 * the side across held, a knob to turn it) and picking one of several by a click, color adjustments, the source library (photos kept once, dated by their first
 * adding, an index by name, none dropped while in use, nothing left of a deleted one, Unsplash links), a source
 * preprocessed into another beside it (cut out by a stand-in for the model, squared by corners placed on the source,
 * previewed, kept once, refused where it can't be made or its model would first be fetched), the paths new
 * entries take (never one used before), an entry with no recipe taken in as its own image, disabled entries (their
 * image parked where it doesn't ship, and out of the notices), the batch commands (sample orders made recipes, saved
 * as disabled entries, a keyword marked as a category refused and no tab's categories written, files of this
 * machine taken as sources and one's own pictures saved with no source or license, sources surveyed with a grid), and
 * the builder leaving out a tab whose images are all disabled, giving each tab the categories the admin's settings
 * list, and listing each subfolder's images in the order those settings give, each under the categories they file
 * it under.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import SourceLibrary from "../../../dev/scripts/imageMapEditor/node/sourceLibrary";
import EntryStore from "../../../dev/scripts/imageMapEditor/node/entryStore";
import RenderCommands from "../../../dev/scripts/imageMapEditor/node/renderCommands";
import EditorPaths from "../../../dev/scripts/imageMapEditor/node/editorPaths";
import SourceUrlUtil from "../../../dev/scripts/imageMapEditor/core/sourceUrlUtil";
import RgbaImage from "../../../dev/scripts/imageMapEditor/core/rgbaImage";
import ImageRecipe from "../../../dev/scripts/imageMapEditor/core/imageRecipe";
import RecipeBackground from "../../../dev/scripts/imageMapEditor/core/recipeBackground";
import ImageProcessingUtil from "../../../dev/scripts/imageMapEditor/core/imageProcessingUtil";
import AlphaMaskUtil from "../../../dev/scripts/imageMapEditor/core/alphaMaskUtil";
import LabColorUtil from "../../../dev/scripts/imageMapEditor/core/labColorUtil";
import { NO_ADJUST } from "../../../dev/scripts/imageMapEditor/core/colorAdjustUtil";
import SampleRenderUtil, { MAX_MARGIN } from "../../../dev/scripts/imageMapEditor/core/sampleRenderUtil";
import SelectionGeometryUtil from "../../../dev/scripts/imageMapEditor/core/selectionGeometryUtil";
import RecipeSelection from "../../../dev/scripts/imageMapEditor/core/recipeSelection";
import RecipeAlphaEdit from "../../../dev/scripts/imageMapEditor/core/recipeAlphaEdit";
import EntryPathUtil from "../../../dev/scripts/imageMapEditor/core/entryPathUtil";
import SampleOrderUtil from "../../../dev/scripts/imageMapEditor/core/sampleOrderUtil";
import BatchCommands from "../../../dev/scripts/imageMapEditor/node/batchCommands";
import SourcePreprocessor from "../../../dev/scripts/imageMapEditor/node/sourcePreprocessor";
import MissingToolsError from "../../../dev/scripts/imageMapEditor/node/missingToolsError";
import SourceEntry from "../../../dev/scripts/imageMapEditor/core/sourceEntry";
import SourcePrep from "../../../dev/scripts/imageMapEditor/core/sourcePrep";
import MaskFinder from "../../../dev/scripts/imagePrep/core/maskFinder";
import ImageMapBuilder from "../../../src/server/ssg/builder/imageMapBuilder";
import { ADMIN_ASSET_SETTINGS_FILE_NAME } from "../../../src/shared/system/sharedConstants";

// An opaque image painted by a function of each pixel's position.
function paint(width: number, height: number, color: (x: number, y: number) => [number, number, number]): RgbaImage
{
    const image = ImageProcessingUtil.createImage(width, height);
    for (let y = 0; y < height; ++y)
    {
        for (let x = 0; x < width; ++x)
        {
            const [r, g, b] = color(x, y);
            image.data.set([r, g, b, 255], (y * width + x) * 4);
        }
    }
    return image;
}

function pixel(image: RgbaImage, x: number, y: number): number[]
{
    const index = (y * image.width + x) * 4;
    return Array.from(image.data.subarray(index, index + 4));
}

function recipe(overrides: Partial<ImageRecipe>): ImageRecipe
{
    return {sourceSha1: "", sourceFileName: "", corners: [[0, 0], [1, 0], [1, 1], [0, 1]], retouches: [],
        output: {preserveScale: false, longSide: 64}, ...overrides};
}

describe("sampling a source", () => {
    // Four quadrants of distinct colors.
    const quadrants = paint(100, 100, (x, y) => (x < 50) ? ((y < 50) ? [255, 0, 0] : [0, 0, 255])
        : ((y < 50) ? [0, 255, 0] : [255, 255, 0]));

    it("takes the quad's corners to the sample's, however the quad is turned", () => {
        // The quad's top-left corner in the source's bottom-right quadrant, so the sample is the source turned
        // half a turn.
        const sample = SampleRenderUtil.renderSample(quadrants,
            recipe({corners: [[1, 1], [0, 1], [0, 0], [1, 0]]}), 20);
        expect(pixel(sample, 2, 2)).toEqual([255, 255, 0, 255]);
        expect(pixel(sample, 17, 2)).toEqual([0, 0, 255, 255]);
        expect(pixel(sample, 17, 17)).toEqual([255, 0, 0, 255]);
        expect(pixel(sample, 2, 17)).toEqual([0, 255, 0, 255]);
    });

    it("keeps the quad's own shape, whatever the size it is shown at", () => {
        const corners: [number, number][] = [[0, 0], [1, 0], [1, 0.5], [0, 0.5]];
        expect(SampleRenderUtil.getSampleSize(100, 100, recipe({corners}))).toEqual({width: 100, height: 50});
        expect(SampleRenderUtil.getSampleSize(100, 100, recipe({corners,
            output: {preserveScale: true, numCols: 2, numRows: 2}}))).toEqual({width: 100, height: 50});
        expect(SampleRenderUtil.getSampleSize(100, 100, recipe({corners}), 40)).toEqual({width: 40, height: 20});
    });

    it("turns a tilted picture clockwise within the quad", () => {
        const sample = SampleRenderUtil.renderSample(quadrants, recipe({rotation: 90}), 20);
        // The picture's left edge is now its top.
        expect(pixel(sample, 2, 2)).toEqual([0, 0, 255, 255]);
        expect(pixel(sample, 17, 2)).toEqual([255, 0, 0, 255]);
        expect(pixel(sample, 17, 17)).toEqual([0, 255, 0, 255]);
        expect(pixel(sample, 2, 17)).toEqual([255, 255, 0, 255]);
    });

    it("carries the source's edge on where a turned picture's corner reaches past it", () => {
        const edged = paint(100, 100, (x) => (x < 10) ? [255, 0, 255] : [128, 128, 128]);
        const sample = SampleRenderUtil.renderSample(edged, recipe({rotation: 45}), 40);
        expect(pixel(sample, 0, 0)).toEqual([255, 0, 255, 255]);
        // Its outline on the source reaches past the source's left edge.
        const outline = SampleRenderUtil.getSampledOutline(100, 100, recipe({rotation: 45}));
        expect(Math.min(...outline.map(([u]) => u))).toBeLessThan(0);
        expect(SampleRenderUtil.getSampledOutline(100, 100, recipe({}))).toEqual(recipe({}).corners);
    });

    it("turns it as far as half a turn, either way, which stands the picture on its head", () => {
        for (const rotation of [180, -180])
        {
            const sample = SampleRenderUtil.renderSample(quadrants, recipe({rotation}), 20);
            expect(pixel(sample, 2, 2)).toEqual([255, 255, 0, 255]);
            expect(pixel(sample, 17, 2)).toEqual([0, 0, 255, 255]);
            expect(pixel(sample, 17, 17)).toEqual([255, 0, 0, 255]);
            expect(pixel(sample, 2, 17)).toEqual([0, 255, 0, 255]);
        }
    });

    it("takes, tilted, the quad's own rectangle turned the other way about its middle, measured in the source's pixels", () => {
        // 60 px by 20 px about the middle of a source twice as wide as it is tall, turned a quarter: the sample
        // keeps that shape, and takes the 20 px by 60 px there, its top-left corner from the bottom-left.
        const turned = recipe({corners: [[0.35, 0.4], [0.65, 0.4], [0.65, 0.6], [0.35, 0.6]], rotation: 90});
        expect(SampleRenderUtil.getSampleSize(200, 100, turned)).toEqual({width: 60, height: 20});
        const outline = SampleRenderUtil.getSampledOutline(200, 100, turned);
        [[0.45, 0.8], [0.45, 0.2], [0.55, 0.2], [0.55, 0.8]].forEach(([u, v], i) => {
            expect(outline[i][0]).toBeCloseTo(u, 9);
            expect(outline[i][1]).toBeCloseTo(v, 9);
        });
    });
});

describe("reshaping a sampled rectangle by hand", () => {
    // Twice as wide as it is tall, so a turn measured in anything but pixels would show.
    const WIDTH = 400, HEIGHT = 200;
    const outlineOf = (shaped: ImageRecipe) => SampleRenderUtil.getSampledOutline(WIDTH, HEIGHT, shaped);
    const drag = (shaped: ImageRecipe, index: number, point: [number, number]): ImageRecipe =>
        ({...shaped, corners: SampleRenderUtil.moveOutlineCorner(WIDTH, HEIGHT, shaped, index, point)});
    const expectCorners = (corners: [number, number][], expected: number[][]) => expected.forEach(([u, v], i) => {
        expect(corners[i][0]).toBeCloseTo(u, 9);
        expect(corners[i][1]).toBeCloseTo(v, 9);
    });

    it("takes a dragged corner to the pointer and the two beside it along, holding the one across", () => {
        const untilted = recipe({corners: [[0.2, 0.2], [0.6, 0.2], [0.6, 0.7], [0.2, 0.7]]});
        expectCorners(drag(untilted, 0, [0.1, 0.3]).corners, [[0.1, 0.3], [0.6, 0.3], [0.6, 0.7], [0.1, 0.7]]);
        expectCorners(drag(untilted, 2, [0.9, 0.5]).corners, [[0.2, 0.2], [0.9, 0.2], [0.9, 0.5], [0.2, 0.5]]);
    });

    it("shapes a tilted one by the corners of what it takes, along its own turned sides", () => {
        // 100 px by 60 px about (200, 100), turned a quarter: it takes 60 px by 100 px, the sample's top-right corner
        // from that area's top-left. Dragged up and left, the area grows to 80 px by 120 px, its bottom-right held.
        const turned = recipe({corners: [[0.375, 0.35], [0.625, 0.35], [0.625, 0.65], [0.375, 0.65]], rotation: 90});
        expectCorners(outlineOf(turned), [[0.425, 0.75], [0.425, 0.25], [0.575, 0.25], [0.575, 0.75]]);
        const reshaped = drag(turned, 1, [0.375, 0.15]);
        expectCorners(outlineOf(reshaped), [[0.375, 0.75], [0.375, 0.15], [0.575, 0.15], [0.575, 0.75]]);
        // The quad itself is the sample's shape, 120 px by 80 px, about the area's new middle.
        expectCorners(reshaped.corners, [[0.325, 0.25], [0.625, 0.25], [0.625, 0.65], [0.325, 0.65]]);
        expect(SampleRenderUtil.getSampleSize(WIDTH, HEIGHT, reshaped)).toEqual({width: 120, height: 80});
    });

    it("stops a corner a pixel short of the sides across from it, rather than turn the rectangle inside out", () => {
        const turned = recipe({corners: [[0.375, 0.35], [0.625, 0.35], [0.625, 0.65], [0.375, 0.65]], rotation: 90});
        const collapsed = drag(turned, 1, [0.9, 0.95]);
        expect(SampleRenderUtil.getSampleSize(WIDTH, HEIGHT, collapsed)).toEqual({width: 1, height: 1});
        expectCorners([outlineOf(collapsed)[3]], [outlineOf(turned)[3]]);
    });

    it("keeps to that whatever the tilt, the corner and the way round the rectangle lies", () => {
        const fraction = fc.double({min: 0, max: 1, noNaN: true});
        fc.assert(fc.property(fc.double({min: -180, max: 180, noNaN: true}), fc.nat(3), fraction, fraction,
            fc.boolean(), fc.boolean(), (rotation, index, x, y, mirrored, upsideDown) => {
            const [left, right] = mirrored ? [0.7, 0.3] : [0.3, 0.7];
            const [top, bottom] = upsideDown ? [0.8, 0.4] : [0.4, 0.8];
            const before = recipe({corners: [[left, top], [right, top], [right, bottom], [left, bottom]], rotation});
            const after = drag(before, index, [x, y]);

            // Still a rectangle along the source's axes, lying the same way round.
            const [c0, c1, c2, c3] = after.corners;
            expectCorners([[c1[0], c1[1]], [c3[0], c3[1]]], [[c2[0], c0[1]], [c0[0], c2[1]]]);
            expect(c1[0] < c0[0]).toBe(mirrored);
            expect(c3[1] < c0[1]).toBe(upsideDown);
            const across = (index + 2) % 4;
            expectCorners([outlineOf(after)[across]], [outlineOf(before)[across]]);
            // At the pointer, unless that lies past a side across from it.
            const stopped = Math.abs(c1[0] - c0[0]) * WIDTH < 1 + 1e-6 || Math.abs(c3[1] - c0[1]) * HEIGHT < 1 + 1e-6;
            if (!stopped)
                expectCorners([outlineOf(after)[index]], [[x, y]]);
        }));
    });
});

describe("the game image made from a sample", () => {
    const keepingScale = {preserveScale: true as const, numCols: 2, numRows: 2};

    it("fits the whole sample in its cells, centred, keeping its shape", () => {
        expect(SampleRenderUtil.getGameImageLayout(keepingScale, 200, 100, 64))
            .toEqual({width: 128, height: 128, content: {x: 0, y: 32, width: 128, height: 64}});
        expect(SampleRenderUtil.getGameImageLayout(keepingScale, 50, 100, 64))
            .toEqual({width: 128, height: 128, content: {x: 32, y: 0, width: 64, height: 128}});
        expect(SampleRenderUtil.getGameImageLayout({preserveScale: false, longSide: 64}, 200, 100, 64))
            .toEqual({width: 64, height: 32, content: {x: 0, y: 0, width: 64, height: 32}});
    });

    it("places the sample where it is aligned in the room left beside it, and smaller for a margin kept clear", () => {
        // Against the top or the bottom, or anywhere between.
        expect(SampleRenderUtil.getGameImageLayout({...keepingScale, align: [0.5, 0]}, 200, 100, 64).content)
            .toEqual({x: 0, y: 0, width: 128, height: 64});
        expect(SampleRenderUtil.getGameImageLayout({...keepingScale, align: [0.5, 1]}, 200, 100, 64).content)
            .toEqual({x: 0, y: 64, width: 128, height: 64});
        expect(SampleRenderUtil.getGameImageLayout({...keepingScale, align: [0, 0.25]}, 200, 100, 64).content)
            .toEqual({x: 0, y: 16, width: 128, height: 64});
        // Half the width kept clear makes a square sample half as big, placed in what is left either way.
        expect(SampleRenderUtil.getGameImageLayout({...keepingScale, margin: [0.5, 0]}, 100, 100, 64).content)
            .toEqual({x: 32, y: 32, width: 64, height: 64});
        expect(SampleRenderUtil.getGameImageLayout({...keepingScale, margin: [0.5, 0], align: [1, 0]}, 100, 100, 64).content)
            .toEqual({x: 64, y: 0, width: 64, height: 64});
        expect(SampleRenderUtil.getGameImageLayout({...keepingScale, margin: [0.25, 0.5]}, 100, 100, 64).content)
            .toEqual({x: 32, y: 32, width: 64, height: 64});
        // Never so much margin that nothing is left of it, nor placed past its cells.
        const extreme = SampleRenderUtil.getGameImageLayout({...keepingScale, margin: [5, 5], align: [3, -1]}, 100, 100, 64);
        expect(extreme.content.width).toBeGreaterThanOrEqual(Math.round(128 * (1 - MAX_MARGIN)));
        expect(extreme.content.x + extreme.content.width).toBe(128);
        expect(extreme.content.y).toBe(0);
    });

    it("stretches the sample to fill its cells on asking, whatever its shape, or what a margin leaves of them", () => {
        const stretched = {...keepingScale, stretch: true};
        expect(SampleRenderUtil.getGameImageLayout(stretched, 200, 100, 64).content)
            .toEqual({x: 0, y: 0, width: 128, height: 128});
        expect(SampleRenderUtil.getGameImageLayout(stretched, 50, 100, 64).content)
            .toEqual({x: 0, y: 0, width: 128, height: 128});
        // Each way by its own margin, and placed in the room that leaves.
        expect(SampleRenderUtil.getGameImageLayout({...stretched, margin: [0.5, 0.25], align: [1, 0]}, 200, 100, 64).content)
            .toEqual({x: 64, y: 0, width: 64, height: 96});

        // Red above blue, twice as wide as tall: each half reaches its edge of the cells, with no margin between.
        const halves = paint(200, 100, (_, y) => (y < 50) ? [200, 0, 0] : [0, 0, 200]);
        const gameImage = SampleRenderUtil.renderGameImage(halves, recipe({output: stretched}), 64);
        expect([gameImage.width, gameImage.height]).toEqual([128, 128]);
        expect([pixel(gameImage, 64, 2), pixel(gameImage, 64, 125)]).toEqual([[200, 0, 0, 255], [0, 0, 200, 255]]);
        // Fitted, the same rows are margin, in the color of the sample's edges.
        const fitted = SampleRenderUtil.renderGameImage(halves, recipe({output: keepingScale}), 64);
        expect(pixel(fitted, 64, 2)).toEqual(pixel(fitted, 64, 125));
    });

    it("fills the margins with the sample's edge color, or leaves them see-through if any of it is", () => {
        // A dark red band round a blue middle: the band's color is what the margins take.
        const opaque = paint(200, 100, (x, y) => (x < 4 || x >= 196 || y < 4 || y >= 96) ? [100, 0, 0] : [0, 0, 100]);
        const gameImage = SampleRenderUtil.renderGameImage(opaque, recipe({output: keepingScale}), 64);
        expect([gameImage.width, gameImage.height]).toEqual([128, 128]);
        expect(pixel(gameImage, 64, 5)).toEqual([100, 0, 0, 255]);
        expect(pixel(gameImage, 64, 64)).toEqual([0, 0, 100, 255]);

        const seeThrough = ImageProcessingUtil.copyImage(opaque);
        seeThrough.data[3] = 0;
        const cutOut = SampleRenderUtil.renderGameImage(seeThrough, recipe({output: keepingScale}), 64);
        expect(pixel(cutOut, 64, 5)[3]).toBe(0);
        expect(pixel(cutOut, 64, 64)[3]).toBe(255);
    });
});

describe("taking the background out", () => {
    // A gray backdrop, with a big dark square and a small dark speck on it.
    const scene = paint(60, 60, (x, y) => {
        const inSquare = x >= 20 && x < 40 && y >= 20 && y < 40;
        const inSpeck = x >= 5 && x < 8 && y >= 5 && y < 8;
        return (inSquare || inSpeck) ? [30, 30, 30] : [200, 200, 200];
    });
    const findBackground = (image: RgbaImage, background: RecipeBackground) =>
        AlphaMaskUtil.findBackground(image, LabColorUtil.toLab(image), background);

    it("fills from the border and keeps only the largest piece left", () => {
        const background = findBackground(scene, {fromBorder: true, seeds: [], tolerance: 10, keepLargest: true});
        expect(background[30 * 60 + 30]).toBe(0); // the square
        expect(background[6 * 60 + 6]).toBe(1); // the speck, dropped
        expect(background[0]).toBe(1);
    });

    it("fills from a clicked seed against that seed's color", () => {
        const background = findBackground(scene, {fromBorder: false, seeds: [[0.5, 0.5]], tolerance: 10, keepLargest: false});
        expect(background[30 * 60 + 30]).toBe(1); // the square it was clicked in
        expect(background[6 * 60 + 6]).toBe(0); // the speck, not connected to it
        expect(background[0]).toBe(0);
    });

    it("follows a backdrop shaded from dark to light, and stops at the object on it", () => {
        const shaded = paint(120, 60, (x, y) => (x >= 50 && x < 70 && y >= 20 && y < 40)
            ? [200, 30, 30] : [60 + x, 60 + x, 60 + x]);
        const background = findBackground(shaded, {fromBorder: true, seeds: [], tolerance: 6, step: 3, keepLargest: false});
        expect(background[5 * 120 + 2]).toBe(1); // the dark end
        expect(background[55 * 120 + 117]).toBe(1); // the light end
        expect(background[30 * 120 + 60]).toBe(0); // the object
    });

    it("doesn't take an object touching the edge for the border around it", () => {
        const touching = paint(120, 60, (x, y) => (x >= 55 && x < 65 && y >= 30) ? [30, 30, 30] : [200, 200, 200]);
        const background = findBackground(touching, {fromBorder: true, seeds: [], tolerance: 10, keepLargest: false});
        expect(background[59 * 120 + 60]).toBe(0); // where it meets the edge
        expect(background[40 * 120 + 60]).toBe(0);
        expect(background[10 * 120 + 10]).toBe(1);
    });

    it("cuts out with hard edges, to the selection's shape too", () => {
        const sample = SampleRenderUtil.renderSample(scene, recipe({selections: [{shape: "ellipse", rect: [0, 0, 1, 1], radius: 0}]}), 60);
        expect(pixel(sample, 30, 30)[3]).toBe(255);
        expect(pixel(sample, 0, 0)[3]).toBe(0);
        expect(new Set(Array.from(sample.data.filter((_, i) => i % 4 == 3)))).toEqual(new Set([0, 255]));
    });
});

describe("cutting a sample to a selection", () => {
    // Gray, with a dark square in the middle (20..40 of 60).
    const scene = paint(60, 60, (x, y) => (x >= 20 && x < 40 && y >= 20 && y < 40) ? [30, 30, 30] : [200, 200, 200]);
    const alpha = (image: RgbaImage, x: number, y: number) => pixel(image, x, y)[3];

    it("takes out what lies outside a rectangle or an ellipse anywhere in the sample, with rounded corners on asking", () => {
        const rect = SampleRenderUtil.renderSample(scene, recipe({selections: [{shape: "rect", rect: [0.25, 0.25, 0.5, 0.5], radius: 0}]}), 60);
        expect([alpha(rect, 16, 16), alpha(rect, 44, 44), alpha(rect, 5, 30)]).toEqual([255, 255, 0]);

        const rounded = SampleRenderUtil.renderSample(scene, recipe({selections: [{shape: "rect", rect: [0.25, 0.25, 0.5, 0.5], radius: 0.5}]}), 60);
        expect([alpha(rounded, 16, 16), alpha(rounded, 30, 16), alpha(rounded, 30, 30)]).toEqual([0, 255, 255]);

        const ellipse = SampleRenderUtil.renderSample(scene, recipe({selections: [{shape: "ellipse", rect: [0, 0.25, 1, 0.5], radius: 0}]}), 60);
        expect([alpha(ellipse, 30, 16), alpha(ellipse, 2, 30), alpha(ellipse, 30, 10), alpha(ellipse, 2, 16)])
            .toEqual([255, 255, 0, 0]);
    });

    it("adds to what the background fill takes out, and a brush can't bring back what lies outside it", () => {
        const background: RecipeBackground = {fromBorder: true, seeds: [], tolerance: 10, keepLargest: false};
        const both = SampleRenderUtil.renderSample(scene, recipe({background,
            selections: [{shape: "rect", rect: [0, 0, 0.5, 1], radius: 0}]}), 60);
        // The square's left half is kept; its right half is outside the selection, and the gray was filled out.
        expect([alpha(both, 25, 30), alpha(both, 35, 30), alpha(both, 5, 30)]).toEqual([255, 0, 0]);

        const restored = SampleRenderUtil.renderSample(scene, recipe({background,
            selections: [{shape: "rect", rect: [0, 0, 0.5, 1], radius: 0}],
            alphaEdits: [{kind: "restore", radius: 0.1, points: [[0.1, 0.5], [0.9, 0.5]]}]}), 60);
        expect([alpha(restored, 5, 30), alpha(restored, 55, 30)]).toEqual([255, 0]);
    });

    it("fills what lies outside with a color instead, opaque and as chosen, whatever else was taken out there", () => {
        const background: RecipeBackground = {fromBorder: true, seeds: [], tolerance: 10, keepLargest: false};
        const filled = SampleRenderUtil.renderSample(scene, recipe({background, adjust: {...NO_ADJUST, brightness: 60},
            selections: [{shape: "rect", rect: [0.25, 0.25, 0.5, 0.5], radius: 0, fill: "#1080f0"}]}), 60);
        expect(pixel(filled, 5, 5)).toEqual([16, 128, 240, 255]);
        expect(alpha(filled, 30, 30)).toBe(255);
        // Inside, the fill's cut still applies: the gray ring round the square went.
        expect(alpha(filled, 17, 17)).toBe(0);
        expect(AlphaMaskUtil.getKeepMask(scene, recipe({selections: [{shape: "rect", rect: [0, 0, 0.5, 1], radius: 0, fill: "#000000"}]})))
            .toBeUndefined();
    });

    it("turns a selection clockwise about its middle, measured in the sample's pixels", () => {
        const square: RecipeSelection = {shape: "rect", rect: [0.25, 0.25, 0.5, 0.5], radius: 0};
        const diamond = SampleRenderUtil.renderSample(scene, recipe({selections: [{...square, angle: 45}]}), 60);
        // Above the square's top edge is kept now, and its corner isn't.
        expect([alpha(diamond, 30, 10), alpha(diamond, 16, 16), alpha(diamond, 30, 30)]).toEqual([255, 0, 255]);

        // In pixels, so on a sample twice as wide as it is tall a circle turned a quarter is the same circle, and
        // a wide bar turned a quarter clockwise stands upright.
        const wide = paint(120, 60, () => [90, 90, 90]);
        const keep = (selection: RecipeSelection) => Array.from(AlphaMaskUtil.getKeepMask(wide, recipe({selections: [selection]}))!);
        const circle: RecipeSelection = {shape: "ellipse", rect: [0.25, 0, 0.5, 1], radius: 0};
        expect(keep({...circle, angle: 90})).toEqual(keep(circle));
        const upright = keep({shape: "rect", rect: [0.25, 0.4, 0.5, 0.2], radius: 0, angle: 90});
        expect([upright[30 * 120 + 40], upright[5 * 120 + 60], upright[55 * 120 + 60]]).toEqual([0, 1, 1]);
    });

    it("takes out what lies outside any see-through selection, so a square and the same square turned by 45° make an octagon", () => {
        const square: RecipeSelection = {shape: "rect", rect: [0.25, 0.25, 0.5, 0.5], radius: 0};
        const octagon = SampleRenderUtil.renderSample(scene, recipe({selections: [square, {...square, angle: 45}]}), 60);
        // Outside the square, outside the turned one at two of the square's corners, and inside both.
        expect([alpha(octagon, 30, 10), alpha(octagon, 16, 16), alpha(octagon, 43, 43), alpha(octagon, 30, 17),
            alpha(octagon, 40, 40)]).toEqual([0, 0, 0, 255, 255]);
    });

    it("fills with the latest filling selection's color where several reach, but never where a see-through one takes out", () => {
        const outer: RecipeSelection = {shape: "rect", rect: [0.1, 0.1, 0.8, 0.8], radius: 0, fill: "#ff0000"};
        const inner: RecipeSelection = {shape: "rect", rect: [0.25, 0.25, 0.5, 0.5], radius: 0, fill: "#0000ff"};
        const filled = SampleRenderUtil.renderSample(scene, recipe({selections: [outer, inner]}), 60);
        expect(pixel(filled, 2, 2)).toEqual([0, 0, 255, 255]);
        expect(pixel(filled, 10, 10)).toEqual([0, 0, 255, 255]);
        expect(pixel(filled, 30, 30)).toEqual([30, 30, 30, 255]);

        const cut = SampleRenderUtil.renderSample(scene, recipe({selections: [{...outer, fill: undefined}, inner]}), 60);
        expect(alpha(cut, 2, 2)).toBe(0);
        expect(pixel(cut, 10, 10)).toEqual([0, 0, 255, 255]);
    });

    it("takes out what lies inside an inverted selection instead, a hole in what the others keep, or fills it", () => {
        const hole: RecipeSelection = {shape: "rect", rect: [0.25, 0.25, 0.5, 0.5], radius: 0, inverted: true};
        const holed = SampleRenderUtil.renderSample(scene, recipe({selections: [hole]}), 60);
        // Its middle, just inside its corner, just outside its side, and the sample's corner.
        expect([alpha(holed, 30, 30), alpha(holed, 16, 16), alpha(holed, 14, 30), alpha(holed, 2, 2)])
            .toEqual([0, 0, 255, 255]);

        // With an ordinary one, what that keeps less the hole: a ring.
        const ring = SampleRenderUtil.renderSample(scene, recipe({selections: [
            {shape: "ellipse", rect: [0, 0, 1, 1], radius: 0},
            {shape: "ellipse", rect: [0.25, 0.25, 0.5, 0.5], radius: 0, inverted: true}]}), 60);
        expect([alpha(ring, 30, 30), alpha(ring, 30, 5), alpha(ring, 1, 1)]).toEqual([0, 255, 0]);

        // Filled, it is a patch of the color over what was there, the rest as it was; and nothing is taken out.
        const filling: RecipeSelection = {...hole, fill: "#1080f0"};
        const patched = SampleRenderUtil.renderSample(scene, recipe({selections: [filling]}), 60);
        expect([pixel(patched, 30, 30), pixel(patched, 5, 5)]).toEqual([[16, 128, 240, 255], [200, 200, 200, 255]]);
        expect(AlphaMaskUtil.getKeepMask(scene, recipe({selections: [filling]}))).toBeUndefined();
    });
});

describe("reshaping a selection by hand", () => {
    // On a sample 200 by 100 pixels: 80 by 40 of them, its middle at 100, 50.
    const width = 200, height = 100;
    const box: RecipeSelection = {shape: "rect", rect: [0.3, 0.3, 0.4, 0.4], radius: 0};
    // Its middle and size, in pixels.
    const frameOf = (selection: RecipeSelection) => {
        const frame = SelectionGeometryUtil.getFrame(selection, width, height);
        return [frame.cx, frame.cy, 2 * frame.halfWidth, 2 * frame.halfHeight].map(value => +value.toFixed(6));
    };
    const handleAt = (selection: RecipeSelection, handle: string) => SelectionGeometryUtil.getHandles(selection,
        width, height, 10).find(other => other.handle == handle)!.point.map(value => +value.toFixed(6));

    it("puts its handles on its own sides and corners, the knob above its top and the one to move it by at its middle, all turned with it", () => {
        expect(handleAt(box, "n")).toEqual([100, 30]);
        expect(handleAt(box, "se")).toEqual([140, 70]);
        expect(handleAt(box, "turn")).toEqual([100, 20]);
        expect(handleAt(box, "move")).toEqual([100, 50]);
        // Turned a quarter clockwise, its top faces right.
        expect(handleAt({...box, angle: 90}, "n")).toEqual([120, 50]);
        expect(handleAt({...box, angle: 90}, "turn")).toEqual([130, 50]);
        expect(handleAt({...box, angle: 90}, "move")).toEqual([100, 50]);
        // Where above its top would be off the sample, the knob stands below it instead, still toward its up.
        const whole: RecipeSelection = {shape: "rect", rect: [0, 0, 1, 1], radius: 0};
        expect(handleAt(whole, "turn")).toEqual([100, 10]);
    });

    it("resizes from a side or a corner, holding the one across from it", () => {
        expect(frameOf(SelectionGeometryUtil.resize(box, "e", [160, 50], width, height, false))).toEqual([110, 50, 100, 40]);
        expect(frameOf(SelectionGeometryUtil.resize(box, "nw", [40, 20], width, height, false))).toEqual([90, 45, 100, 50]);
        // Kept in shape by the larger of the two stretches.
        expect(frameOf(SelectionGeometryUtil.resize(box, "se", [180, 75], width, height, true))).toEqual([120, 60, 120, 60]);
        // Never to nothing, even dragged past the side held.
        expect(frameOf(SelectionGeometryUtil.resize(box, "e", [0, 50], width, height, false))[2]).toBeGreaterThan(0);
    });

    it("resizes a turned selection along its own axes, keeping its turn", () => {
        // Turned a quarter clockwise, its own right side faces down: dragged 20 further down, it is 20 longer.
        const grown = SelectionGeometryUtil.resize({...box, angle: 90}, "e", [100, 110], width, height, false);
        expect(frameOf(grown)).toEqual([100, 60, 100, 40]);
        expect(grown.angle).toBe(90);
    });

    it("turns so its knob points at the pointer (in steps, on asking), and moves keeping its middle in the sample", () => {
        expect(SelectionGeometryUtil.turnToward(box, [180, 50], width, height, false).angle).toBeCloseTo(90, 6);
        expect(SelectionGeometryUtil.turnToward(box, [100, 0], width, height, false).angle).toBeUndefined();
        expect(SelectionGeometryUtil.turnToward(box, [150, 45], width, height, true).angle).toBe(90);
        expect(SelectionGeometryUtil.move(box, 0.5, -0.1).rect.map(value => +value.toFixed(6))).toEqual([0.8, 0.2, 0.4, 0.4]);
    });

    it("picks by a click the topmost selection under it, the next one down on clicking again, and none where none is", () => {
        // The whole sample, the box within it, and an ellipse over the box's right half and beyond.
        const whole: RecipeSelection = {shape: "rect", rect: [0, 0, 1, 1], radius: 0};
        const ellipse: RecipeSelection = {shape: "ellipse", rect: [0.5, 0.3, 0.4, 0.4], radius: 0};
        const pick = (selections: RecipeSelection[], point: [number, number], picked?: number) =>
            SelectionGeometryUtil.pickAt(selections, point, width, height, picked);
        // Where all three overlap, the latest first, then down through them and round again.
        expect(pick([whole, box, ellipse], [120, 50])).toBe(2);
        expect(pick([whole, box, ellipse], [120, 50], 2)).toBe(1);
        expect(pick([whole, box, ellipse], [120, 50], 1)).toBe(0);
        expect(pick([whole, box, ellipse], [120, 50], 0)).toBe(2);
        // Where the one picked isn't, the topmost that is; where only it is, it stays picked.
        expect(pick([whole, box, ellipse], [70, 50], 2)).toBe(1);
        expect(pick([whole, box, ellipse], [10, 10], 1)).toBe(0);
        expect(pick([whole, box, ellipse], [10, 10], 0)).toBe(0);
        // Just outside the ellipse's curve, though inside its bounds.
        expect(pick([box, ellipse], [175, 32], 1)).toBeUndefined();
        expect(pick([box, ellipse], [10, 10], 0)).toBeUndefined();
        expect(pick([], [10, 10])).toBeUndefined();
    });
});

describe("taking parts out by hand", () => {
    const plain = paint(100, 50, () => [90, 140, 60]);

    it("erases along a brush stroke, and a later stroke brings some of it back", () => {
        const erased = SampleRenderUtil.renderSample(plain, recipe({alphaEdits: [
            {kind: "erase", radius: 0.1, points: [[0.2, 0.5], [0.8, 0.5]]}]}), 100);
        expect(pixel(erased, 50, 25)[3]).toBe(0);
        expect(pixel(erased, 22, 25)[3]).toBe(0);
        expect(pixel(erased, 50, 2)[3]).toBe(255);

        const restored = SampleRenderUtil.renderSample(plain, recipe({alphaEdits: [
            {kind: "erase", radius: 0.1, points: [[0.2, 0.5], [0.8, 0.5]]},
            {kind: "restore", radius: 0.05, points: [[0.5, 0.5]]}]}), 100);
        expect(pixel(restored, 50, 25)[3]).toBe(255);
        expect(pixel(restored, 30, 25)[3]).toBe(0);
    });

    it("erases the patch of a clicked color as far as it reaches, and leaves the same color apart from it", () => {
        const dotted = paint(100, 50, (x, y) => ((x < 20 || x >= 80) && y < 10) ? [220, 20, 20] : [20, 120, 220]);
        const erased = SampleRenderUtil.renderSample(dotted, recipe({alphaEdits: [
            {kind: "eraseColor", point: [0.05, 0.05], tolerance: 5}]}), 100);
        expect(pixel(erased, 5, 5)[3]).toBe(0);
        expect(pixel(erased, 19, 9)[3]).toBe(0);
        expect(pixel(erased, 90, 5)[3]).toBe(255);
        expect(pixel(erased, 50, 5)[3]).toBe(255);
    });

    it("stops a clicked color's patch at what is already taken out, and takes nothing from a click there", () => {
        // A stroke down the middle parts the sample in two.
        const stroke: RecipeAlphaEdit = {kind: "erase", radius: 0.1, points: [[0.5, 0], [0.5, 1]]};
        const parted = SampleRenderUtil.renderSample(plain, recipe({alphaEdits: [
            stroke, {kind: "eraseColor", point: [0.1, 0.5], tolerance: 5}]}), 100);
        expect(pixel(parted, 10, 25)[3]).toBe(0);
        expect(pixel(parted, 40, 49)[3]).toBe(0);
        expect(pixel(parted, 90, 25)[3]).toBe(255);

        const clickedOut = SampleRenderUtil.renderSample(plain, recipe({alphaEdits: [
            stroke, {kind: "eraseColor", point: [0.5, 0.5], tolerance: 5}]}), 100);
        expect(pixel(clickedOut, 10, 25)[3]).toBe(255);
        expect(pixel(clickedOut, 90, 25)[3]).toBe(255);
    });
});

describe("adjusting a sample's colors", () => {
    const colorful = paint(40, 20, (x, y) => [x * 6, y * 12, 255 - x * 6]);

    it("changes nothing at zero", () => {
        const plain = SampleRenderUtil.renderSample(colorful, recipe({}), 40);
        const zeroed = SampleRenderUtil.renderSample(colorful, recipe({adjust: {...NO_ADJUST}}), 40);
        expect(Array.from(zeroed.data)).toEqual(Array.from(plain.data));
    });

    it("turns gray without saturation, and leaves alpha alone", () => {
        const gray = SampleRenderUtil.renderSample(colorful, recipe({adjust: {...NO_ADJUST, saturation: -100}}), 40);
        for (let i = 0; i < gray.data.length; i += 4)
        {
            expect(Math.abs(gray.data[i] - gray.data[i + 1])).toBeLessThanOrEqual(1);
            expect(Math.abs(gray.data[i + 1] - gray.data[i + 2])).toBeLessThanOrEqual(1);
            expect(gray.data[i + 3]).toBe(255);
        }
    });

    it("brightens and darkens without moving black or white", () => {
        const ends = paint(2, 1, (x) => (x == 0) ? [0, 0, 0] : [255, 255, 255]);
        for (const brightness of [-100, 100])
        {
            const adjusted = SampleRenderUtil.renderSample(ends, recipe({adjust: {...NO_ADJUST, brightness}}), 2);
            expect(pixel(adjusted, 0, 0)).toEqual([0, 0, 0, 255]);
            expect(pixel(adjusted, 1, 0)).toEqual([255, 255, 255, 255]);
        }
    });
});

// A workspace's paths, all under dir, as main.ts lays one out.
function pathsIn(dir: string): EditorPaths
{
    return {repoRoot: dir, imagesDir: path.join(dir, "pictures"), samplesDir: path.join(dir, "samples"),
        disabledImagesDir: path.join(dir, "disabled_images"), recipesPath: path.join(dir, "recipes.json"),
        noticesPath: path.join(dir, "notices.md"), sourcesDir: path.join(dir, "sources"), workDir: path.join(dir, "work"),
        rebuildsMap: false};
}

describe("the source library", () => {
    const libraryIn = (dir: string) => new SourceLibrary(pathsIn(dir));
    const png = (r: number, width: number, height: number) =>
        sharp({create: {width, height, channels: 3, background: {r, g: 0, b: 0}}}).png().toBuffer();

    it("keeps each photo once, listed by name with where it came from and when it was first added, and never drops one an entry uses", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "source-library-"));
        try
        {
            vi.useFakeTimers({toFake: ["Date"]});
            const library = libraryIn(dir);
            vi.setSystemTime(new Date("2026-09-27T05:00:00.000Z"));
            const zebra = await library.add(await png(10, 30, 20), "zebra.png", {url: "https://example.com/z.png"});
            vi.setSystemTime(new Date("2026-09-28T05:00:00.000Z"));
            const apple = await library.add(await png(200, 8, 12), "apple.png");
            expect(await library.add(await png(10, 30, 20), "again.png")).toEqual(zebra);
            expect(library.list().map(source => [source.fileName, source.addedAt])).toEqual(
                [["apple.png", "2026-09-28T05:00:00.000Z"], ["zebra.png", "2026-09-27T05:00:00.000Z"]]);
            expect([apple.width, apple.height]).toEqual([8, 12]);
            // One line per source in the committed index.
            expect(fs.readFileSync(library.getIndexPath(), "utf8").split("\n").filter(line => line.includes("sha1")))
                .toHaveLength(2);

            expect(() => library.delete(zebra.sha1, ["2/7"])).toThrow(/2\/7/);
            library.delete(zebra.sha1, []);
            expect(library.list().map(source => source.sha1)).toEqual([apple.sha1]);
            expect(library.findFile(zebra.sha1)).toBeUndefined();
            expect((await library.decode(apple.sha1)).width).toBe(8);
        }
        finally
        {
            vi.useRealTimers();
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("downloads a photo's page on Unsplash by its public link, and reads a suggested author off the file it sends", () => {
        const page = "https://unsplash.com/photos/assorted-title-of-books-piled-in-the-shelves-NIJuEQw0RKg";
        expect(SourceUrlUtil.getUnsplashId(page)).toBe("NIJuEQw0RKg");
        expect(SourceUrlUtil.getDownloadUrl(page)).toBe("https://unsplash.com/photos/NIJuEQw0RKg/download?force=true");
        expect(SourceUrlUtil.getDownloadUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
        expect(SourceUrlUtil.getSuggestedAuthor(
            "https://images.unsplash.com/photo-1?ixlib=rb-4.1.0&dl=inaki-del-olmo-NIJuEQw0RKg-unsplash.jpg",
            "NIJuEQw0RKg")).toBe("Inaki Del Olmo");
        expect(SourceUrlUtil.getSuggestedAuthor("https://images.unsplash.com/photo-1", "NIJuEQw0RKg")).toBeUndefined();
    });
});

describe("preprocessing a source", () => {
    // A green backdrop 400 by 300 with a red slab on it, 200 by 100, which the stand-in for the model finds in
    // whatever frame it is shown: how far inside the slab each cell of its grid lies, as steep as the model's masks.
    const scene = paint(400, 300, (x, y) => (x >= 100 && x < 300 && y >= 100 && y < 200) ? [220, 40, 40] : [20, 200, 20]);
    const GRID = 64;
    const findSlab: MaskFinder = async (_, [left, top, width, height]) => {
        const logits = new Float32Array(GRID * GRID);
        const cell = Math.max(width, height) / GRID;
        for (let row = 0; row < GRID; ++row)
        {
            for (let column = 0; column < GRID; ++column)
            {
                const x = left + (column + 0.5) / GRID * width, y = top + (row + 0.5) / GRID * height;
                const depth = Math.min(x - 100, 300 - x, y - 100, 200 - y);
                logits[row * GRID + column] = Math.max(-20, Math.min(20, 12 * depth / cell));
            }
        }
        return {logits, score: 0.97};
    };
    const url = "https://unsplash.com/photos/a-red-slab-abcdefghijk";
    const cutOut: SourcePrep["cutOut"] = [{rect: [0.2, 0.3, 0.6, 0.4], on: [[0.5, 0.5]]}];

    // A workspace whose library holds the scene, as a photo downloaded from its page.
    async function setUp(dir: string): Promise<{store: EntryStore, photo: SourceEntry}>
    {
        const store = new EntryStore(pathsIn(dir));
        fs.mkdirSync(store.paths.imagesDir, {recursive: true});
        fs.writeFileSync(path.join(store.paths.imagesDir, "manifest.json"),
            JSON.stringify({subfolders: [{name: "2", title: "Objects"}], images: []}));
        fs.writeFileSync(store.paths.noticesPath,
            "# Notices\n<!-- pictures:begin (written by the image map editor) -->\n<!-- pictures:end -->\n");
        const photo = await store.library.add(await sharp(Buffer.from(scene.data.buffer),
            {raw: {width: scene.width, height: scene.height, channels: 4}}).png().toBuffer(), "slab.png",
            {url, author: "Someone", license: "Unsplash License"});
        return {store, photo};
    }

    it("previews what it is cut out into without adding it, then adds it beside the source, with where that came from and how it was made", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "source-prep-"));
        try
        {
            const {store, photo} = await setUp(dir);
            const preprocessor = new SourcePreprocessor(store.library, dir, findSlab);

            const preview = await preprocessor.preview(photo.sha1, {cutOut});
            // Trimmed to the slab, with a tint to lay over the source where the rest is taken away.
            expect(Math.abs(preview.width - 200)).toBeLessThanOrEqual(3);
            expect(Math.abs(preview.height - 100)).toBeLessThanOrEqual(3);
            expect([preview.image, preview.cutAway].every(image => image!.startsWith("data:image/webp;base64,"))).toBe(true);
            expect(preview.notes[0]).toMatch(/^cut out: part 1 at x 0\.2\d\d-0\.7\d\d, y 0\.3\d\d-0\.6\d\d, scored 0\.97/);
            expect(store.library.list()).toHaveLength(1);

            const added = await preprocessor.add(photo.sha1, {cutOut});
            expect(added.fileName).toBe("slab_cut_out.png");
            expect([added.width, added.height]).toEqual([preview.width, preview.height]);
            expect([added.url, added.author, added.license]).toEqual([url, "Someone", "Unsplash License"]);
            expect(added.preparedFrom).toEqual({sha1: photo.sha1, prep: {cutOut}});
            expect(store.library.list().map(source => source.fileName).sort()).toEqual(["slab.png", "slab_cut_out.png"]);
            const decoded = await store.library.decode(added.sha1);
            expect(pixel(decoded, 100, 50)).toEqual([220, 40, 40, 255]);
            expect((await store.library.decode(photo.sha1)).width).toBe(400);
            // The same picture made again is the same source, kept once (tidying drops nothing here); another made
            // by the same steps takes a name of its own.
            expect((await preprocessor.add(photo.sha1, {cutOut, tidy: true})).sha1).toBe(added.sha1);
            const whole: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
            expect((await preprocessor.add(photo.sha1, {square: {corners: whole, aspect: 2}})).fileName).toBe("slab_squared.png");
            expect((await preprocessor.add(photo.sha1, {square: {corners: whole, aspect: 1}})).fileName).toBe("slab_squared_2.png");
            expect(store.library.list()).toHaveLength(4);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("takes a face's corners where they lie on the source, though the cut-out is trimmed before it is squared", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "source-prep-"));
        try
        {
            const {store, photo} = await setUp(dir);
            const preprocessor = new SourcePreprocessor(store.library, dir, findSlab);
            // The slab's own corners, squared to as tall as it is wide: placed on the trimmed cut-out instead, they
            // would take a part of the slab half that size.
            const squared = await preprocessor.add(photo.sha1, {cutOut,
                square: {corners: [[0.25, 1 / 3], [0.75, 1 / 3], [0.75, 2 / 3], [0.25, 2 / 3]], aspect: 1}});
            expect(squared.fileName).toBe("slab_cut_out_squared.png");
            expect(Math.abs(squared.width - 200)).toBeLessThanOrEqual(3);
            expect(Math.abs(squared.height - 200)).toBeLessThanOrEqual(3);
            const decoded = await store.library.decode(squared.sha1);
            expect(pixel(decoded, 100, 100)).toEqual([220, 40, 40, 255]);

            // Reshaping alone leaves the picture whole: its long side keeps its sharpness, and the other follows.
            const stretched = await preprocessor.preview(photo.sha1, {square: {corners: [[0, 0], [1, 0], [1, 1], [0, 1]], aspect: 2}});
            expect([stretched.width, stretched.height, stretched.cutAway]).toEqual([600, 300, undefined]);
            expect(stretched.notes).toEqual([expect.stringMatching(/^squared: .* 2\.000 wide per high, as given/)]);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("refuses what can't be made, saying why, and a cut-out whose model would first be fetched, until that is allowed", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "source-prep-"));
        try
        {
            const {store, photo} = await setUp(dir);
            const preprocessor = new SourcePreprocessor(store.library, dir, findSlab);
            await expect(preprocessor.preview(photo.sha1, {})).rejects.toThrow(/Nothing is asked of it/);
            await expect(preprocessor.add(photo.sha1, {round: {outline: [[0.1, 0.1]]}}))
                .rejects.toThrow(/slab\.png: round takes five points or more/);
            await expect(preprocessor.preview("0".repeat(40), {cutOut})).rejects.toThrow(/not in the library/);
            expect(store.library.list()).toHaveLength(1);

            // With no stand-in, and no model under this workspace's own root.
            const modelless = new SourcePreprocessor(store.library, dir);
            await expect(modelless.preview(photo.sha1, {cutOut})).rejects.toBeInstanceOf(MissingToolsError);
            await expect(modelless.add(photo.sha1, {cutOut})).rejects.toThrow(/Segment Anything 2.*Fetch them/);
            // Reshaping takes no model.
            expect((await modelless.preview(photo.sha1, {square: {corners: [[0, 0], [1, 0], [1, 1], [0, 1]]}})).width).toBe(400);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("is sampled like any other source; lost, it isn't looked for at the photo's address it carries", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "source-prep-"));
        try
        {
            vi.spyOn(console, "log").mockImplementation(() => {});
            const {store, photo} = await setUp(dir);
            const added = await new SourcePreprocessor(store.library, dir, findSlab).add(photo.sha1, {cutOut});
            const entryPath = await store.saveEntry({path: undefined, subfolder: "2",
                fields: {title: "Slab", author: added.author!, source: added.url, license: added.license},
                recipe: recipe({sourceSha1: added.sha1, output: {preserveScale: true, numCols: 2, numRows: 2}}),
                baseHash: store.readState().hash});
            // The slab across its cells, with see-through room above and below it.
            const {data, info} = await sharp(store.getGameImagePath(entryPath, false)).ensureAlpha().raw()
                .toBuffer({resolveWithObject: true});
            expect([info.width, info.height]).toEqual([256, 256]);
            expect([data[(128 * 256 + 128) * 4 + 3], data[(10 * 256 + 128) * 4 + 3]]).toEqual([255, 0]);

            fs.rmSync(store.library.findFile(added.sha1)!);
            await expect(RenderCommands.renderSamples(store, [entryPath])).rejects.toThrow(/was preprocessed from a photo/);
        }
        finally
        {
            vi.restoreAllMocks();
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("leaves a photo's address to the photo itself: one preprocessed from it is named by its file, and surveyed apart", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "source-prep-"));
        try
        {
            vi.spyOn(console, "log").mockImplementation(() => {});
            const {store, photo} = await setUp(dir);
            const added = await new SourcePreprocessor(store.library, dir, findSlab).add(photo.sha1, {cutOut});

            const [ofPhoto] = await BatchCommands.writeSurveys(store, [url]);
            const [ofAdded] = await BatchCommands.writeSurveys(store, ["slab_cut_out.png"]);
            expect(path.basename(ofPhoto)).toBe("abcdefghijk.jpg");
            expect(path.basename(ofAdded)).toBe(`${added.sha1.slice(0, 12)}.jpg`);
            // The photo's shape, and the slab's.
            expect((await sharp(ofPhoto).metadata()).height).toBe(1200);
            expect(Math.abs((await sharp(ofAdded).metadata()).height! - 800)).toBeLessThanOrEqual(20);
        }
        finally
        {
            vi.restoreAllMocks();
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });
});

describe("paths of new entries", () => {
    const entries = [{path: "2/1", author: "", title: ""}, {path: "2/4", author: "", title: ""}, {path: "1/9", author: "", title: ""}];

    it("take the number after the highest their subfolder has used, deleted ones included", () => {
        expect(EntryPathUtil.getNextPath("2", entries, [])).toBe("2/5");
        expect(EntryPathUtil.getNextPath("2", entries, ["2/7"])).toBe("2/8");
        expect(EntryPathUtil.getNextPath("1", entries, ["2/7"])).toBe("1/10");
        expect(EntryPathUtil.getNextPath("3", entries, [])).toBe("3/1");
    });
});

describe("an entry with no recipe", () => {
    it("is taken in as the whole of its own image, unchanged, and is then edited like any other", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entry-store-"));
        try
        {
            const paths = pathsIn(dir);
            fs.mkdirSync(path.join(paths.imagesDir, "1"), {recursive: true});
            fs.writeFileSync(path.join(paths.imagesDir, "manifest.json"), JSON.stringify({
                subfolders: [{name: "1", title: "Arts"}], images: [{path: "1/1", author: "A Painter", title: "Harbor"}]}));
            fs.writeFileSync(paths.noticesPath,
                "# Notices\n<!-- pictures:begin (written by the image map editor) -->\n<!-- pictures:end -->\n");
            const painting = await sharp({create: {width: 90, height: 60, channels: 3, background: {r: 40, g: 90, b: 160}}})
                .webp().toBuffer();
            const shipped = path.join(paths.imagesDir, "1/1.webp");
            fs.writeFileSync(shipped, painting);
            const store = new EntryStore(paths);

            expect(await store.adoptUnsampledEntries()).toEqual(["1/1"]);
            expect(await store.adoptUnsampledEntries()).toEqual([]);
            const state = store.readState();
            const taken = state.recipeFile.recipes["1/1"];
            expect(taken.output).toEqual({preserveScale: false, longSide: 90});
            expect(fs.readFileSync(shipped).equals(painting)).toBe(true);
            expect(fs.readFileSync(store.getSamplePath("1/1")).equals(painting)).toBe(true);
            expect(state.sources.find(source => source.sha1 == taken.sourceSha1)?.author).toBe("A Painter");

            // Its source missing (the library's photos aren't committed), it comes back from the sample, as it was.
            fs.rmSync(store.library.findFile(taken.sourceSha1)!);
            await RenderCommands.renderSamples(store, ["1/1"]);
            expect(store.library.findFile(taken.sourceSha1)).toBeDefined();

            // Turned gray and cut to an ellipse, as an everyday object would be.
            await store.saveEntry({path: "1/1", subfolder: "1",
                fields: {title: "Harbor", author: "A Painter", source: "", license: "", disabled: false},
                recipe: {...taken, adjust: {...NO_ADJUST, saturation: -100}, selections: [{shape: "ellipse", rect: [0, 0, 1, 1], radius: 0}]},
                baseHash: store.readState().hash});
            const {data, info} = await sharp(shipped).ensureAlpha().raw().toBuffer({resolveWithObject: true});
            expect([info.width, info.height]).toEqual([90, 60]);
            const middle = (30 * 90 + 45) * 4;
            expect(Math.abs(data[middle] - data[middle + 2])).toBeLessThanOrEqual(4);
            expect(data[3]).toBe(0);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });
});

describe("a disabled entry", () => {
    it("parks its game image where it doesn't ship and leaves the notices, and comes back when enabled", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entry-store-"));
        try
        {
            const paths = pathsIn(dir);
            fs.mkdirSync(paths.imagesDir, {recursive: true});
            fs.writeFileSync(path.join(paths.imagesDir, "manifest.json"),
                JSON.stringify({subfolders: [{name: "2", title: "Objects"}], images: []}));
            fs.writeFileSync(paths.noticesPath,
                "# Notices\n<!-- pictures:begin (written by the image map editor) -->\n<!-- pictures:end -->\n");
            const store = new EntryStore(paths);
            const photo = await store.library.add(await sharp({create: {width: 40, height: 40, channels: 3,
                background: {r: 90, g: 120, b: 30}}}).png().toBuffer(), "photo.png");
            const fields = {title: "Crate", author: "Someone", source: "https://example.com/crate", license: "CC0 1.0"};
            const save = async (disabled: boolean, withRecipe: boolean) => store.saveEntry({
                path: withRecipe && !disabled ? undefined : "2/1", subfolder: "2", fields: {...fields, disabled},
                recipe: withRecipe ? recipe({sourceSha1: photo.sha1, output: {preserveScale: true, numCols: 2, numRows: 2}})
                    : undefined,
                baseHash: store.readState().hash});
            const shipped = path.join(paths.imagesDir, "2/1.webp");
            const thumbnail = path.join(paths.imagesDir, "2/1.thumbnail.webp");
            const parked = path.join(paths.disabledImagesDir, "2/1.webp");
            const noticeRows = () => fs.readFileSync(paths.noticesPath, "utf8").split("\n").filter(line => line.startsWith("| `"));

            expect(await save(false, true)).toBe("2/1");
            fs.writeFileSync(thumbnail, "");
            expect([fs.existsSync(shipped), fs.existsSync(parked)]).toEqual([true, false]);
            expect(noticeRows()).toHaveLength(1);

            await save(true, false);
            expect([fs.existsSync(shipped), fs.existsSync(thumbnail), fs.existsSync(parked)]).toEqual([false, false, true]);
            expect(store.readState().entries[0].disabled).toBe(true);
            expect(store.findGameImage("2/1")).toBe(parked);
            expect(noticeRows()).toHaveLength(0);

            // Sampled again while disabled, it stays parked.
            await save(true, true);
            expect([fs.existsSync(shipped), fs.existsSync(parked)]).toEqual([false, true]);

            await save(false, false);
            expect([fs.existsSync(shipped), fs.existsSync(parked)]).toEqual([true, false]);
            expect(store.readState().entries[0].disabled).toBeUndefined();
            expect(noticeRows()).toHaveLength(1);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });
});

describe("a staging entry", () => {
    it("ships its game image and keeps its notices row as an enabled one does, and is never disabled too", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entry-store-"));
        try
        {
            const paths = pathsIn(dir);
            fs.mkdirSync(paths.imagesDir, {recursive: true});
            fs.writeFileSync(path.join(paths.imagesDir, "manifest.json"),
                JSON.stringify({subfolders: [{name: "2", title: "Objects"}], images: []}));
            fs.writeFileSync(paths.noticesPath,
                "# Notices\n<!-- pictures:begin (written by the image map editor) -->\n<!-- pictures:end -->\n");
            const store = new EntryStore(paths);
            const photo = await store.library.add(await sharp({create: {width: 40, height: 40, channels: 3,
                background: {r: 90, g: 120, b: 30}}}).png().toBuffer(), "photo.png");
            const fields = {title: "Crate", author: "Someone", source: "https://example.com/crate", license: "CC0 1.0"};
            const save = (status: {disabled?: boolean, staging?: boolean}, isNew = false) => store.saveEntry({
                path: isNew ? undefined : "2/1", subfolder: "2", fields: {...fields, ...status},
                recipe: isNew ? recipe({sourceSha1: photo.sha1, output: {preserveScale: true, numCols: 2, numRows: 2}})
                    : undefined,
                baseHash: store.readState().hash});
            const shipped = path.join(paths.imagesDir, "2/1.webp");
            const noticeRows = () => fs.readFileSync(paths.noticesPath, "utf8").split("\n").filter(line => line.startsWith("| `"));
            const status = () => [store.readState().entries[0].disabled, store.readState().entries[0].staging];

            expect(await save({staging: true}, true)).toBe("2/1");
            expect(status()).toEqual([undefined, true]);
            expect(fs.readFileSync(path.join(paths.imagesDir, "manifest.json"), "utf8")).toContain(`"staging": true`);
            expect(fs.existsSync(shipped)).toBe(true);
            expect(noticeRows()).toHaveLength(1);

            await expect(save({disabled: true, staging: true})).rejects.toThrow(/either disabled or staging/);
            await save({disabled: true});
            expect(status()).toEqual([true, undefined]);
            await save({});
            expect(status()).toEqual([undefined, undefined]);
            expect(fs.existsSync(shipped)).toBe(true);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });
});

describe("a sample order", () => {
    const source = {sha1: "s", fileName: "s.jpg", width: 200, height: 100};

    it("takes a rect's height from the cells' shape, and its retouches into the source", () => {
        const made = SampleOrderUtil.toRecipe({source: "s", subfolder: "2", title: "Crate", cells: [2, 1],
            rect: [0.1, 0.2, 0.3], retouches: [[0.5, 0, 0.5, 0.5]]}, source);
        // 0.3 of 200 across is 60 pixels, so 30 down: 0.3 of 100.
        expect(made.corners).toEqual([[0.1, 0.2], [0.4, 0.2], [0.4, 0.5], [0.1, 0.5]]);
        expect(made.retouches[0].map(value => +value.toFixed(6))).toEqual([0.25, 0.2, 0.15, 0.15]);
        expect(made.output).toEqual({preserveScale: true, numCols: 2, numRows: 1});
        expect(SampleOrderUtil.toRecipe({source: "s", subfolder: "1", title: "Harbor", longSide: 640,
            rect: [0, 0, 1, 1]}, source).output).toEqual({preserveScale: false, longSide: 640});
        // Placed in its cells as asked.
        expect(SampleOrderUtil.toRecipe({source: "s", subfolder: "2", title: "Crate", cells: [2, 2], rect: [0, 0, 0.5],
            align: [0, 1], margin: [0.2, 0]}, source).output)
            .toEqual({preserveScale: true, numCols: 2, numRows: 2, align: [0, 1], margin: [0.2, 0]});
        // Stretched to fill them as asked, whatever shape its rect has.
        expect(SampleOrderUtil.toRecipe({source: "s", subfolder: "2", title: "Crate", cells: [2, 2], rect: [0, 0, 1, 1],
            stretch: true}, source).output).toEqual({preserveScale: true, numCols: 2, numRows: 2, stretch: true});
    });

    it("refuses one that runs past the source, or doesn't say how big to make it", () => {
        expect(() => SampleOrderUtil.toRecipe({source: "s", subfolder: "2", title: "Crate", cells: [2, 2],
            rect: [0.8, 0, 0.3]}, source)).toThrow(/Crate/);
        expect(() => SampleOrderUtil.toRecipe({source: "s", subfolder: "2", title: "Crate",
            rect: [0, 0, 0.5, 0.5]}, source)).toThrow(/cells or longSide/);
        expect(() => SampleOrderUtil.toRecipe({source: "s", subfolder: "1", title: "Harbor", longSide: 640,
            rect: [0, 0, 1, 1], align: [0, 0]}, source)).toThrow(/need cells/);
        expect(() => SampleOrderUtil.toRecipe({source: "s", subfolder: "1", title: "Harbor", longSide: 640,
            rect: [0, 0, 1, 1], stretch: true}, source)).toThrow(/need cells/);
    });
});

describe("a batch of samples", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("is saved as disabled entries, which a second run remakes rather than adds to, whatever was enabled since", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entry-store-"));
        try
        {
            const paths = pathsIn(dir);
            fs.mkdirSync(paths.imagesDir, {recursive: true});
            fs.writeFileSync(path.join(paths.imagesDir, "manifest.json"),
                JSON.stringify({subfolders: [{name: "2", title: "Objects"}], images: []}));
            fs.writeFileSync(paths.noticesPath,
                "# Notices\n<!-- pictures:begin (written by the image map editor) -->\n<!-- pictures:end -->\n");
            const store = new EntryStore(paths);
            const url = "https://unsplash.com/photos/a-crate-of-apples-abcdefghijk";
            await store.library.add(await sharp({create: {width: 400, height: 200, channels: 3,
                background: {r: 160, g: 40, b: 30}}}).png().toBuffer(), "abcdefghijk.jpg",
                {url, author: "Someone", license: "Unsplash License"});
            const planPath = path.join(dir, "plan.json");
            fs.writeFileSync(planPath, JSON.stringify([
                {source: url, subfolder: "2", title: "Crate", keywords: "Crate, RED and  Apple ,apple, bookshelf, book,crate,",
                    cells: [2, 2], rect: [0, 0, 0.5]},
                {source: "abcdefghijk", subfolder: "2", title: "Crate Side", keywords: "crate", cells: [1, 2],
                    rect: [0.5, 0, 0.25]},
            ]));

            expect(await BatchCommands.saveSamples(store, planPath)).toEqual(["2/1", "2/2"]);
            const entries = () => store.readState().entries;
            expect(entries().map(entry => [entry.path, entry.disabled, entry.author, entry.source]))
                .toEqual([["2/1", true, "Someone", url], ["2/2", true, "Someone", url]]);
            // Tidied into single words, less a filler word and one found inside another, and written after the title.
            expect(entries()[0].keywords).toBe("crate, red, apple, bookshelf");
            expect(fs.readFileSync(path.join(paths.imagesDir, "manifest.json"), "utf8"))
                .toContain(`"title": "Crate", "keywords": "crate, red, apple, bookshelf", "preserveScale": true`);
            expect(JSON.parse(fs.readFileSync(planPath, "utf8")).map((order: {path: string}) => order.path)).toEqual(["2/1", "2/2"]);
            expect((await sharp(store.getGameImagePath("2/2", true)).metadata()).width).toBe(128);

            await store.saveEntry({path: "2/1", subfolder: "2", fields: {title: "Crate", author: "Someone", source: url,
                license: "Unsplash License", disabled: false}, baseHash: store.readState().hash});
            expect(await BatchCommands.saveSamples(store, planPath)).toEqual(["2/1", "2/2"]);
            expect(entries().map(entry => entry.disabled)).toEqual([true, true]);

            // A photo the library knows neither the origin nor the author of can't be sampled this way.
            const unknown = await store.library.add(await sharp({create: {width: 20, height: 20, channels: 3,
                background: {r: 0, g: 0, b: 0}}}).png().toBuffer(), "mine.png");
            fs.writeFileSync(planPath, JSON.stringify([{source: unknown.sha1, subfolder: "2", title: "Mine", keywords: "mine",
                cells: [2, 2], rect: [0, 0, 1]}]));
            await expect(BatchCommands.saveSamples(store, planPath)).rejects.toThrow(/license/);
            // Nor can an everyday object that names nothing to find it by.
            fs.writeFileSync(planPath, JSON.stringify([{source: url, subfolder: "2", title: "Bare Crate", keywords: " ",
                cells: [2, 2], rect: [0, 0, 0.5]}]));
            await expect(BatchCommands.saveSamples(store, planPath)).rejects.toThrow(/Bare Crate.*keywords/);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("takes files of this machine as sources too: one's own by its author alone, saved with no source or license", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entry-store-"));
        try
        {
            const paths = pathsIn(dir);
            fs.mkdirSync(paths.imagesDir, {recursive: true});
            fs.writeFileSync(path.join(paths.imagesDir, "manifest.json"),
                JSON.stringify({subfolders: [{name: "2", title: "Objects"}, {name: "1", title: "Arts"}], images: []}));
            fs.writeFileSync(paths.noticesPath,
                "# Notices\n<!-- pictures:begin (written by the image map editor) -->\n<!-- pictures:end -->\n");
            const store = new EntryStore(paths);
            const write = async (name: string, r: number) => {
                const file = path.join(dir, name);
                fs.writeFileSync(file, await sharp({create: {width: 40, height: 40, channels: 3, background: {r, g: 60, b: 90}}})
                    .png().toBuffer());
                return file;
            };
            const own = await write("slippers.png", 120);
            const cutOut = await write("someone-abcdefghijk-unsplash.png", 200);
            const url = "https://unsplash.com/photos/a-coffee-machine-abcdefghijk";

            await BatchCommands.addSources(store, [own], {author: "thingspool"});
            await BatchCommands.addSources(store, [cutOut], {url, author: "Someone", license: "Unsplash License"});
            // Kept once, however often it is added.
            await BatchCommands.addSources(store, [own], {author: "thingspool"});
            expect(store.library.list().map(source => [source.fileName, source.url, source.author, source.license])).toEqual([
                ["slippers.png", undefined, "thingspool", undefined],
                ["someone-abcdefghijk-unsplash.png", url, "Someone", "Unsplash License"]]);
            // Someone else's photo is used under a license on offer, and says where it came from.
            await expect(BatchCommands.addSources(store, [own], {license: "Unsplash License"})).rejects.toThrow(/--url/);
            await expect(BatchCommands.addSources(store, [own], {url, license: "All rights reserved"}))
                .rejects.toThrow(/not a license on offer/);

            // Named by its file, or as a photo is, by the address it was made from.
            const planPath = path.join(dir, "plan.json");
            fs.writeFileSync(planPath, JSON.stringify([
                {source: "slippers.png", subfolder: "2", title: "Slippers", keywords: "slipper, shoe, wool", cells: [2, 2],
                    rect: [0, 0, 1]},
                {source: "abcdefghijk", subfolder: "2", title: "Coffee Machine", keywords: "coffee, machine, steel",
                    cells: [2, 2], rect: [0, 0, 1]},
                {source: "slippers.png", subfolder: "1", title: "Slippers at Dusk", longSide: 32, rect: [0, 0, 1, 1]},
            ]));
            expect(await BatchCommands.saveSamples(store, planPath)).toEqual(["2/1", "2/2", "1/1"]);
            expect(store.readState().entries.map(entry => [entry.path, entry.author, entry.source, entry.license, entry.disabled]))
                .toEqual([["2/1", "thingspool", undefined, undefined, true], ["2/2", "Someone", url, "Unsplash License", true],
                    ["1/1", "thingspool", undefined, undefined, true]]);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("saves a sample stretched to fill its cells where its order asks, and fitted inside them otherwise", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entry-store-"));
        try
        {
            const paths = pathsIn(dir);
            fs.mkdirSync(paths.imagesDir, {recursive: true});
            fs.writeFileSync(path.join(paths.imagesDir, "manifest.json"),
                JSON.stringify({subfolders: [{name: "2", title: "Objects"}], images: []}));
            fs.writeFileSync(paths.noticesPath,
                "# Notices\n<!-- pictures:begin (written by the image map editor) -->\n<!-- pictures:end -->\n");
            const store = new EntryStore(paths);
            // Twice as wide as tall, red above blue.
            const banner = paint(80, 40, (_, y) => (y < 20) ? [220, 0, 0] : [0, 0, 220]);
            await store.library.add(await sharp(Buffer.from(banner.data.buffer), {raw: {width: 80, height: 40, channels: 4}})
                .png().toBuffer(), "banner.png", {author: "thingspool"});
            const planPath = path.join(dir, "plan.json");
            const order = {source: "banner.png", subfolder: "2", title: "Banner", keywords: "banner", cells: [2, 2],
                rect: [0, 0, 1, 1]};
            fs.writeFileSync(planPath, JSON.stringify([order, {...order, title: "Tall Banner", stretch: true}]));

            expect(await BatchCommands.saveSamples(store, planPath)).toEqual(["2/1", "2/2"]);
            expect(store.readState().recipeFile.recipes["2/2"].output)
                .toEqual({preserveScale: true, numCols: 2, numRows: 2, stretch: true});
            // The red and blue of a game image's top and bottom rows, at its middle across.
            const ends = async (entryPath: string) => {
                const {data, info} = await sharp(store.getGameImagePath(entryPath, true)).ensureAlpha().raw()
                    .toBuffer({resolveWithObject: true});
                expect([info.width, info.height]).toEqual([256, 256]);
                const at = (y: number) => (y * info.width + info.width / 2) * 4;
                return [data[at(4)], data[at(4) + 2], data[at(251)], data[at(251) + 2]];
            };
            // Fitted, both rows are margin, in the one color of the sample's edges; stretched, they are the picture's own.
            const fitted = await ends("2/1");
            expect(Math.abs(fitted[0] - fitted[2])).toBeLessThan(20);
            expect(Math.abs(fitted[1] - fitted[3])).toBeLessThan(20);
            const stretched = await ends("2/2");
            expect(stretched[0]).toBeGreaterThan(180);
            expect(stretched[1]).toBeLessThan(60);
            expect(stretched[2]).toBeLessThan(60);
            expect(stretched[3]).toBeGreaterThan(180);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("refuses a keyword marked as a category, which only an admin sets in the game, and writes no tab's categories", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entry-store-"));
        try
        {
            const paths = pathsIn(dir);
            fs.mkdirSync(paths.imagesDir, {recursive: true});
            // As a manifest of before listed them: they are the admin's settings' to list now.
            const categories = [{name: "store", title: "Store"}, {name: "kitchen", title: "Kitchen"}];
            fs.writeFileSync(path.join(paths.imagesDir, "manifest.json"),
                JSON.stringify({subfolders: [{name: "2", title: "Objects", categories}], images: []}));
            fs.writeFileSync(paths.noticesPath,
                "# Notices\n<!-- pictures:begin (written by the image map editor) -->\n<!-- pictures:end -->\n");
            const store = new EntryStore(paths);
            const url = "https://unsplash.com/photos/a-crate-of-apples-abcdefghijk";
            await store.library.add(await sharp({create: {width: 400, height: 200, channels: 3,
                background: {r: 160, g: 40, b: 30}}}).png().toBuffer(), "abcdefghijk.jpg",
                {url, author: "Someone", license: "Unsplash License"});
            const planPath = path.join(dir, "plan.json");
            fs.writeFileSync(planPath, JSON.stringify([
                {source: url, subfolder: "2", title: "Crate", keywords: "crate, apple, kitchen*, market",
                    cells: [2, 2], rect: [0, 0, 0.5]},
            ]));
            await expect(BatchCommands.saveSamples(store, planPath)).rejects.toThrow(/"kitchen\*" is marked as a category/);
            expect(store.readState().entries).toEqual([]);

            // Unmarked, a category's name is only a word, and stays where it is.
            fs.writeFileSync(planPath, JSON.stringify([
                {source: url, subfolder: "2", title: "Crate Side", keywords: "crate, apple, store", cells: [1, 2],
                    rect: [0.5, 0, 0.25]},
            ]));
            expect(await BatchCommands.saveSamples(store, planPath)).toEqual(["2/1"]);
            expect(store.readState().entries.map(entry => entry.keywords)).toEqual(["crate, apple, store"]);
            expect(store.readState().subfolders).toEqual([{name: "2", title: "Objects"}]);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("surveys a source, or a part of it, with a grid at a size to plan by, all of which goes with the source", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entry-store-"));
        try
        {
            const store = new EntryStore(pathsIn(dir));
            fs.mkdirSync(store.paths.imagesDir, {recursive: true});
            fs.writeFileSync(path.join(store.paths.imagesDir, "manifest.json"), JSON.stringify({images: []}));
            const source = await store.library.add(await sharp({create: {width: 300, height: 200, channels: 3,
                background: {r: 20, g: 80, b: 140}}}).png().toBuffer(), "wall.png",
                {url: "https://unsplash.com/photos/a-wall-abcdefghijk", license: "Unsplash License"});

            const [whole] = await BatchCommands.writeSurveys(store);
            expect(path.basename(whole)).toBe("abcdefghijk.jpg");
            expect(await sharp(whole).metadata()).toMatchObject({width: 1600, height: 1067});
            const [part] = await BatchCommands.writeSurveys(store, [`${source.sha1}:0.5,0.5,0.25,0.5`]);
            // 75 by 100 pixels of the source.
            expect(await sharp(part).metadata()).toMatchObject({width: 1200, height: 1600});

            // Deleted, it leaves nothing: its photo, thumbnail and surveys, its line in the index, or a decoded copy
            // a save could still render from.
            await store.library.getThumbnail(source.sha1);
            store.library.delete(source.sha1, []);
            expect(fs.readdirSync(dir, {recursive: true}).map(String)
                .filter(file => file.includes(source.sha1) || file.includes("abcdefghijk"))).toEqual([]);
            expect(fs.readFileSync(store.library.getIndexPath(), "utf8")).not.toContain(source.sha1);
            await expect(store.library.decode(source.sha1)).rejects.toThrow(/isn't on this machine/);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });
});

describe("building a map", () => {
    // The builder reads and writes under the directory the build was started in (PWD), as SSG runs it. The admin's
    // settings are put at the assets' root as given: the file's text, or what it holds.
    async function build(images: {path: string, disabled?: boolean, staging?: boolean, title?: string, author?: string,
        keywords?: string}[], settings?: unknown,
        subfolders: unknown[] = [{name: "a", title: "A"}, {name: "b", title: "B"}]): Promise<string>
    {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "image-map-"));
        const startedIn = process.env.PWD;
        try
        {
            const root = path.join(dir, "public/app/assets/test_images");
            fs.mkdirSync(root, {recursive: true});
            fs.mkdirSync(path.join(dir, "src/shared/graphics/image/maps"), {recursive: true});
            fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({subfolders,
                images: images.map(image => ({author: "", title: image.path, ...image}))}));
            if (settings != undefined)
            {
                fs.writeFileSync(path.join(dir, "public/app/assets", ADMIN_ASSET_SETTINGS_FILE_NAME),
                    (typeof settings == "string") ? settings : JSON.stringify(settings));
            }
            for (const image of images)
            {
                fs.mkdirSync(path.dirname(path.join(root, `${image.path}.webp`)), {recursive: true});
                await sharp({create: {width: 8, height: 8, channels: 3, background: {r: 0, g: 0, b: 0}}}).webp()
                    .toFile(path.join(root, `${image.path}.webp`));
            }
            process.env.PWD = dir;
            await new ImageMapBuilder({rootDirName: "test_images", mapName: "TestImageMap", hasGrid: false}).build();
            return fs.readFileSync(path.join(dir, "src/shared/graphics/image/maps/testImageMap.ts"), "utf8");
        }
        finally
        {
            process.env.PWD = startedIn;
            fs.rmSync(dir, {recursive: true, force: true});
        }
    }

    it("leaves out a tab whose images are all disabled, and refuses one with no images enabled at all", async () => {
        const built = await build([{path: "a/1"}, {path: "b/1", disabled: true}]);
        expect(built).toContain(`{path:"a/1"`);
        expect(built).not.toContain(`b/1`);
        expect(built).toContain(`const subfolderTabs: ImageMapSubfolderTab[] = [{name:"a",title:"A"}]`);
        await expect(build([{path: "a/1", disabled: true}, {path: "b/1", disabled: true}])).rejects.toThrow(/Every image is disabled/);
    });

    it("builds a staging image as any other, marked as one, and refuses one that is disabled too", async () => {
        const built = await build([{path: "a/1"}, {path: "a/2", staging: true}, {path: "b/1"}]);
        expect(built).toMatch(/\{path:"a\/2",[^}]*,staging:true\}/);
        expect(built).not.toMatch(/\{path:"a\/1",[^}]*staging/);
        await expect(build([{path: "a/1", disabled: true, staging: true}, {path: "b/1"}]))
            .rejects.toThrow(/both disabled and staging/);
    });

    it("ships an image's keywords packed tight, its title and author in their place when it names none, and neither else", async () => {
        const built = await build([{path: "a/1", title: "Crate", author: "Someone", keywords: " Crate, RED  pepper,crate, "},
            {path: "b/1", title: "Harbor, at Dusk", author: "A \"Painter\""}]);
        expect(built).toContain(`{path:"a/1",keywords:"crate,red pepper",width:8`);
        expect(built).toContain(`{path:"b/1",keywords:"harbor,at dusk,a \\"painter\\"",width:8`);
        expect(built).not.toMatch(/\b(title|author):"(Crate|Someone|Harbor)/);
    });

    it("lists each subfolder's images in the order the admin's settings give, those they leave out first, and refuses settings that give no order", async () => {
        const images = [{path: "a/1"}, {path: "a/2"}, {path: "a/3", disabled: true}, {path: "a/4"}, {path: "b/1"}, {path: "b/2"}];
        const listed = (built: string) => [...built.matchAll(/\{path:"([^"]+)"/g)].map(match => match[1]);
        const ordered = (orderedIndicesBySubfolder: unknown) => build(images,
            {testImageMap: {categoryTabsBySubfolder: {}, orderedIndicesBySubfolder, categoriesBySubfolderAndIndex: {}}});
        // With no file, or one with nothing for this map, as the manifest lists them.
        expect(listed(await build(images))).toEqual(["a/1", "a/2", "a/4", "b/1", "b/2"]);
        expect(listed(await build(images, {otherImageMap: {orderedIndicesBySubfolder: {a: [4, 1]}}})))
            .toEqual(["a/1", "a/2", "a/4", "b/1", "b/2"]);
        // They leave a/2 out, so that comes first. They may list what the map doesn't hold: an image disabled (a/3)
        // or gone (a/9), and a subfolder with none (c).
        expect(listed(await ordered({a: [4, 3, 9, 1], c: [1]}))).toEqual(["a/2", "a/4", "a/1", "b/1", "b/2"]);
        expect(listed(await ordered({b: [2, 1]}))).toEqual(["a/1", "a/2", "a/4", "b/2", "b/1"]);

        await expect(build(images, "{")).rejects.toThrow(/adminAssetSettings\.json is not valid JSON/);
        await expect(build(images, "[]")).rejects.toThrow(/adminAssetSettings\.json holds no settings/);
        await expect(build(images, {testImageMap: {}})).rejects.toThrow(/holds no "categoryTabsBySubfolder" under "testImageMap"/);
        await expect(build(images, {testImageMap: {categoryTabsBySubfolder: {}}}))
            .rejects.toThrow(/holds no "orderedIndicesBySubfolder" under "testImageMap"/);
        await expect(build(images, {testImageMap: {categoryTabsBySubfolder: {}, orderedIndicesBySubfolder: {}}}))
            .rejects.toThrow(/holds no "categoriesBySubfolderAndIndex" under "testImageMap"/);
        await expect(ordered({a: [1, "4"]})).rejects.toThrow(/other than image numbers under "a"/);
        await expect(ordered({a: [1, 4, 1]})).rejects.toThrow(/lists image 1 twice under "a"/);
    });

    it("builds each tab's categories as the admin's settings list them, and refuses any that can't be categories or that the manifest lists", async () => {
        const images = [{path: "a/1"}, {path: "b/1"}];
        const kitchen = {name: "kitchen", title: "Kitchen"}, dining = {name: "diningroom", title: "Dining Room"};
        const listing = (categoryTabsBySubfolder: unknown) => build(images,
            {testImageMap: {categoryTabsBySubfolder, orderedIndicesBySubfolder: {}, categoriesBySubfolderAndIndex: {}}});
        // In the order listed; a tab left out, or one listing none, has none, and a subfolder that is no tab (c) is
        // passed over.
        expect(await listing({a: [kitchen, dining], b: [], c: [kitchen]})).toContain(`const subfolderTabs: ImageMapSubfolderTab[] = `
            + `[{name:"a",title:"A",categories:[{name:"kitchen",title:"Kitchen"},{name:"diningroom",title:"Dining Room"}]},{name:"b",title:"B"}]`);
        expect(await listing({})).toContain(`const subfolderTabs: ImageMapSubfolderTab[] = [{name:"a",title:"A"},{name:"b",title:"B"}]`);

        await expect(listing({a: "kitchen"})).rejects.toThrow(/lists something other than categories, each a name and a title, under "a"/);
        await expect(listing({a: [{name: "kitchen"}]})).rejects.toThrow(/lists something other than categories, each a name and a title, under "a"/);
        const refused = (categories: unknown[]) => expect(listing({a: categories})).rejects;
        await refused([{name: "Kitchen", title: "Kitchen"}]).toThrow(/a category under "a" that can't be one: A category's name is one word/);
        await refused([{name: "kitchen", title: ""}]).toThrow(/can't be one: A category needs a title/);
        await refused([{name: "all", title: "All"}]).toThrow(/can't be one: "all" is a tab every chooser has of its own/);
        await refused([kitchen, {name: "kitchen", title: "Galley"}]).toThrow(/can't be one: There is already a category named "kitchen"/);
        await refused([dining, {name: "dining", title: "Dining"}]).toThrow(/can't be one: "dining" is inside "diningroom"/);
        // The manifest lists none of its own.
        await expect(build(images, undefined, [{name: "a", title: "A", categories: [kitchen]}, {name: "b", title: "B"}]))
            .rejects.toThrow(/Subfolder "a" lists categories in the manifest, which only adminAssetSettings\.json does/);
    });

    it("files each image under the categories the admin's settings give it, marked ahead of its own keywords, and refuses any that are no categories", async () => {
        const images = [{path: "a/1"}, {path: "a/2", keywords: "Kitchen, sink"}, {path: "a/3", disabled: true},
            {path: "a/4"}, {path: "b/1"}];
        const categoryTabsBySubfolder = {a: [{name: "kitchen", title: "Kitchen"}, {name: "office", title: "Office"}]};
        const filed = (categoriesBySubfolderAndIndex: unknown, shown: {path: string, keywords?: string}[] = images) =>
            build(shown, {testImageMap: {categoryTabsBySubfolder, orderedIndicesBySubfolder: {}, categoriesBySubfolderAndIndex}});
        const keywords = (built: string) => Object.fromEntries([...built.matchAll(/\{path:"([^"]+)",keywords:"([^"]*)"/g)]
            .map(match => [match[1], match[2]]));

        // An image they leave out is under none, and names what it did. A word a category already says is not said
        // twice. They may name what the map doesn't hold (a/3, a/9, c), and a category its subfolder doesn't list
        // (garden, and any under b), which is passed over.
        expect(keywords(await filed({a: {"1": ["office", "kitchen"], "2": ["kitchen", "garden"], "3": ["office"],
            "9": ["office"]}, b: {"1": ["kitchen"]}, c: {"1": ["office"]}})))
            .toEqual({"a/1": "office*,kitchen*,a/1", "a/2": "kitchen*,sink", "a/4": "a/4", "b/1": "b/1"});
        expect(keywords(await build(images))).toEqual({"a/1": "a/1", "a/2": "kitchen,sink", "a/4": "a/4", "b/1": "b/1"});

        // Only the settings mark a keyword as a category.
        await expect(filed({}, [{path: "a/1", keywords: "kitchen*, sink"}]))
            .rejects.toThrow(/Image "a\/1" marks its keyword "kitchen\*" as a category/);
        await expect(filed({a: ["kitchen"]})).rejects.toThrow(/other than image numbers under categories in "a"/);
        await expect(filed({a: {"01": ["kitchen"]}})).rejects.toThrow(/other than image numbers under categories in "a"/);
        await expect(filed({a: {"1": "kitchen"}})).rejects.toThrow(/files image 1 of "a" under something other than category names/);
        await expect(filed({a: {"1": ["Kitchen"]}})).rejects.toThrow(/files image 1 of "a" under something other than category names/);
        await expect(filed({a: {"1": ["kitchen", "office", "kitchen"]}})).rejects.toThrow(/files image 1 of "a" under "kitchen" twice/);
    });
});
