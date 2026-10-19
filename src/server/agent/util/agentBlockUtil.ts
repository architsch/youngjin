import Vec3 from "../../../shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import ObjectAttachmentUtil from "../../../shared/object/util/objectAttachmentUtil";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import Room from "../../../shared/room/types/room";
import RoomVolume from "../../../shared/room/types/roomVolume";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS,
    NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS, NUM_VOXEL_TEXTURES,
    VOXEL_CELL_SIZE } from "../../../shared/system/sharedConstants";
import VoxelTextureNameMap from "../../../shared/voxel/maps/voxelTextureNameMap";
import AddVoxelBlockSignal from "../../../shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelPathUtil from "../../../shared/voxel/util/voxelPathUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../shared/voxel/util/voxelUpdateUtil";
import { AGENT_LOOK_BLOCKS_MAX_BOXES, AGENT_LOOK_BLOCKS_REACH, USER_BUDGETS } from "../../system/serverConstants";
import UserBudgetUtil from "../../user/util/userBudgetUtil";
import AgentBudgetUtil from "./agentBudgetUtil";
import AgentBox from "../types/agentBox";
import { AgentSide } from "../types/agentSide";
import AgentUserContext from "../types/agentUserContext";
import AgentGridUtil from "./agentGridUtil";
import AgentRoomUtil from "./agentRoomUtil";
import AgentSignalUtil from "./agentSignalUtil";

const NOT_IN_A_ROOM = "You aren't in a room.";

// Touching a body counts for nothing.
const BODY_MARGIN = 1e-3;

