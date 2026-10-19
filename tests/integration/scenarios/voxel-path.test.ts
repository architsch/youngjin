/**
 * Integration tests: walking paths over the voxel grid (VoxelPathUtil) — where a body can stand, ways around and
 * through walls, climbing one layer at a time and dropping from ledges, and refusing what nobody could reach.
 */
import { describe, it, expect } from "vitest";
import VoxelPathUtil from "../../../src/shared/voxel/util/voxelPathUtil";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelVertex from "../../../src/shared/voxel/types/voxelVertex";
import { NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";

// A room with nothing in it: every voxel open, the room's own floor under all of them.
function openGrid(): Voxel[]
{
    const voxels = VoxelGrid.createBaseGrid().voxels;
    for (const voxel of voxels)
        voxel.blockLayerMask = 0;
    return voxels;
}

function fill(voxels: Voxel[], rows: [number, number], cols: [number, number], layers: [number, number]): void
{
    for (let row = rows[0]; row <= rows[1]; ++row)
        for (let col = cols[0]; col <= cols[1]; ++col)
            for (let layer = layers[0]; layer <= layers[1]; ++layer)
                voxels[row * NUM_VOXEL_COLS + col].blockLayerMask |= 1 << layer;
}

const ALL_LAYERS: [number, number] = [0, NUM_COLLISION_LAYERS - 1];
const vertex = (row: number, col: number, layer: number = 0): VoxelVertex => ({row, col, layer});

describe("walking paths", () => {
    it("crosses an open floor in one straight run, kept as its two ends", () => {
        const voxels = openGrid();
        expect(VoxelPathUtil.findPath(voxels, vertex(10, 10), vertex(10, 40))).toEqual([vertex(10, 10), vertex(10, 40)]);
    });

    it("goes round a wall through a gap two voxels wide, and finds no way through one a voxel wide", () => {
        const wide = openGrid();
        fill(wide, [1, 29], [30, 30], ALL_LAYERS);
        fill(wide, [32, 62], [30, 30], ALL_LAYERS);
        const path = VoxelPathUtil.findPath(wide, vertex(31, 10), vertex(31, 50));
        expect(path).toBeDefined();
        expect(path!.every(step => VoxelPathUtil.isStandable(wide, step))).toBe(true);

        const narrow = openGrid();
        fill(narrow, [1, 29], [30, 30], ALL_LAYERS);
        fill(narrow, [31, 62], [30, 30], ALL_LAYERS);
        expect(VoxelPathUtil.findPath(narrow, vertex(31, 10), vertex(31, 50))).toBeUndefined();
    });

    it("climbs onto a platform one layer high, but not two without a step", () => {
        const low = openGrid();
        fill(low, [20, 30], [20, 30], [0, 0]);
        const up = VoxelPathUtil.findPath(low, vertex(10, 10), vertex(25, 25, 1));
        expect(up?.[up.length - 1]).toEqual(vertex(25, 25, 1));

        const high = openGrid();
        fill(high, [20, 30], [20, 30], [0, 1]);
        expect(VoxelPathUtil.findPath(high, vertex(10, 10), vertex(25, 25, 2))).toBeUndefined();

        // A single step beside it makes the way.
        fill(high, [24, 26], [18, 19], [0, 0]);
        expect(VoxelPathUtil.findPath(high, vertex(10, 10), vertex(25, 25, 2))).toBeDefined();
    });

    it("drops down from a ledge however high, within reason", () => {
        const voxels = openGrid();
        fill(voxels, [20, 30], [20, 30], [0, 5]);
        expect(VoxelPathUtil.findPath(voxels, vertex(25, 25, 6), vertex(10, 10, 0))).toBeDefined();
    });

    it("stands a body only where all of it fits and something is under it", () => {
        const voxels = openGrid();
        // A ceiling low enough to stoop under, which nobody can.
        fill(voxels, [20, 30], [20, 30], [3, 3]);
        expect(VoxelPathUtil.isStandable(voxels, vertex(25, 25))).toBe(false);
        expect(VoxelPathUtil.isStandable(voxels, vertex(10, 10))).toBe(true);
        // Mid-air.
        expect(VoxelPathUtil.isStandable(voxels, vertex(10, 10, 3))).toBe(false);
        // Half on a block's edge is still standing.
        fill(voxels, [40, 40], [40, 40], [0, 0]);
        expect(VoxelPathUtil.isStandable(voxels, vertex(41, 41, 1))).toBe(true);
    });

    it("finds the nearest place to stand, or none", () => {
        const voxels = openGrid();
        fill(voxels, [20, 24], [20, 24], ALL_LAYERS);
        const near = VoxelPathUtil.findStandingVertexNear(voxels, VoxelPathUtil.toWorld(vertex(22, 22)));
        expect(near).toBeDefined();
        expect(VoxelPathUtil.isStandable(voxels, near!)).toBe(true);

        const solid = VoxelGrid.createBaseGrid().voxels;
        fill(solid, [0, NUM_VOXEL_ROWS - 1], [0, NUM_VOXEL_COLS - 1], ALL_LAYERS);
        expect(VoxelPathUtil.findStandingVertexNear(solid, VoxelPathUtil.toWorld(vertex(22, 22)))).toBeUndefined();
    });

    it("finds no way into a sealed room", () => {
        const voxels = openGrid();
        fill(voxels, [20, 40], [20, 20], ALL_LAYERS);
        fill(voxels, [20, 40], [40, 40], ALL_LAYERS);
        fill(voxels, [20, 20], [20, 40], ALL_LAYERS);
        fill(voxels, [40, 40], [20, 40], ALL_LAYERS);
        expect(VoxelPathUtil.findPath(voxels, vertex(10, 10), vertex(30, 30))).toBeUndefined();
    });

    it("never cuts a corner past a block", () => {
        const voxels = openGrid();
        fill(voxels, [30, 30], [30, 30], ALL_LAYERS);
        const path = VoxelPathUtil.findPath(voxels, vertex(28, 28), vertex(33, 33))!;
        // Every leg between kept points is straight; none passes through the block's four corners.
        for (const step of path)
            expect(VoxelPathUtil.isStandable(voxels, step)).toBe(true);
        for (let i = 1; i < path.length; ++i)
        {
            const [a, b] = [path[i - 1], path[i]];
            const steps = Math.max(Math.abs(b.row - a.row), Math.abs(b.col - a.col));
            for (let s = 0; s <= steps; ++s)
            {
                const between = vertex(a.row + Math.round((b.row - a.row) * s / steps),
                    a.col + Math.round((b.col - a.col) * s / steps), a.layer);
                expect(VoxelPathUtil.isStandable(voxels, between), JSON.stringify(between)).toBe(true);
            }
        }
    });
});
