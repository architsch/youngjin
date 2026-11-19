/**
 * The picture preparation tool (dev/scripts/imagePrep): a thing cut out of its background by the masks a model finds
 * for it (found on the whole picture, then again up close from the first; crisp at the edge and the thing's own
 * color there; specks flipped and real openings left; parts that touch joined, a part dropped taken out, what was
 * see-through kept so; refused where the model finds nothing), a face seen at an angle squared up (to the shape
 * something round in its plane gives it, to an aspect given, or to its own sides), its corners read off a cut-out's
 * outline, room kept past it (see-through where the picture holds nothing, refused where it runs behind the viewer),
 * something round made round again where it stands and turned, a part painted over with surface from elsewhere (its
 * mirror across the middle, or a region named, shaded to match where it lands; or the surface beside it run across or
 * down it; see-through where its source is, past the picture's edge, each part in turn), one part kept (a rectangle,
 * rounded or not, or an ellipse), a cut-out's own colors carried under its transparency so no fringe is sampled in,
 * the strays of a rough cut-out dropped, the ellipse through points, orders that can't be carried out refused, and
 * the commands (a picture surveyed with a grid or read out as brightness cell by cell, a plan carried out to its
 * results and a contact sheet, a cut-out trimmed to what it kept and drawn over its source, each result fitted
 * within the largest size one may have or a smaller one asked for).
 * Upscaling and the model itself are not covered: they run programs fetched from elsewhere, and a stand-in finds the
 * masks here.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import RgbaImage from "../../../dev/scripts/imageMapEditor/core/rgbaImage";
import ImageProcessingUtil from "../../../dev/scripts/imageMapEditor/core/imageProcessingUtil";
import PrepOrder from "../../../dev/scripts/imagePrep/core/prepOrder";
import PrepCutOut from "../../../dev/scripts/imagePrep/core/prepCutOut";
import PrepRenderUtil from "../../../dev/scripts/imagePrep/core/prepRenderUtil";
import PlaneGeometryUtil from "../../../dev/scripts/imagePrep/core/planeGeometryUtil";
import CutoutUtil from "../../../dev/scripts/imagePrep/core/cutoutUtil";
import MaskUtil from "../../../dev/scripts/imagePrep/core/maskUtil";
import MaskFinder from "../../../dev/scripts/imagePrep/core/maskFinder";
import PrepCommands from "../../../dev/scripts/imagePrep/node/prepCommands";

type Point = [number, number];

// An image painted by a function of each pixel's middle.
function paint(width: number, height: number, color: (x: number, y: number) => [number, number, number, number]): RgbaImage
{
    const image = ImageProcessingUtil.createImage(width, height);
    for (let y = 0; y < height; ++y)
    {
        for (let x = 0; x < width; ++x)
            image.data.set(color(x + 0.5, y + 0.5), (y * width + x) * 4);
    }
    return image;
}

function pixel(image: RgbaImage, x: number, y: number): number[]
{
    const index = (Math.round(y) * image.width + Math.round(x)) * 4;
    return Array.from(image.data.subarray(index, index + 4));
}

// The smallest rectangle holding every pixel the test passes.
function boundsOf(image: RgbaImage, test: (r: number, g: number, b: number, a: number) => boolean):
    {x: number, y: number, width: number, height: number}
{
    let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
    for (let y = 0; y < image.height; ++y)
    {
        for (let x = 0; x < image.width; ++x)
        {
            const [r, g, b, a] = pixel(image, x, y);
            if (!test(r, g, b, a))
                continue;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    }
    return {x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1};
}

const isRed = (r: number, g: number, b: number, a: number) => a > 200 && r > 180 && g < 90 && b < 90;

function countRed(image: RgbaImage): number
{
    let count = 0;
    for (let i = 0; i < image.data.length; i += 4)
    {
        if (isRed(image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]))
            ++count;
    }
    return count;
}

// A flat face 300 by 200, with a red disc on it, seen by a camera tilted 50 degrees off its normal: the far side up.
// Around the face the picture is see-through, over white.
const SIZE = 400;
const FACE = {width: 300, height: 200};
const DISC = {x: 20, y: 10, radius: 40};
const TILT = 50 * Math.PI / 180, FOCAL = 500, DISTANCE = 600, MIDDLE: Point = [200, 190];

// From the face's own coordinates (about its middle) to the picture's pixels, and back.
function toPicture(x: number, y: number): Point
{
    const depth = DISTANCE - y * Math.sin(TILT);
    return [MIDDLE[0] + FOCAL * x / depth, MIDDLE[1] + FOCAL * y * Math.cos(TILT) / depth];
}

function toFace(x: number, y: number): Point
{
    const faceY = (y - MIDDLE[1]) * DISTANCE / (FOCAL * Math.cos(TILT) + (y - MIDDLE[1]) * Math.sin(TILT));
    return [(x - MIDDLE[0]) * (DISTANCE - faceY * Math.sin(TILT)) / FOCAL, faceY];
}

const tiltedFace = paint(SIZE, SIZE, (x, y) => {
    const [faceX, faceY] = toFace(x, y);
    if (Math.abs(faceX) > FACE.width / 2 || Math.abs(faceY) > FACE.height / 2)
        return [255, 255, 255, 0];
    return (Math.hypot(faceX - DISC.x, faceY - DISC.y) <= DISC.radius) ? [220, 40, 40, 255] : [128, 128, 128, 255];
});
const asFraction = ([x, y]: Point): Point => [x / SIZE, y / SIZE];
const faceCorners = ([[-150, -100], [150, -100], [150, 100], [-150, 100]] as Point[]).map(([x, y]) => asFraction(toPicture(x, y)));
const discOutline = Array.from({length: 8}, (_, i): Point => asFraction(toPicture(
    DISC.x + DISC.radius * Math.cos(i * Math.PI / 4), DISC.y + DISC.radius * Math.sin(i * Math.PI / 4))));

function order(overrides: Partial<PrepOrder>): PrepOrder
{
    return {source: "picture.png", ...overrides};
}

describe("squaring up a face", () => {
    it("gives it the shape that makes something round in its plane round again", () => {
        const {image} = PrepRenderUtil.render(tiltedFace, order({square: {corners: faceCorners, circle: discOutline}}));
        expect(image.width / image.height).toBeCloseTo(FACE.width / FACE.height, 1);
        // As sharp as the picture has the face's nearest side.
        expect(image.width).toBe(Math.round(toPicture(150, 100)[0] - toPicture(-150, 100)[0]));

        const disc = boundsOf(image, isRed);
        expect(Math.abs(disc.width - disc.height)).toBeLessThanOrEqual(2);
        expect(disc.width / image.width).toBeCloseTo(2 * DISC.radius / FACE.width, 1);
        expect((disc.x + disc.width / 2) / image.width).toBeCloseTo((DISC.x + FACE.width / 2) / FACE.width, 2);
        expect((disc.y + disc.height / 2) / image.height).toBeCloseTo((DISC.y + FACE.height / 2) / FACE.height, 2);
    });

    it("takes an aspect given, and otherwise the quad's own sides, which a steep view makes too wide", () => {
        const given = PrepRenderUtil.render(tiltedFace, order({square: {corners: faceCorners, aspect: 1.5}})).image;
        expect(given.width / given.height).toBeCloseTo(1.5, 1);
        const bySides = PrepRenderUtil.render(tiltedFace, order({square: {corners: faceCorners}}));
        expect(bySides.image.width / bySides.image.height).toBeGreaterThan(2);
        expect(bySides.notes[0]).toContain("by its sides");
    });

    it("reads a cut-out's corners off its outline, clear of whatever the stretches leave out", () => {
        const {notes} = PrepRenderUtil.render(tiltedFace, order({square: {
            sides: {left: [[0.38, 0.60]], right: [[0.38, 0.60]], top: [[0.30, 0.45], [0.55, 0.70]], bottom: [[0.20, 0.80]]}}}));
        const found = [...notes[0].matchAll(/\((-?[\d.]+), (-?[\d.]+)\)/g)].map(match => [Number(match[1]), Number(match[2])]);
        expect(found).toHaveLength(4);
        found.forEach(([x, y], i) => {
            expect(x).toBeCloseTo(faceCorners[i][0], 2);
            expect(y).toBeCloseTo(faceCorners[i][1], 2);
        });

        const opaque = paint(40, 40, () => [10, 20, 30, 255]);
        expect(() => PrepRenderUtil.render(opaque, order({square: {
            sides: {left: [[0.2, 0.8]], right: [[0.2, 0.8]], top: [[0.2, 0.8]], bottom: [[0.2, 0.8]]}}}))).toThrow(/cut-out/);
    });

    it("keeps room past the face, see-through where the picture holds nothing", () => {
        const plain = PrepRenderUtil.render(tiltedFace, order({square: {corners: faceCorners, aspect: 1.5}})).image;
        const roomy = PrepRenderUtil.render(tiltedFace,
            order({square: {corners: faceCorners, aspect: 1.5, extend: [0, 0.5, 0, 0]}})).image;
        expect(roomy.width).toBe(plain.width);
        expect(roomy.height).toBeCloseTo(plain.height * 1.5, -1);
        expect(pixel(roomy, roomy.width / 2, roomy.height * 0.1)[3]).toBe(0);
        expect(pixel(roomy, roomy.width / 2, roomy.height * 0.6)[3]).toBe(255);

        // Corners past an opaque picture's edges: its edge isn't carried on there.
        const opaque = paint(100, 100, () => [10, 20, 30, 255]);
        const past = PrepRenderUtil.render(opaque,
            order({square: {corners: [[-0.2, -0.2], [1.2, -0.2], [1.2, 1.2], [-0.2, 1.2]]}})).image;
        expect([past.width, past.height]).toEqual([140, 140]);
        expect(pixel(past, 2, 2)[3]).toBe(0);
        expect(pixel(past, 70, 70)).toEqual([10, 20, 30, 255]);
    });

    it("refuses room that runs on behind the viewer", () => {
        expect(() => PrepRenderUtil.render(tiltedFace,
            order({square: {corners: faceCorners, aspect: 1.5, extend: [0, 0, 0, 5]}}))).toThrow(/behind the viewer/);
    });
});

describe("making something round round again", () => {
    // A blue ellipse, its long axis 30 degrees clockwise of level, with a red dot toward that axis's end.
    const AXES = {major: 120, minor: 60, angle: Math.PI / 6};
    const onEllipse = (along: number, across: number): Point => [
        200 + along * Math.cos(AXES.angle) - across * Math.sin(AXES.angle),
        200 + along * Math.sin(AXES.angle) + across * Math.cos(AXES.angle)];
    const dot = onEllipse(0.75 * AXES.major, 0);
    const tiltedDisc = paint(SIZE, SIZE, (x, y) => {
        const dx = x - 200, dy = y - 200;
        const along = dx * Math.cos(AXES.angle) + dy * Math.sin(AXES.angle);
        const across = -dx * Math.sin(AXES.angle) + dy * Math.cos(AXES.angle);
        if ((along / AXES.major) ** 2 + (across / AXES.minor) ** 2 > 1)
            return [255, 255, 255, 0];
        return (Math.hypot(x - dot[0], y - dot[1]) <= 8) ? [220, 40, 40, 255] : [40, 60, 200, 255];
    });
    const outline = Array.from({length: 8}, (_, i): Point => asFraction(onEllipse(
        AXES.major * Math.cos(i * Math.PI / 4), AXES.minor * Math.sin(i * Math.PI / 4))));
    // Where the dot lies from the result's middle, in degrees clockwise of level.
    const dotDirection = (image: RgbaImage) => {
        const found = boundsOf(image, isRed);
        return Math.atan2(found.y + found.height / 2 - image.height / 2, found.x + found.width / 2 - image.width / 2) * 180 / Math.PI;
    };

    it("stretches it across its short axis where it stands, and cuts the picture to it", () => {
        const {image} = PrepRenderUtil.render(tiltedDisc, order({round: {outline}}));
        expect(Math.abs(image.width - 2 * AXES.major)).toBeLessThanOrEqual(3);
        expect(Math.abs(image.height - 2 * AXES.major)).toBeLessThanOrEqual(3);
        expect(pixel(image, 2, 2)[3]).toBe(0);
        expect(Math.abs(dotDirection(image) - 30)).toBeLessThan(3);
    });

    it("turns the result clockwise", () => {
        const {image} = PrepRenderUtil.render(tiltedDisc, order({round: {outline, turn: 60}}));
        expect(Math.abs(image.width - 2 * AXES.major)).toBeLessThanOrEqual(3);
        expect(Math.abs(dotDirection(image) - 90)).toBeLessThan(3);
    });
});

describe("painting a part over", () => {
    // A wall banded from top to bottom, with a red blot right of its middle.
    const band = (y: number) => 100 + 10 * Math.floor(y / 10);
    const inBlot = (x: number, y: number, top: number = 22) => x > 68 && x < 82 && y > top && y < top + 12;
    const overBlot = {shape: "rect" as const, rect: [0.62, 0.3, 0.26, 0.34] as [number, number, number, number]};

    it("brings in the same place across the middle, flipped, and leaves nothing of what was there", () => {
        // Lighter toward both sides alike.
        const wall = (x: number, y: number): [number, number, number, number] =>
            [band(y) + Math.floor(Math.abs(x - 50)), 90, 60, 255];
        const blotted = paint(100, 60, (x, y) => inBlot(x, y) ? [220, 40, 40, 255] : wall(x, y));
        const {image, notes} = PrepRenderUtil.render(blotted, order({cover: [{...overBlot, from: "mirror"}]}));
        expect(countRed(blotted)).toBeGreaterThan(100);
        expect(countRed(image)).toBe(0);
        expect(pixel(image, 75, 28)).toEqual(wall(75.5, 28.5));
        expect(pixel(image, 64, 28)).toEqual(wall(64.5, 28.5));
        expect(pixel(image, 30, 28)).toEqual(wall(30.5, 28.5));
        expect(notes[0]).toMatch(/^covered: rect .* from its mirror/);
    });

    it("brings in a region named, shaded to match where it lands", () => {
        // The left half lies in shade.
        const wall = (x: number, y: number): [number, number, number, number] => [band(y) - ((x < 50) ? 30 : 0), 90, 60, 255];
        const blotted = paint(100, 60, (x, y) => inBlot(x, y) ? [220, 40, 40, 255] : wall(x, y));
        const {image} = PrepRenderUtil.render(blotted, order({cover: [{...overBlot, from: [0.12, 0.3]}]}));
        expect(countRed(image)).toBe(0);
        // The bands carry on across it, as light as the wall around it and not as dark as where they came from.
        for (const y of [22, 28, 33])
            expect(Math.abs(pixel(image, 75, y)[0] - band(y + 0.5))).toBeLessThanOrEqual(2);
        expect(pixel(blotted, 25, 28)[0]).toBe(band(28.5) - 30);
    });

    it("runs a plain surface across it from either side, or down it, each line as it lies beside the part", () => {
        // Lighter toward the right, and banded from top to bottom.
        const wall = (x: number, y: number): [number, number, number, number] => [Math.floor(x) + band(y), 90, 60, 255];
        const blotted = paint(100, 60, (x, y) => inBlot(x, y) ? [220, 40, 40, 255] : wall(x, y));
        const across = PrepRenderUtil.render(blotted, order({cover: [{...overBlot, from: "across"}]}));
        expect(countRed(across.image)).toBe(0);
        for (const y of [25, 34])
            expect(Math.abs(pixel(across.image, 75, y)[0] - wall(75.5, y + 0.5)[0])).toBeLessThanOrEqual(2);
        expect(across.notes[0]).toMatch(/run across/);

        // The same wall on its side.
        const turned = paint(60, 100, (x, y) => inBlot(y, x) ? [220, 40, 40, 255] : wall(y, x));
        const down = PrepRenderUtil.render(turned, order({cover: [{shape: "rect", rect: [0.3, 0.62, 0.34, 0.26], from: "down"}]}));
        expect(countRed(down.image)).toBe(0);
        expect(Math.abs(pixel(down.image, 25, 75)[0] - wall(75.5, 25.5)[0])).toBeLessThanOrEqual(2);

        // With the picture's edge on one side, the other side's surface throughout.
        const atEdge = paint(100, 60, (x, y) => (x > 86 && y > 22 && y < 34) ? [220, 40, 40, 255] : wall(x, y));
        const oneSided = PrepRenderUtil.render(atEdge, order({cover: [{shape: "rect", rect: [0.8, 0.3, 0.3, 0.34], from: "across"}]}));
        expect(countRed(oneSided.image)).toBe(0);
        expect(Math.abs(pixel(oneSided.image, 95, 25)[0] - wall(79, 25.5)[0])).toBeLessThanOrEqual(2);
    });

    it("goes see-through where its source is, and may run past the picture's edge", () => {
        // The top-left corner is cut away; the top-right one holds a blot instead.
        const blotted = paint(100, 60, (x, y) => (x + y < 16) ? [255, 255, 255, 0]
            : (x > 88 && y < 10) ? [220, 40, 40, 255] : [120, 90, 60, 255]);
        const {image} = PrepRenderUtil.render(blotted,
            order({cover: [{shape: "rect", rect: [0.7, -0.1, 0.4, 0.6], from: "mirror"}]}));
        expect(countRed(image)).toBe(0);
        expect(pixel(image, 98, 2)[3]).toBe(0);
        expect(pixel(image, 80, 20)).toEqual([120, 90, 60, 255]);
        // Nothing of the white left under the corner's transparency shows along the new edge.
        for (let i = 0; i < image.data.length; i += 4)
        {
            if (image.data[i + 3] > 0)
                expect(image.data[i + 2]).toBeLessThan(100);
        }
    });

    it("paints each part in turn, so a later one draws on what an earlier one painted", () => {
        const wall = (x: number): [number, number, number, number] => [100 + Math.floor(Math.abs(x - 50)), 90, 60, 255];
        const twice = paint(100, 60, (x, y) => (inBlot(x, y, 8) || inBlot(x, y, 38)) ? [220, 40, 40, 255] : wall(x));
        const upper: [number, number, number, number] = [0.62, 0.06, 0.26, 0.34];
        const {image} = PrepRenderUtil.render(twice, order({cover: [
            {shape: "rect", rect: upper, from: "mirror"},
            {shape: "rect", rect: [0.62, 0.56, 0.26, 0.34], from: [upper[0], upper[1]]},
        ]}));
        expect(countRed(image)).toBe(0);
        expect(pixel(image, 75, 44)).toEqual(wall(75.5));
    });

    it("leaves what has no source in the picture, and says so", () => {
        const blotted = paint(100, 60, (x, y) => inBlot(x, y) ? [220, 40, 40, 255] : [120, 90, 60, 255]);
        const {image, notes} = PrepRenderUtil.render(blotted, order({cover: [{...overBlot, from: [1.2, 0.3]}]}));
        expect(countRed(image)).toBe(countRed(blotted));
        expect(notes[0]).toMatch(/pixels had no source in the picture/);
    });
});

describe("keeping one part", () => {
    const gradient = paint(100, 100, (x, y) => [Math.floor(x), Math.floor(y), 0, 255]);

    it("cuts the result to it, see-through outside an ellipse or a rectangle's rounded corners", () => {
        const ellipse = PrepRenderUtil.render(gradient, order({keep: {shape: "ellipse", rect: [0.25, 0.25, 0.5, 0.5]}})).image;
        expect([ellipse.width, ellipse.height]).toEqual([50, 50]);
        expect(pixel(ellipse, 0, 0)[3]).toBe(0);
        expect(pixel(ellipse, 25, 25)).toEqual([50, 50, 0, 255]);

        const rect = PrepRenderUtil.render(gradient, order({keep: {shape: "rect", rect: [0.25, 0.25, 0.5, 0.5]}})).image;
        expect(pixel(rect, 0, 0)).toEqual([25, 25, 0, 255]);
        const rounded = PrepRenderUtil.render(gradient,
            order({keep: {shape: "rect", rect: [0.25, 0.25, 0.5, 0.5], radius: 0.5}})).image;
        expect(pixel(rounded, 0, 0)[3]).toBe(0);
        expect(pixel(rounded, 25, 0)[3]).toBe(255);
    });

    it("is placed in the picture as re-mapped", () => {
        // The disc's own square of the squared face.
        const side = 2 * DISC.radius;
        const whole = PrepRenderUtil.render(tiltedFace, order({square: {corners: faceCorners, aspect: 1.5}})).image;
        const {image} = PrepRenderUtil.render(tiltedFace, order({
            square: {corners: faceCorners, aspect: 1.5},
            keep: {shape: "ellipse", rect: [(DISC.x - DISC.radius + 150) / 300, (DISC.y - DISC.radius + 100) / 200, side / 300, side / 200]},
        }));
        expect(Math.abs(image.width - whole.width * side / 300)).toBeLessThanOrEqual(1);
        expect(Math.abs(image.height - image.width)).toBeLessThanOrEqual(1);
        expect(isRed(...pixel(image, image.width / 2, image.height / 2) as [number, number, number, number])).toBe(true);
        expect(pixel(image, 0, 0)[3]).toBe(0);
    });
});

describe("a cut-out's edge", () => {
    // A red square, see-through around it over the white its background was.
    const cutOut = paint(60, 60, (x, y) => (x > 20 && x < 40 && y > 20 && y < 40) ? [220, 40, 40, 255] : [255, 255, 255, 0]);

    it("is sampled over the object's own colors, so no pale fringe is blended in", () => {
        // Half a pixel off, so every pixel of the result blends four of the picture's.
        const shifted: Point[] = [[0.5 / 60, 0.5 / 60], [60.5 / 60, 0.5 / 60], [60.5 / 60, 60.5 / 60], [0.5 / 60, 60.5 / 60]];
        const {image} = PrepRenderUtil.render(cutOut, order({square: {corners: shifted}}));
        let edgePixels = 0;
        for (let i = 0; i < image.data.length; i += 4)
        {
            if (image.data[i + 3] == 0)
                continue;
            if (image.data[i + 3] < 255)
                ++edgePixels;
            expect(image.data[i + 1]).toBeLessThan(60);
        }
        expect(edgePixels).toBeGreaterThan(0);
    });

    it("has its colors carried as far as asked and no further, its alpha left alone", () => {
        const carried = ImageProcessingUtil.copyImage(cutOut);
        CutoutUtil.carryColors(carried, 2);
        expect(pixel(carried, 19, 30)).toEqual([220, 40, 40, 0]);
        expect(pixel(carried, 18, 30)).toEqual([220, 40, 40, 0]);
        expect(pixel(carried, 17, 30)).toEqual([255, 255, 255, 0]);
        expect(pixel(carried, 30, 30)).toEqual([220, 40, 40, 255]);

        // A faint pixel beside the object is given its color too, unless it is opaque enough to count as the object's.
        const withFaint = () => {
            const image = ImageProcessingUtil.copyImage(cutOut);
            image.data.set([10, 200, 10, 40], (30 * 60 + 19) * 4);
            return image;
        };
        const recolored = withFaint();
        CutoutUtil.carryColors(recolored, 2);
        expect(pixel(recolored, 19, 30)).toEqual([220, 40, 40, 40]);
        const left = withFaint();
        CutoutUtil.carryColors(left, 2, 16);
        expect(pixel(left, 19, 30)).toEqual([10, 200, 10, 40]);
    });

    it("loses the strays of a rough cut, and keeps every piece of some size and the haze along it", () => {
        const rough = paint(100, 60, (x, y) => {
            const inPiece = (left: number) => x > left && x < left + 20 && y > 20 && y < 40;
            if (inPiece(10) || inPiece(60))
                return [0, 0, 0, 255];
            if (x > 45 && x < 47 && y > 5 && y < 7)
                return [0, 0, 0, 255];
            // Haze: one pixel beside a piece, one away from everything.
            return ((x > 30 && x < 31 && y > 30 && y < 31) || (x > 50 && x < 51 && y > 50 && y < 51)) ? [0, 0, 0, 40] : [0, 0, 0, 0];
        });
        expect(CutoutUtil.dropStrays(rough)).toBe(5);
        expect(pixel(rough, 20, 30)[3]).toBe(255);
        expect(pixel(rough, 70, 30)[3]).toBe(255);
        expect(pixel(rough, 30, 30)[3]).toBe(40);
        expect(pixel(rough, 45, 5)[3]).toBe(0);
        expect(pixel(rough, 50, 50)[3]).toBe(0);
        expect(CutoutUtil.getBounds(rough)).toEqual({x: 10, y: 20, width: 70, height: 20});
    });
});

// A green wall with a red disc on it, two blue slabs that meet at 500 (a yellow dot on the left one), and a third
// slab standing apart. Each shape tells how far inside it a position lies, in pixels; below zero outside it.
type Shape = (x: number, y: number) => number;
type Call = {frame: number[], part: PrepCutOut, guess?: Float32Array};
const WALL = {width: 1000, height: 600};
const inDisc: Shape = (x, y) => 70 - Math.hypot(x - 100, y - 300);
const inDot: Shape = (x, y) => 40 - Math.hypot(x - 350, y - 300);
const inSlab = (left: number, right: number): Shape => (x, y) => Math.min(x - left, right - x, y - 150, 450 - y);
const wall = paint(WALL.width, WALL.height, (x, y) => (inDisc(x, y) > 0) ? [220, 40, 40, 255]
    : (inDot(x, y) > 0) ? [230, 220, 40, 255]
    : (inSlab(200, 800)(x, y) > 0 || inSlab(830, 900)(x, y) > 0) ? [40, 60, 200, 255] : [20, 200, 20, 255]);

// Stands in for the model: the mask of the first shape that the part's first point (or its rect's middle) lies in,
// on a grid 64 cells a side, as steep across the shape's edge as the model's are. calls takes down what was asked.
const GRID = 64;
function findAmong(shapes: Shape[], calls: Call[] = []): MaskFinder
{
    return async (picture, frame, part, guess) => {
        calls.push({frame, part, guess});
        const [left, top, width, height] = frame;
        const [x, y] = part.on?.[0] ?? [part.rect![0] + part.rect![2] / 2, part.rect![1] + part.rect![3] / 2];
        const shape = shapes.find(candidate => candidate(x * picture.width, y * picture.height) > 0);
        const logits = new Float32Array(GRID * GRID).fill(-20);
        const cell = Math.max(width, height) / GRID;
        for (let row = 0; shape != undefined && row < GRID; ++row)
        {
            for (let column = 0; column < GRID; ++column)
            {
                const depth = shape(left + (column + 0.5) / GRID * width, top + (row + 0.5) / GRID * height);
                logits[row * GRID + column] = Math.max(-20, Math.min(20, 12 * depth / cell));
            }
        }
        return {logits, score: 0.97};
    };
}

describe("cutting a thing out", () => {
    const onDisc: PrepCutOut = {on: [[0.1, 0.5]]};

    it("keeps the thing and nothing else, crisp at its edge and its own color there", async () => {
        const {image, notes} = await MaskUtil.cutOut(wall, [onDisc], findAmong([inDisc]));
        expect([image.width, image.height]).toEqual([WALL.width, WALL.height]);
        expect(pixel(image, 100, 300)).toEqual([220, 40, 40, 255]);
        expect(pixel(image, 165, 300)[3]).toBe(255);
        expect(pixel(image, 175, 300)).toEqual([0, 0, 0, 0]);
        expect(pixel(image, 500, 50)).toEqual([0, 0, 0, 0]);

        // Across the disc's edge, which lies at 170: see-through within a pixel of it, over a few pixels at most.
        const row = Array.from({length: 30}, (_, i) => pixel(image, 155 + i, 300)[3]);
        expect(row.filter(alpha => alpha > 0 && alpha < 255).length).toBeLessThanOrEqual(3);
        expect(Math.abs(155 + row.findIndex(alpha => alpha < 128) - 170)).toBeLessThanOrEqual(1);
        // Nothing of the wall's green shows, and the disc's red is carried under the edge.
        for (let i = 0; i < image.data.length; i += 4)
        {
            if (image.data[i + 3] > 0)
                expect(image.data[i + 1]).toBeLessThan(60);
        }
        expect(pixel(image, 155 + row.indexOf(0), 300)).toEqual([220, 40, 40, 0]);
        expect(notes).toHaveLength(1);
        expect(notes[0]).toMatch(/^cut out: part 1 at x 0\.0\d\d-0\.1\d\d, y 0\.3\d\d-0\.6\d\d, scored 0\.97, \d+% of it faint$/);
    });

    it("is found on the whole picture, then again up close from what was found there", async () => {
        const calls: Call[] = [];
        await MaskUtil.cutOut(wall, [onDisc], findAmong([inDisc], calls));
        expect(calls).toHaveLength(2);
        expect(calls[0].frame).toEqual([0, 0, WALL.width, WALL.height]);
        expect(calls[0].guess).toBeUndefined();
        // The disc, which reaches from 30 to 170 across and from 230 to 370 down, with some room around it.
        const [left, top, width, height] = calls[1].frame;
        expect(left).toBeGreaterThan(0);
        expect(left).toBeLessThan(30);
        expect(top).toBeGreaterThan(150);
        expect(top).toBeLessThan(230);
        expect(left + width).toBeGreaterThan(170);
        expect(left + width).toBeLessThan(260);
        expect(top + height).toBeGreaterThan(370);
        expect(top + height).toBeLessThan(450);
        expect(calls[1].part).toBe(onDisc);
        const guess = calls[1].guess!;
        expect(guess).toHaveLength(GRID * GRID);
        expect(guess[GRID / 2 * GRID + GRID / 2]).toBeGreaterThan(0);
        expect(guess[0]).toBeLessThan(0);

        // A thing that fills the picture is looked at once.
        const once: Call[] = [];
        await MaskUtil.cutOut(wall, [{rect: [0.01, 0.01, 0.98, 0.98]}],
            findAmong([(x, y) => Math.min(x - 20, 980 - x, y - 15, 585 - y)], once));
        expect(once).toHaveLength(1);
    });

    it("loses the specks the model leaves, and keeps an opening of some size", async () => {
        // In every mask, a cell is missing from the disc's middle and one is kept far from it.
        const calls: Call[] = [];
        const clean = findAmong([inDisc], calls);
        const specked: MaskFinder = async (picture, frame, part, guess) => {
            const found = await clean(picture, frame, part, guess);
            const [left, top, width, height] = frame;
            found.logits[Math.floor((300 - top) / height * GRID) * GRID + Math.floor((100 - left) / width * GRID)] = -5;
            found.logits[GRID + 1] = 5;
            return found;
        };
        const {image} = await MaskUtil.cutOut(wall, [onDisc], specked);
        expect(pixel(image, 100, 300)[3]).toBe(255);
        // The closer look wasn't widened to take the far speck in, and it left nothing there either.
        const [left, top, width, height] = calls[1].frame;
        expect(top).toBeGreaterThan(150);
        expect(pixel(image, left + 1.5 / GRID * width, top + 1.5 / GRID * height)[3]).toBe(0);

        const inRing: Shape = (x, y) => Math.min(inDisc(x, y), Math.hypot(x - 100, y - 300) - 35);
        const ring = (await MaskUtil.cutOut(wall, [{on: [[0.152, 0.5]]}], findAmong([inRing]))).image;
        expect(pixel(ring, 152, 300)[3]).toBe(255);
        expect(pixel(ring, 100, 300)[3]).toBe(0);
    });

    it("joins parts that touch, leaves apart those that don't, and takes a dropped part out", async () => {
        // Each slab's mask stops a pixel short of where the two meet.
        const calls: Call[] = [];
        const {image, notes} = await MaskUtil.cutOut(wall,
            [{on: [[0.25, 0.33]]}, {on: [[0.65, 0.5]]}, {on: [[0.35, 0.5]], drop: true}, {on: [[0.865, 0.5]]}],
            findAmong([inDot, inSlab(200, 499), inSlab(501, 800), inSlab(830, 900)], calls));
        expect(calls).toHaveLength(8);
        for (const y of [160, 300, 440])
        {
            for (const x of [498, 499, 500, 501])
                expect(pixel(image, x, y)[3]).toBe(255);
        }
        expect(pixel(image, 350, 200)[3]).toBe(255);
        expect(pixel(image, 650, 300)[3]).toBe(255);
        expect(pixel(image, 865, 300)[3]).toBe(255);
        expect(pixel(image, 815, 300)[3]).toBe(0);
        expect(pixel(image, 350, 300)[3]).toBe(0);
        expect(pixel(image, 100, 300)[3]).toBe(0);
        expect(notes[2]).toMatch(/^cut out: part 3, dropped, at x /);
    });

    it("is refused where the model finds nothing, and leaves see-through what was so", async () => {
        await expect(MaskUtil.cutOut(wall, [onDisc, {on: [[0.5, 0.05]]}], findAmong([inDisc])))
            .rejects.toThrow(/found nothing for part 2/);

        const holed = ImageProcessingUtil.copyImage(wall);
        for (let y = 0; y < WALL.height; ++y)
        {
            for (let x = 100; x < 110; ++x)
                holed.data[(y * WALL.width + x) * 4 + 3] = 0;
        }
        const {image} = await MaskUtil.cutOut(holed, [onDisc], findAmong([inDisc]));
        expect(pixel(image, 105, 300)[3]).toBe(0);
        expect(pixel(image, 120, 300)[3]).toBe(255);
    });
});

describe("the ellipse through points", () => {
    it("is found whatever its turn, from five points or more", () => {
        const points = Array.from({length: 6}, (_, i): Point => {
            const along = 80 * Math.cos(i), across = 30 * Math.sin(i);
            return [300 + along * Math.cos(2) - across * Math.sin(2), 150 + along * Math.sin(2) + across * Math.cos(2)];
        });
        const ellipse = PlaneGeometryUtil.fitEllipse(points);
        expect(ellipse.center[0]).toBeCloseTo(300, 4);
        expect(ellipse.center[1]).toBeCloseTo(150, 4);
        expect(ellipse.major).toBeCloseTo(80, 4);
        expect(ellipse.minor).toBeCloseTo(30, 4);
        // The long axis's direction, either way along it.
        expect(Math.abs(Math.sin(ellipse.angle - 2))).toBeLessThan(1e-6);
    });

    it("is refused for points on another curve, or too few", () => {
        const parabola = [-2, -1, 0, 1, 2, 3].map((x): Point => [x, x * x]);
        expect(() => PlaneGeometryUtil.fitEllipse(parabola)).toThrow(/don't lie on an ellipse/);
        expect(() => PlaneGeometryUtil.fitEllipse(parabola.slice(0, 4))).toThrow(/five points/);
    });
});

describe("an order that can't be carried out", () => {
    const corners: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const outline: Point[] = [[0.5, 0.1], [0.9, 0.5], [0.5, 0.9], [0.1, 0.5], [0.8, 0.2]];
    const sides = {left: [[0.2, 0.8]], right: [[0.2, 0.8]], top: [[0.2, 0.8]], bottom: [[0.2, 0.8]]} as NonNullable<PrepOrder["square"]>["sides"];

    it("is refused, saying what is wrong with it", () => {
        const refusals: [Partial<PrepOrder>, RegExp][] = [
            [{source: ""}, /names no source/],
            [{name: "a/b"}, /plain file name/],
            [{cutOut: {} as never}, /list of parts/],
            [{cutOut: []}, /list of parts/],
            [{cutOut: [{}]}, /a rect around the thing, points on it, or both/],
            [{cutOut: [{on: [[1.2, 0.5]]}]}, /positions on the picture/],
            [{cutOut: [{on: [[0.5, 0.5]], off: [[0.5]] as never}]}, /positions on the picture/],
            [{cutOut: [{rect: [0.5, 0.5, 0.6, 0.2]}]}, /within the picture/],
            [{cutOut: [{rect: [0.1, 0.1, 0.2, 0.2], on: [[0.5, 0.5]]}]}, /within the rect around it/],
            [{cutOut: [{on: [[0.5, 0.5]], drop: true}]}, /nothing is there yet to drop it from/],
            [{square: {corners}, round: {outline}}, /one of the two/],
            [{square: {}}, /corners or sides/],
            [{square: {corners, sides}}, /corners or sides/],
            [{square: {corners: corners.slice(0, 3)}}, /four corners/],
            [{square: {corners: [[0, 0], [5, 0], [5, 1], [0, 1]]}}, /four corners/],
            [{square: {sides: {...sides!, top: [[0.8, 0.2]]}}}, /top side/],
            [{square: {corners, aspect: 1.5, circle: outline}}, /aspect or a circle/],
            [{square: {corners, aspect: 0}}, /width over its height/],
            [{square: {corners, circle: outline.slice(0, 4)}}, /five points/],
            [{square: {corners, extend: [0, -0.1, 0, 0]}}, /none below zero/],
            [{round: {outline: outline.slice(0, 4)}}, /five points/],
            [{cover: {} as never}, /list of parts/],
            [{cover: [{shape: "star" as never, rect: [0.6, 0.1, 0.2, 0.2], from: "mirror"}]}, /a rect or an ellipse/],
            [{cover: [{shape: "rect", rect: [0.6, 0.1, 0, 0.2], from: "mirror"}]}, /x, y, width and height/],
            [{cover: [{shape: "rect", rect: [0.4, 0.1, 0.2, 0.2], from: "mirror"}]}, /one side of the picture's middle/],
            [{cover: [{shape: "rect", rect: [0.6, 0.1, 0.2, 0.2], from: [0.5, 0.2]}]}, /its source lies over it/],
            [{cover: [{shape: "rect", rect: [0.6, 0.1, 0.2, 0.2]} as never]}, /from "mirror"/],
            [{keep: {shape: "rect", rect: [0.5, 0.5, 0.6, 0.2]}}, /within the re-mapped picture/],
            [{maxSide: 0}, /number of pixels/],
            [{maxSide: 513}, /512 at most/],
        ];
        for (const [overrides, message] of refusals)
            expect(() => PrepRenderUtil.validate(order(overrides))).toThrow(message);
        expect(() => PrepRenderUtil.validate(order({square: {sides}, keep: {shape: "ellipse", rect: [0, 0, 1, 1]}}))).not.toThrow();
        expect(() => PrepRenderUtil.validate(order({cutOut: [
            {rect: [0.1, 0.1, 0.4, 0.4], on: [[0.3, 0.3]], off: [[0.9, 0.9]]}, {on: [[0.3, 0.3]], drop: true}]}))).not.toThrow();
    });
});

describe("the preparation commands", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    const encode = (image: RgbaImage) => sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length),
        {raw: {width: image.width, height: image.height, channels: 4}}).png();

    it("survey a picture, or a part of it, with a grid at a size to plan by, and read its brightness out cell by cell", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "image-prep-"));
        try
        {
            fs.mkdirSync(path.join(dir, "pictures"));
            await encode(paint(300, 200, () => [20, 80, 140, 255])).toFile(path.join(dir, "pictures/wall.png"));
            const workDir = path.join(dir, "work");

            const [whole, part] = await PrepCommands.writeSurveys(dir, workDir, ["pictures/wall.png", "pictures/wall.png:0.5,0.5,0.25,0.5"]);
            expect(path.relative(workDir, whole)).toBe(path.join("survey", "pictures_wall.jpg"));
            expect(await sharp(whole).metadata()).toMatchObject({width: 1600, height: 1067});
            expect(path.basename(part)).toBe("pictures_wall_0.500_0.500_0.250_0.500.jpg");
            // 75 by 100 pixels of the picture.
            expect(await sharp(part).metadata()).toMatchObject({width: 1200, height: 1600});
            await expect(PrepCommands.writeSurveys(dir, workDir, ["pictures/none.png"])).rejects.toThrow(/not a file/);

            // Read out in numbers: lighter toward the right, and see-through over its top quarter.
            await encode(paint(160, 120, (x, y) => [Math.floor(x), Math.floor(x), Math.floor(x), (y < 30) ? 0 : 255]))
                .toFile(path.join(dir, "pictures/shaded.png"));
            const lines = await PrepCommands.printShades(dir, ["pictures/shaded.png"]);
            expect(lines[0]).toContain("pictures/shaded.png: 160x120");
            expect(lines).toHaveLength(14);
            expect(lines[2].trim().split(/\s+/).slice(2)).toEqual(new Array(16).fill("-"));
            expect(lines[13].trim().split(/\s+/).slice(2).map(Number)).toEqual(
                Array.from({length: 16}, (_, i) => Math.round(i * 10 + 4.5)));
            const quarter = (await PrepCommands.printShades(dir, ["pictures/shaded.png:0.5,0.5,0.5,0.5"]))[13];
            expect(Number(quarter.trim().split(/\s+/)[2])).toBe(82);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("carry out a plan to its results and a contact sheet, all under the work directory, replacing only results of their own", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "image-prep-"));
        try
        {
            await encode(tiltedFace).toFile(path.join(dir, "face.png"));
            const workDir = path.join(dir, "work");
            const planPath = path.join(dir, "plan.json");
            const writePlan = (orders: PrepOrder[]) => fs.writeFileSync(planPath, JSON.stringify(orders));

            writePlan([
                {source: "face.png", tidy: true, square: {corners: faceCorners, circle: discOutline}},
                {source: "face.png", name: "disc", square: {corners: faceCorners, aspect: 1.5},
                    keep: {shape: "ellipse", rect: [0.3, 0.15, 0.5333, 0.8]}, maxSide: 64},
            ]);
            const written = await PrepCommands.run(dir, workDir, planPath);
            expect(written.map(file => path.relative(workDir, file))).toEqual([path.join("out", "face.png"), path.join("out", "disc.png")]);
            const face = await sharp(written[0]).metadata();
            expect(face.width! / face.height!).toBeCloseTo(1.5, 1);
            expect(await sharp(written[1]).metadata()).toMatchObject({width: 64, height: 64, hasAlpha: true});
            expect(fs.existsSync(path.join(workDir, "contact_sheet.png"))).toBe(true);
            // Nothing is written beside the plan or the picture.
            expect(fs.readdirSync(dir).sort()).toEqual(["face.png", "plan.json", "work"]);

            // Its own results are replaced by a second run; a file put among them by hand, or one of them changed
            // since, is not, and nothing else of that run is written either.
            await PrepCommands.run(dir, workDir, planPath);
            const byHand = Buffer.from("a finished picture kept here by hand");
            fs.writeFileSync(path.join(workDir, "out", "mine.png"), byHand);
            const disc = fs.readFileSync(written[1]);
            writePlan([{source: "face.png", name: "disc"}, {source: "face.png", name: "mine"}]);
            await expect(PrepCommands.run(dir, workDir, planPath)).rejects.toThrow(/"mine": .*not as this tool wrote it/);
            expect(fs.readFileSync(path.join(workDir, "out", "mine.png"))).toEqual(byHand);
            expect(fs.readFileSync(written[1])).toEqual(disc);
            fs.writeFileSync(written[1], byHand);
            writePlan([{source: "face.png", name: "disc"}]);
            await expect(PrepCommands.run(dir, workDir, planPath)).rejects.toThrow(/"disc": .*not as this tool wrote it/);
            expect(fs.readFileSync(written[1])).toEqual(byHand);

            writePlan([{source: "face.png"}, {source: "face.png"}]);
            await expect(PrepCommands.run(dir, workDir, planPath)).rejects.toThrow(/both be written as "face"/);
            writePlan([{source: "face.png", name: "slanted", square: {corners: faceCorners, aspect: 99}}]);
            await expect(PrepCommands.run(dir, workDir, planPath)).rejects.toThrow(/"slanted": the aspect/);
            writePlan([{source: "none.png"}]);
            await expect(PrepCommands.run(dir, workDir, planPath)).rejects.toThrow(/"none": none.png is not a file/);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("cut a thing out, trim the result to it, and draw the cut-out over its source, all under the work directory", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "image-prep-"));
        try
        {
            await encode(wall).toFile(path.join(dir, "wall.png"));
            const workDir = path.join(dir, "work");
            const planPath = path.join(dir, "plan.json");
            fs.writeFileSync(planPath, JSON.stringify([
                {source: "wall.png", name: "disc", cutOut: [{on: [[0.1, 0.5]]}]},
                {source: "wall.png", name: "small", cutOut: [{on: [[0.1, 0.5]]}], tidy: true, maxSide: 70},
            ]));
            const [disc, small] = await PrepCommands.run(dir, workDir, planPath, findAmong([inDisc]));
            expect(path.relative(workDir, disc)).toBe(path.join("out", "disc.png"));
            // The disc alone, 140 across, and not the wall it stood on.
            const {width, height, hasAlpha} = await sharp(disc).metadata();
            expect(Math.abs(width! - 140)).toBeLessThanOrEqual(3);
            expect(Math.abs(height! - 140)).toBeLessThanOrEqual(3);
            expect(hasAlpha).toBe(true);
            expect(await sharp(small).metadata()).toMatchObject({width: 70, height: 70});

            // Over its source: the whole picture to survey parts of, and a survey of what was kept.
            expect(await sharp(path.join(workDir, "cut_out", "disc.jpg")).metadata()).toMatchObject({width: 1000, height: 600});
            expect((await sharp(path.join(workDir, "survey", "disc_cut_out.jpg")).metadata()).width).toBe(1600);
            expect(fs.readdirSync(dir).sort()).toEqual(["plan.json", "wall.png", "work"]);
            const printed = vi.mocked(console.log).mock.calls.flat().join("\n");
            expect(printed).toMatch(/cut out: part 1 at x 0\.0\d\d-0\.1\d\d/);
            expect(printed).toMatch(/trimmed: 14\dx14\d/);

            fs.writeFileSync(planPath, JSON.stringify([{source: "wall.png", name: "none", cutOut: [{on: [[0.5, 0.05]]}]}]));
            await expect(PrepCommands.run(dir, workDir, planPath, findAmong([inDisc])))
                .rejects.toThrow(/"none": the model found nothing for part 1/);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    it("fit a result within the largest size one may have, or a smaller one asked for, keeping a cut-out's edge its own color", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "image-prep-"));
        try
        {
            // A red slab, see-through around it over the white its background was.
            const slab = paint(1200, 600, (x, y) => (x > 150 && x < 1050 && y > 100 && y < 500) ? [220, 40, 40, 255] : [255, 255, 255, 0]);
            await encode(slab).toFile(path.join(dir, "slab.png"));
            const workDir = path.join(dir, "work");
            const planPath = path.join(dir, "plan.json");
            fs.writeFileSync(planPath, JSON.stringify([
                {source: "slab.png"},
                {source: "slab.png", name: "small", maxSide: 100},
                {source: "slab.png", name: "part", keep: {shape: "rect", rect: [0.25, 0.25, 0.25, 0.5]}},
            ]));
            const [whole, small, part] = await PrepCommands.run(dir, workDir, planPath);
            expect(await sharp(whole).metadata()).toMatchObject({width: 512, height: 256, hasAlpha: true});
            expect(await sharp(small).metadata()).toMatchObject({width: 100, height: 50});
            // One within the size already is written as it came out.
            expect(await sharp(part).metadata()).toMatchObject({width: 300, height: 300});
            expect(vi.mocked(console.log).mock.calls.flat().join("\n")).toContain("fitted: 1200x600 within 512 px");

            const {data, info} = await sharp(whole).raw().toBuffer({resolveWithObject: true});
            const fitted: RgbaImage = {width: info.width, height: info.height, data: new Uint8ClampedArray(data)};
            // Nothing of the white is blended into the slab's edge, whose left side falls at 64.
            let edgePixels = 0;
            for (let i = 0; i < fitted.data.length; i += 4)
            {
                if (fitted.data[i + 3] == 0)
                    continue;
                if (fitted.data[i + 3] < 255)
                    ++edgePixels;
                expect(fitted.data[i + 1]).toBeLessThan(60);
            }
            expect(edgePixels).toBeGreaterThan(0);
            expect(pixel(fitted, 80, 128)).toEqual([220, 40, 40, 255]);
            // Its own red lies under the transparency beside it, for whatever samples the result next: carried there,
            // and given to a pixel too faint to have kept a color of its own. No further out than that.
            for (const x of [61, 62])
            {
                const beside = pixel(fitted, x, 128);
                expect(beside[3]).toBeLessThan(16);
                beside.slice(0, 3).forEach((value, channel) => expect(Math.abs(value - [220, 40, 40][channel])).toBeLessThanOrEqual(4));
            }
            expect(pixel(fitted, 30, 128)).toEqual([0, 0, 0, 0]);
        }
        finally
        {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });
});