// An agent's blocks and faces: what it sees of them, and its edits, each sent as the signal a browser sends for a
// person's, so it passes the same checks (see VoxelUpdateUtil). Edits run over a box of cells at a time, and skip what
// can't be done there rather than failing the whole box.
const AgentBlockUtil =
{
    // The blocks in a region (by default, all layers of the rows and columns around the agent), as boxes of filled
    // cells, each with the textures its showing faces have.
    lookBlocks: (ctx: AgentUserContext, region: Partial<AgentBox>): object =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        const me = AgentRoomUtil.getMyPlayer(ctx);
        if (room == undefined || me == undefined)
            return {error: NOT_IN_A_ROOM};

        const at = AgentGridUtil.toGridPosition(VoxelPathUtil.feetOf(me.transform.pos));
        const around = (center: number, last: number) =>
            [Math.max(0, center - AGENT_LOOK_BLOCKS_REACH), Math.min(last, center + AGENT_LOOK_BLOCKS_REACH)];
        const volume = AgentGridUtil.toRoomVolume({
            rows: region.rows ?? around(at.row, NUM_VOXEL_ROWS - 1),
            columns: region.columns ?? around(at.column, NUM_VOXEL_COLS - 1),
            layers: region.layers ?? [COLLISION_LAYER_MIN, COLLISION_LAYER_MAX],
        });
        if (typeof volume == "string")
            return {error: volume};

        const boxes = findFilledBoxes(room, volume);
        const shown = boxes.slice(0, AGENT_LOOK_BLOCKS_MAX_BOXES);
        return {
            region: AgentGridUtil.fromRoomVolume(volume),
            blocks: shown.map(box => ({...AgentGridUtil.fromRoomVolume(box), ...describeTextures(room, box)})),
            floor: describeFloor(room, volume),
            note: (shown.length < boxes.length)
                ? `Only ${shown.length} of ${boxes.length} boxes are shown: look at a smaller region.` : undefined,
        };
    },
    // The names of the room's textures, by number.
    listTextures: (ctx: AgentUserContext): object =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const names = Array.from({length: NUM_VOXEL_TEXTURES},
            (_, textureIndex) => VoxelTextureNameMap.getName(room.texturePackPath, textureIndex));
        return {pack: room.texturePackPath, textures: names,
            note: "Give a texture by its name, or by its number: its place in this list, from 0."};
    },
    // Fills the box's empty cells with blocks, all faces of one texture: the one given, else that of the surface
    // under the box.
    placeBlocks: async (ctx: AgentUserContext, box: AgentBox, texture?: string): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const volume = AgentGridUtil.toRoomVolume(box);
        if (typeof volume == "string")
            return {error: volume};
        const textureIndex = (texture == undefined) ? getTextureBeneath(room, volume) : findTexture(room, texture);
        if (textureIndex < 0)
            return {error: describeUnknownTexture(room, texture ?? "")};

        const feet = getPlayers(room).map(player => VoxelPathUtil.feetOf(player.transform.pos));
        const quadIndices: number[] = [];
        const skipped = {alreadyFilled: 0, someoneStandsThere: 0, restricted: 0};
        AgentGridUtil.forEachCell(volume, (row, column, layer) => {
            const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, column, layer);
            if (VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, row, column, layer))
                ++skipped.alreadyFilled;
            else if (feet.some(f => bodyOverlapsCell(f, row, column, layer)))
                ++skipped.someoneStandsThere;
            else if (!VoxelUpdateUtil.canAddVoxelBlock(ctx.user, room, quadIndex))
                ++skipped.restricted;
            else
                quadIndices.push(quadIndex);
        });

        const textures = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(textureIndex);
        let placed = 0;
        let done = 0;
        for (; done < quadIndices.length && canGoOn(ctx, room, 1); ++done)
        {
            await AgentSignalUtil.send(ctx, "addVoxelBlockSignal",
                new AddVoxelBlockSignal(room.id, quadIndices[done], textures));
            if (blockIsAt(room, quadIndices[done]))
                ++placed;
        }
        return {placed, texture: VoxelTextureNameMap.getName(room.texturePackPath, textureIndex),
            ...describeSkipped(skipped), ...describeUnfinished(ctx, quadIndices.length - done)};
    },
    // Takes the box's blocks out. One something hangs on is left, unless withAttached, which removes that too.
    removeBlocks: async (ctx: AgentUserContext, box: AgentBox, withAttached: boolean): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const volume = AgentGridUtil.toRoomVolume(box);
        if (typeof volume == "string")
            return {error: volume};

        const removals: {quadIndex: number, attached: string[]}[] = [];
        const skipped = {restricted: 0, somethingHangsOnIt: 0, holdsWhatIsntYoursToRemove: 0};
        AgentGridUtil.forEachCell(volume, (row, column, layer) => {
            if (!VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, row, column, layer))
                return;
            const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, column, layer);
            if (!VoxelUpdateUtil.canRemoveVoxelBlockWithItsAttachments(ctx.user, room, quadIndex))
            {
                ++skipped.restricted;
                return;
            }
            const attached = ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex);
            if (attached.length > 0 && !withAttached)
                ++skipped.somethingHangsOnIt;
            else if (attached.some(objectId => !ObjectUpdateUtil.canRemoveObject(ctx.user, room,
                new RemoveObjectSignal(room.id, objectId))))
                ++skipped.holdsWhatIsntYoursToRemove;
            else
                removals.push({quadIndex, attached});
        });

        let removed = 0;
        let objectsRemoved = 0;
        let done = 0;
        for (; done < removals.length; ++done)
        {
            // What hangs on the block first, as a browser removes them (see VoxelEditUtil), and all of it or nothing.
            const {quadIndex, attached} = removals[done];
            const hanging = attached.filter(objectId => room.objectById[objectId] != undefined);
            if (!canGoOn(ctx, room, hanging.length + 1))
                break;
            for (const objectId of hanging)
            {
                await AgentSignalUtil.send(ctx, "removeObjectSignal", new RemoveObjectSignal(room.id, objectId));
                if (room.objectById[objectId] == undefined)
                    ++objectsRemoved;
            }
            await AgentSignalUtil.send(ctx, "removeVoxelBlockSignal", new RemoveVoxelBlockSignal(room.id, quadIndex));
            if (!blockIsAt(room, quadIndex))
                ++removed;
        }
        const unfinished = describeUnfinished(ctx, removals.length - done);
        const hangingNote = (skipped.somethingHangsOnIt > 0)
            ? "Blocks something hangs on were left: remove those things first, or pass with_attached." : undefined;
        return {removed, objectsRemoved: (objectsRemoved > 0) ? objectsRemoved : undefined, ...describeSkipped(skipped),
            ...unfinished, note: [hangingNote, unfinished.note].filter(note => note != undefined).join(" ") || undefined};
    },
    // Gives the showing faces of the box's blocks, on the sides given (all, if none), a texture.
    paintFaces: async (ctx: AgentUserContext, box: AgentBox, sides: AgentSide[] | undefined,
        texture: string): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const volume = AgentGridUtil.toRoomVolume(box, AgentGridUtil.floorLayer, AgentGridUtil.ceilingLayer);
        if (typeof volume == "string")
            return {error: volume};
        const textureIndex = findTexture(room, texture);
        if (textureIndex < 0)
            return {error: describeUnknownTexture(room, texture)};

        const quadIndices: number[] = [];
        let alreadyThatTexture = 0;
        const skipped = {restricted: 0};
        AgentGridUtil.forEachCell(volume, (row, column, layer) => {
            for (const side of sides ?? AgentGridUtil.sides)
            {
                const quadIndex = AgentGridUtil.getFaceQuadIndex({row, column, layer, side});
                if (quadIndex < 0 || !VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex))
                    continue;
                if (getTexture(room, quadIndex) == textureIndex)
                    ++alreadyThatTexture;
                else if (!VoxelUpdateUtil.canSetVoxelQuadTexture(ctx.user, room, quadIndex))
                    ++skipped.restricted;
                else
                    quadIndices.push(quadIndex);
            }
        });

        let painted = 0;
        let done = 0;
        for (; done < quadIndices.length && canGoOn(ctx, room, 1); ++done)
        {
            await AgentSignalUtil.send(ctx, "setVoxelQuadTextureSignal",
                new SetVoxelQuadTextureSignal(room.id, quadIndices[done], textureIndex));
            if (getTexture(room, quadIndices[done]) == textureIndex)
                ++painted;
        }
        const unfinished = describeUnfinished(ctx, quadIndices.length - done);
        return {painted, texture: VoxelTextureNameMap.getName(room.texturePackPath, textureIndex),
            alreadyThatTexture: (alreadyThatTexture > 0) ? alreadyThatTexture : undefined, ...describeSkipped(skipped),
            ...unfinished, note: (quadIndices.length + alreadyThatTexture + skipped.restricted == 0)
                ? "No face shows there. Faces are blocks' sides: the floor is layer -1's up side." : unfinished.note};
    },
}

