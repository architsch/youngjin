import Vec3 from "../../../shared/math/types/vec3";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import RoomVolume from "../../../shared/room/types/roomVolume";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import Voxel from "../../../shared/voxel/types/voxel";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../../shared/system/sharedConstants";
import AgentBox from "../types/agentBox";
import AgentFace from "../types/agentFace";
import { AgentSide } from "../types/agentSide";
import { AgentHeading } from "../types/agentHeading";

// A body resting on a layer's bottom may sit a hair under it.
const FEET_MARGIN = 1e-3;

const SIDE_DIRS: {[side in AgentSide]: Vec3} = {
    north: {x: 0, y: 0, z: -1},
    south: {x: 0, y: 0, z: 1},
    west: {x: -1, y: 0, z: 0},
    east: {x: 1, y: 0, z: 0},
    down: {x: 0, y: -1, z: 0},
    up: {x: 0, y: 1, z: 0},
};

// Clockwise from north, which is toward row 0, as east is away from column 0.
const HEADINGS: AgentHeading[] = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

// How agents are told where things are, and how what they give is read (see @docs/networking/agents.md): a cell's
// row, column and layer, as the voxel grid counts them, and a block's sides by the compass.
const AgentGridUtil =
{
    sides: Object.keys(SIDE_DIRS) as AgentSide[],
    // The room's own floor and ceiling, as the layers whose sides they are.
    floorLayer: COLLISION_LAYER_MIN - 1,
    ceilingLayer: COLLISION_LAYER_MAX + 1,

    getSideDir: (side: AgentSide): Vec3 =>
    {
        return {...SIDE_DIRS[side]};
    },
    // The side a facing is nearest.
    getSide: (dir: Vec3): AgentSide =>
    {
        const {normal} = Geometry3DUtil.getAxisFacingBasis(dir);
        return AgentGridUtil.sides.find(side => Vector3DUtil.equal(SIDE_DIRS[side], normal)) ?? "up";
    },
    // The heading nearest a way to face, and the way a heading faces.
    getHeading: (forward: Vec3): AgentHeading =>
    {
        const turns = Math.round(Math.atan2(forward.x, -forward.z) / (Math.PI / 4));
        return HEADINGS[(turns + HEADINGS.length) % HEADINGS.length];
    },
    getHeadingDir: (heading: AgentHeading): Vec3 =>
    {
        const angle = HEADINGS.indexOf(heading) * (Math.PI / 4);
        return {x: Math.sin(angle), y: 0, z: -Math.cos(angle)};
    },
    // The cell some feet stand in.
    toGridPosition: (feet: Vec3): {row: number, column: number, layer: number} =>
    {
        return {
            row: VoxelQueryUtil.getVoxelRowFromWorldZ(feet.z),
            column: VoxelQueryUtil.getVoxelColFromWorldX(feet.x),
            layer: VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(feet.y + FEET_MARGIN),
        };
    },
    // The quad of a face; -1 where there is none (outside the grid, or a side of the room's floor or ceiling but the
    // one facing in).
    getFaceQuadIndex: (face: AgentFace): number =>
    {
        const {row, column, layer, side} = face;
        if (layer == AgentGridUtil.floorLayer)
            return (side == "up") ? VoxelQueryUtil.getFloorVoxelQuadIndex(row, column) : -1;
        if (layer == AgentGridUtil.ceilingLayer)
            return (side == "down") ? VoxelQueryUtil.getCeilingVoxelQuadIndex(row, column) : -1;
        if (layer < COLLISION_LAYER_MIN || layer > COLLISION_LAYER_MAX)
            return -1;
        const dir = SIDE_DIRS[side];
        const axis = (dir.x != 0) ? "x" : (dir.y != 0) ? "y" : "z";
        return VoxelQueryUtil.getVoxelQuadIndex(row, column, axis, (dir[axis] > 0) ? "+" : "-", layer);
    },
    // A face's middle in the world, and the way it faces.
    getFaceCenter: (voxels: Voxel[], quadIndex: number): {center: Vec3, dir: Vec3} =>
    {
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(voxels, quadIndex, true);
        return {
            center: {x: VoxelQueryUtil.getWorldXAtVoxelColCenter(col) + dims.offsetX, y: dims.offsetY,
                z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(row) + dims.offsetZ},
            dir: {x: dims.dirX, y: dims.dirY, z: dims.dirZ},
        };
    },
    // The face something lying on a face at pos, facing dir, lies on: the side of the block just behind pos.
    getFaceBehind: (pos: Vec3, dir: Vec3): AgentFace =>
    {
        const {normal} = Geometry3DUtil.getAxisFacingBasis(dir);
        const behind = Vector3DUtil.subtract(pos, Vector3DUtil.scale(normal, 0.25));
        return {
            row: VoxelQueryUtil.getVoxelRowFromWorldZ(behind.z),
            column: VoxelQueryUtil.getVoxelColFromWorldX(behind.x),
            layer: VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(behind.y),
            side: AgentGridUtil.getSide(normal),
        };
    },
    // A box from the spans an agent gave, within the layers it may reach, or what is wrong with it.
    toRoomVolume: (box: AgentBox, layerMin: number = COLLISION_LAYER_MIN,
        layerMax: number = COLLISION_LAYER_MAX): RoomVolume | string =>
    {
        const rows = toSpan(box.rows);
        const columns = toSpan(box.columns);
        const layers = toSpan(box.layers);
        if (rows == undefined || columns == undefined || layers == undefined)
            return "Give rows, columns and layers each as [from, to], or [one].";
        if (rows[0] < 0 || rows[1] >= NUM_VOXEL_ROWS || columns[0] < 0 || columns[1] >= NUM_VOXEL_COLS
            || layers[0] < layerMin || layers[1] > layerMax)
        {
            return `Rows run from 0 to ${NUM_VOXEL_ROWS - 1}, columns from 0 to ${NUM_VOXEL_COLS - 1}, and layers `
                + `here from ${layerMin} to ${layerMax}.`;
        }
        return new RoomVolume(rows[0], rows[1], columns[0], columns[1], layers[0], layers[1]);
    },
    fromRoomVolume: (volume: RoomVolume): AgentBox =>
    {
        return {
            rows: [volume.rowMin, volume.rowMax],
            columns: [volume.colMin, volume.colMax],
            layers: [volume.collisionLayerMin, volume.collisionLayerMax],
        };
    },
    getCellCount: (volume: RoomVolume): number =>
    {
        return (volume.rowMax - volume.rowMin + 1) * (volume.colMax - volume.colMin + 1)
            * (volume.collisionLayerMax - volume.collisionLayerMin + 1);
    },
    // Layer by layer from the bottom, each row by row.
    forEachCell: (volume: RoomVolume, visit: (row: number, column: number, layer: number) => void): void =>
    {
        for (let layer = volume.collisionLayerMin; layer <= volume.collisionLayerMax; ++layer)
            for (let row = volume.rowMin; row <= volume.rowMax; ++row)
                for (let column = volume.colMin; column <= volume.colMax; ++column)
                    visit(row, column, layer);
    },
}

// [from, to] in order, from [from, to] either way round or [one]; undefined for anything else.
function toSpan(values: number[]): [number, number] | undefined
{
    if (values.length < 1 || values.length > 2 || !values.every(Number.isInteger))
        return undefined;
    const last = values[values.length - 1];
    return [Math.min(values[0], last), Math.max(values[0], last)];
}

export default AgentGridUtil;
