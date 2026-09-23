/**
 * Label atlas and lettering: TextureAtlasAllocator (regions of a texture handed out and taken back, and the
 * guarantee that a room's labels always fit once packed largest first), and LabelTextLayoutUtil (fitting
 * text to a label, or cutting it off at a fixed size).
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import TextureAtlasAllocator from "../../../src/client/graphics/types/textureAtlasAllocator";
import TextureAtlasRegion from "../../../src/client/graphics/types/textureAtlasRegion";
import LabelTextLayoutUtil from "../../../src/client/object/util/labelTextLayoutUtil";
import ObjectCategoryConfigMap from "../../../src/shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import LabelObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import { LABEL_ATLAS_CELL_SIZE, LABEL_ATLAS_CELL_WORLD_SIZE, LABEL_ATLAS_SIZE } from "../../../src/shared/system/sharedConstants";

const NUM_CELLS_PER_SIDE = LABEL_ATLAS_SIZE / LABEL_ATLAS_CELL_SIZE;

// As LabelText sizes a region: whole cells, a hair under so an exact fit isn't rounded up.
const toCells = (worldSize: number) => Math.max(1, Math.ceil(worldSize / LABEL_ATLAS_CELL_WORLD_SIZE - 1e-6));

function overlaps(a: TextureAtlasRegion, b: TextureAtlasRegion): boolean
{
    return a.col < b.col + b.numCols && b.col < a.col + a.numCols
        && a.row < b.row + b.numRows && b.row < a.row + a.numRows;
}

function expectDisjointAndInside(regions: TextureAtlasRegion[], allocator: TextureAtlasAllocator)
{
    for (let i = 0; i < regions.length; ++i)
    {
        const r = regions[i];
        expect(r.col).toBeGreaterThanOrEqual(0);
        expect(r.row).toBeGreaterThanOrEqual(0);
        expect(r.col + r.numCols).toBeLessThanOrEqual(allocator.numCols);
        expect(r.row + r.numRows).toBeLessThanOrEqual(allocator.numRows);
        for (let j = i + 1; j < regions.length; ++j)
            expect(overlaps(r, regions[j]), "two regions share a cell").toBe(false);
    }
    const takenCells = regions.reduce((sum, r) => sum + r.numCols * r.numRows, 0);
    expect(allocator.getNumFreeCells()).toBe(allocator.numCols * allocator.numRows - takenCells);
}

// Largest first into an empty atlas, as LabelText packs when an allocation fails.
function packLargestFirst(sizes: {numCols: number, numRows: number}[]): (TextureAtlasRegion | undefined)[]
{
    const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
    return [...sizes]
        .sort((a, b) => b.numCols * b.numRows - a.numCols * a.numRows)
        .map(size => allocator.allocate(size.numCols, size.numRows));
}

describe("label atlas allocation", () => {
    const anySize = fc.record({numCols: fc.integer({min: 1, max: 7}), numRows: fc.integer({min: 1, max: 7})});
    const anyOperation = fc.oneof(
        anySize.map(size => ({kind: "allocate" as const, ...size})),
        fc.nat().map(pick => ({kind: "free" as const, pick})));

    it("never hands out a cell twice, or one outside the atlas, however regions come and go", () => {
        fc.assert(fc.property(fc.array(anyOperation, {maxLength: 150}), (operations) => {
            const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
            const live: TextureAtlasRegion[] = [];
            for (const operation of operations)
            {
                if (operation.kind == "allocate")
                {
                    const region = allocator.allocate(operation.numCols, operation.numRows);
                    if (region != undefined)
                    {
                        expect(region.numCols).toBe(operation.numCols);
                        expect(region.numRows).toBe(operation.numRows);
                        live.push(region);
                    }
                }
                else if (live.length > 0)
                {
                    allocator.free(live.splice(operation.pick % live.length, 1)[0]);
                }
            }
            expectDisjointAndInside(live, allocator);
        }), {numRuns: 200});
    });

    it("hands out a freed region again once the atlas is full", () => {
        const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
        const cells: TextureAtlasRegion[] = [];
        for (let i = 0; i < NUM_CELLS_PER_SIDE * NUM_CELLS_PER_SIDE; ++i)
            cells.push(allocator.allocate(1, 1)!);
        expect(allocator.allocate(1, 1)).toBeUndefined();

        allocator.free(cells[137]);
        expect(allocator.allocate(1, 1)).toEqual(cells[137]);
    });

    it("refuses a region larger than the atlas, or one of no size", () => {
        const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
        expect(allocator.allocate(NUM_CELLS_PER_SIDE + 1, 1)).toBeUndefined();
        expect(allocator.allocate(0, 3)).toBeUndefined();
        expect(allocator.getNumFreeCells()).toBe(NUM_CELLS_PER_SIDE * NUM_CELLS_PER_SIDE);
    });

    it("packs equal squares edge to edge from the corner", () => {
        const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
        const first = allocator.allocate(4, 4)!;
        const second = allocator.allocate(4, 4)!;
        expect(first).toEqual({col: 0, row: 0, numCols: 4, numRows: 4});
        expect(second.row == 0 || second.col == 0).toBe(true);
        expect(second.col == 4 || second.row == 4).toBe(true);
    });

    it("always has room for a room's worth of labels and door plates, packed largest first", () => {
        // Every label at any size its scaling allows, and every door's plate, at the room caps.
        const labelScaling = LabelObjectTypeConfig.scaling;
        const labelTypeIndex = ObjectTypeConfigMap.getIndexByType("Label");
        const numScaleSteps = Math.round((labelScaling.maxScale.x - labelScaling.minScale.x) / labelScaling.scaleStep.x);
        const anyLabelScale = fc.integer({min: 0, max: numScaleSteps})
            .map(step => labelScaling.minScale.x + step * labelScaling.scaleStep.x);
        const anyLabel = fc.record({x: anyLabelScale, y: anyLabelScale}).map(scale => {
            const size = ObjectScaleUtil.getObjectSize(labelTypeIndex, {...scale, z: 1});
            return {numCols: toCells(size.x), numRows: toCells(size.y)};
        });
        const plate = DoorObjectTypeConfig.components.spawnedByAny.labelText.localTransform.scale;
        const doorPlate = {numCols: toCells(plate.x), numRows: toCells(plate.y)};
        const numDoors = ObjectCategoryConfigMap.getMaxCountPerRoom(DoorObjectTypeConfig.category);
        const numLabels = ObjectCategoryConfigMap.getMaxCountPerRoom(LabelObjectTypeConfig.category);

        fc.assert(fc.property(fc.array(anyLabel, {minLength: numLabels, maxLength: numLabels}), (labels) => {
            const regions = packLargestFirst([...labels, ...Array(numDoors).fill(doorPlate)]);
            expect(regions.every(region => region != undefined), "a label found no room").toBe(true);
        }), {numRuns: 300});

        // The largest labels all at once, the tightest case.
        const largest = {numCols: toCells(3.5), numRows: toCells(3.5)};
        expect(packLargestFirst([...Array(numLabels).fill(largest), ...Array(numDoors).fill(doorPlate)])
            .every(region => region != undefined)).toBe(true);
    });
});

describe("label lettering layout", () => {
    // A monospaced stand-in for the canvas: every character is half the font size wide.
    const CHAR_WIDTH = 0.5;
    const measureWidth = (str: string) => Array.from(str).length * CHAR_WIDTH;
    const lineSpacing = LabelTextLayoutUtil.lineSpacing;

    const anyWord = fc.array(fc.constantFrom(..."abcdefghij".split("")), {minLength: 1, maxLength: 12})
        .map(chars => chars.join(""));
    const anyText = fc.array(anyWord, {minLength: 1, maxLength: 60}).map(words => words.join(" "));
    const anyBox = fc.record({width: fc.integer({min: 40, max: 900}), height: fc.integer({min: 20, max: 900})});

    it("lays out nothing for text with no words", () => {
        expect(LabelTextLayoutUtil.layOut("", 200, 100, true, 64, measureWidth).lines).toEqual([]);
        expect(LabelTextLayoutUtil.layOut("   ", 200, 100, false, 64, measureWidth).lines).toEqual([]);
    });

    it("fits the whole text when sizing it automatically, every word whole and in order", () => {
        fc.assert(fc.property(anyText, anyBox, (text, box) => {
            const {lines, fontSize} = LabelTextLayoutUtil.layOut(text, box.width, box.height, true, 64, measureWidth);
            expect(lines.join(" ")).toBe(text);
            expect(lines.length * fontSize * lineSpacing).toBeLessThanOrEqual(box.height * (1 + 1e-9));
            for (const line of lines)
                expect(measureWidth(line) * fontSize).toBeLessThanOrEqual(box.width * (1 + 1e-9));
        }), {numRuns: 300});
    });

    it("sizes a lone word to whichever of the width and height runs out first", () => {
        const {fontSize} = LabelTextLayoutUtil.layOut("Library", 300, 100, true, 64, measureWidth);
        expect(fontSize).toBeCloseTo(Math.min(100 / lineSpacing, 300 / measureWidth("Library")), 6);
    });

    it("evens words out over the lines instead of leaving the last one alone", () => {
        // Greedy filling would give "one two three" and a lone "four".
        const width = measureWidth("one two three") * 10;
        const {lines} = LabelTextLayoutUtil.layOut("one two three four", width, 25, true, 64, measureWidth);
        expect(lines).toEqual(["one two", "three four"]);
    });

    it("keeps a fixed size, fitting every line and cutting nothing out of the text", () => {
        fc.assert(fc.property(anyText, anyBox, fc.integer({min: 16, max: 256}), (text, box, fontSize) => {
            const layout = LabelTextLayoutUtil.layOut(text, box.width, box.height, false, fontSize, measureWidth);
            expect(layout.fontSize).toBe(fontSize);
            expect(layout.lines.join("").replace(/ /g, "")).toBe(text.replace(/ /g, ""));
            for (const line of layout.lines)
            {
                // A single character wider than the box is the one thing that can't be helped.
                if (Array.from(line).length > 1)
                    expect(measureWidth(line) * fontSize).toBeLessThanOrEqual(box.width + 1e-9);
            }
        }), {numRuns: 300});
    });

    it("breaks a word too long for a line between characters, never inside one", () => {
        const word = "😀".repeat(40);
        const {lines} = LabelTextLayoutUtil.layOut(word, 100, 400, false, 20, measureWidth);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.join("")).toBe(word);
        for (const line of lines)
            expect(Array.from(line).every(char => char == "😀")).toBe(true);
    });

    it("leaves what doesn't fit at a fixed size below the patch, for the caller to cut off", () => {
        const text = Array(128).fill("word").join(" ");
        const {lines, fontSize} = LabelTextLayoutUtil.layOut(text, 200, 100, false, 32, measureWidth);
        expect(lines.length * fontSize * lineSpacing).toBeGreaterThan(100);
        expect(lines[0]).toBe("word word"); // top-down, in order
    });
});