// A texture by its name or number, in the room's pack; -1 for none.
function findTexture(room: Room, text: string): number
{
    const number = /^(?:texture\s*)?(\d+)$/i.exec(text.trim());
    if (number)
        return (parseInt(number[1]) < NUM_VOXEL_TEXTURES) ? parseInt(number[1]) : -1;
    return VoxelTextureNameMap.findTextureIndex(room.texturePackPath, text);
}

// With the names that share a word with it, if any.
function describeUnknownTexture(room: Room, text: string): string
{
    const words = text.toLowerCase().split(/[\s-]+/).filter(word => word.length > 2);
    const close = VoxelTextureNameMap.getNames(room.texturePackPath)
        .filter(name => words.some(word => name.includes(word))).slice(0, 8);
    return `This room has no texture "${text}" (textures lists its own).`
        + ((close.length > 0) ? ` Perhaps: ${close.join(", ")}.` : "");
}

// Whether a call may make its next edits: in the room it began in, and with the edit budget to pay for them (see
// UserBudgetUtil), which an agent spends as a person does.
function canGoOn(ctx: AgentUserContext, room: Room, edits: number): boolean
{
    return AgentRoomUtil.getCurrentRoom(ctx) == room && UserBudgetUtil.getLevel(ctx.user.id, "edit") >= edits;
}

// What a call left undone, and when the edit budget pays for it; nothing if it left nothing.
function describeUnfinished(ctx: AgentUserContext, count: number): {unfinished?: number, note?: string}
{
    if (count <= 0)
        return {};
    const wait = AgentBudgetUtil.describeWait(ctx.user.id, "edit", Math.min(count, USER_BUDGETS.edit.capacity));
    return {unfinished: count, note: `Your edits ran out with ${count} left to do: they come back at `
        + `${USER_BUDGETS.edit.refillPerSecond} a second, so call again in about ${wait} to finish (what is done `
        + "already is skipped)."};
}

// Only what was skipped for some reason.
function describeSkipped(skipped: {[reason: string]: number}): {skipped?: {[reason: string]: number}}
{
    const reasons = Object.entries(skipped).filter(([, count]) => count > 0);
    return (reasons.length > 0) ? {skipped: Object.fromEntries(reasons)} : {};
}

function getTexture(room: Room, quadIndex: number): number
{
    return room.voxelGrid.quadsMem.quads[quadIndex] & 0b01111111;
}

function blockIsAt(room: Room, quadIndex: number): boolean
{
    return VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex), VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex));
}

// The texture of the top of whatever is under the box's first cell: a block, or the room's own floor.
function getTextureBeneath(room: Room, volume: RoomVolume): number
{
    for (let layer = volume.collisionLayerMin - 1; layer >= COLLISION_LAYER_MIN; --layer)
    {
        if (VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, volume.rowMin, volume.colMin, layer))
            return getTexture(room, VoxelQueryUtil.getVoxelQuadIndex(volume.rowMin, volume.colMin, "y", "+", layer));
    }
    return getTexture(room, VoxelQueryUtil.getFloorVoxelQuadIndex(volume.rowMin, volume.colMin));
}

function getPlayers(room: Room)
{
    const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
    return Object.values(room.objectById).filter(obj => obj.objectTypeIndex == playerTypeIndex);
}

function bodyOverlapsCell(feet: Vec3, row: number, column: number, layer: number): boolean
{
    const reach = PLAYER_RADIUS_XZ - BODY_MARGIN;
    return feet.x + reach > column * VOXEL_CELL_SIZE && feet.x - reach < (column + 1) * VOXEL_CELL_SIZE
        && feet.z + reach > row * VOXEL_CELL_SIZE && feet.z - reach < (row + 1) * VOXEL_CELL_SIZE
        && feet.y + PLAYER_HEIGHT - BODY_MARGIN > layer * COLLISION_LAYER_HEIGHT
        && feet.y + BODY_MARGIN < (layer + 1) * COLLISION_LAYER_HEIGHT;
}

// The filled cells of a region as few boxes, greedily: from each cell not yet in one, along its row, then across rows,
// then up the layers, as far as the cells stay filled.
function findFilledBoxes(room: Room, volume: RoomVolume): RoomVolume[]
{
    const voxels = room.voxelGrid.voxels;
    const numRows = volume.rowMax - volume.rowMin + 1;
    const numCols = volume.colMax - volume.colMin + 1;
    const taken = new Uint8Array(AgentGridUtil.getCellCount(volume));
    const indexOf = (row: number, col: number, layer: number) =>
        ((layer - volume.collisionLayerMin) * numRows + (row - volume.rowMin)) * numCols + (col - volume.colMin);
    const isFree = (row: number, col: number, layer: number) =>
        taken[indexOf(row, col, layer)] == 0 && VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col, layer);
    const allFree = (box: RoomVolume) => {
        let free = true;
        AgentGridUtil.forEachCell(box, (row, col, layer) => { free &&= isFree(row, col, layer); });
        return free;
    };

    const boxes: RoomVolume[] = [];
    AgentGridUtil.forEachCell(volume, (row, col, layer) => {
        if (!isFree(row, col, layer))
            return;
        let colMax = col;
        while (colMax < volume.colMax && isFree(row, colMax + 1, layer))
            ++colMax;
        let rowMax = row;
        while (rowMax < volume.rowMax && allFree(new RoomVolume(rowMax + 1, rowMax + 1, col, colMax, layer, layer)))
            ++rowMax;
        let layerMax = layer;
        while (layerMax < volume.collisionLayerMax
            && allFree(new RoomVolume(row, rowMax, col, colMax, layerMax + 1, layerMax + 1)))
            ++layerMax;

        const box = new RoomVolume(row, rowMax, col, colMax, layer, layerMax);
        AgentGridUtil.forEachCell(box, (r, c, l) => { taken[indexOf(r, c, l)] = 1; });
        boxes.push(box);
    });
    return boxes;
}

// The textures a box's showing faces have: one, if every side shows the same, else each side's own ("mostly" where a
// side shows several).
function describeTextures(room: Room, box: RoomVolume): {texture?: string, textures?: {[side: string]: string}}
{
    const countsBySide = new Map<AgentSide, Map<number, number>>();
    AgentGridUtil.forEachCell(box, (row, column, layer) => {
        for (const side of AgentGridUtil.sides)
        {
            const quadIndex = AgentGridUtil.getFaceQuadIndex({row, column, layer, side});
            if (!VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex))
                continue;
            const counts = countsBySide.get(side) ?? new Map<number, number>();
            const textureIndex = getTexture(room, quadIndex);
            counts.set(textureIndex, (counts.get(textureIndex) ?? 0) + 1);
            countsBySide.set(side, counts);
        }
    });
    if (countsBySide.size == 0)
        return {};

    const all = new Set([...countsBySide.values()].flatMap(counts => [...counts.keys()]));
    if (all.size == 1)
        return {texture: VoxelTextureNameMap.getName(room.texturePackPath, [...all][0])};
    const textures: {[side: string]: string} = {};
    for (const [side, counts] of countsBySide)
    {
        const [commonest] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        textures[side] = VoxelTextureNameMap.getName(room.texturePackPath, commonest)
            + ((counts.size > 1) ? " (mostly)" : "");
    }
    return {textures};
}

// The commonest texture of the room's own floor where it shows in the region, if the region reaches down to it.
function describeFloor(room: Room, volume: RoomVolume): string | undefined
{
    if (volume.collisionLayerMin > COLLISION_LAYER_MIN)
        return undefined;
    const counts = new Map<number, number>();
    for (let row = volume.rowMin; row <= volume.rowMax; ++row)
    {
        for (let col = volume.colMin; col <= volume.colMax; ++col)
        {
            const quadIndex = VoxelQueryUtil.getFloorVoxelQuadIndex(row, col);
            if (!VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex))
                continue;
            const textureIndex = getTexture(room, quadIndex);
            counts.set(textureIndex, (counts.get(textureIndex) ?? 0) + 1);
        }
    }
    if (counts.size == 0)
        return undefined;
    const [commonest] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return VoxelTextureNameMap.getName(room.texturePackPath, commonest) + ((counts.size > 1) ? " (mostly)" : "");
}

export default AgentBlockUtil;
