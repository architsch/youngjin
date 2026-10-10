/**
 * Restricted zones (see @docs/gameplay/restricted_zone.md): the room's volumes that are kept for a user, or for
 * nobody ("*"), in which only that user and the superuser (a hub's admin, a Regular room's owner, the sandbox's
 * player) may edit voxels and persistent objects. Asserted as the server enforces it: refusals go in as signals and come back as
 * rollbacks. Who may lay and edit a volume is in volume.test.ts, and what an older room's zones become in
 * voxel-grid-migration.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import { ConnectedUser } from "../helpers/serverHarness";
import { addRestrictedZone, clearRestrictedZones, makeZoneSignal, zoneTransform, NO_ONE,
    ZoneBlocks } from "../helpers/restrictedZone";

import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import Room from "../../../src/shared/room/types/room";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import VolumeObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import { FIXTURE_PICTURES, useFixturePictures } from "../helpers/pictureFixture";
import RestrictedZoneUtil from "../../../src/shared/voxel/util/restrictedZoneUtil";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";
import MoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/moveVoxelBlockSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { restrictedZonesChangedObservable } from "../../../src/shared/system/sharedObservables";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS,
    ROOM_EDITOR_SINGLE_PLAYER_MODE, SANDBOX_SINGLE_PLAYER_MODE, UNIT_VEC3, VOXEL_CELL_SIZE,
    ZONE_USER_NAME_FOR_NOBODY } from "../../../src/shared/system/sharedConstants";

// Clear of the boundary walls and the door's wall, from the room's floor to its ceiling. It counts voxels,
// and every side of it lies half a world unit off a whole one.
const ZONE: ZoneBlocks = {rowMin: 17, rowMax: 30, colMin: 17, colMax: 30};

// The same ground over part of the room's height only: clear of the floor, and well short of the slab.
const LOW_LAYER = COLLISION_LAYER_MIN + 1;
const HIGH_LAYER = COLLISION_LAYER_MIN + 4;
const PARTIAL_ZONE: ZoneBlocks = {...ZONE, collisionLayerMin: LOW_LAYER, collisionLayerMax: HIGH_LAYER};

// A voxel inside that zone, and one outside it, at a height the room is hollow at.
const INSIDE = {row: 20, col: 20};
const OUTSIDE = {row: 40, col: 40};
const LAYER = COLLISION_LAYER_MIN + 2;

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
// Any painting in the picture map passes the canvas rule.
useFixturePictures();
const CANVAS_IMAGE_PATH = FIXTURE_PICTURES.painting;
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");

function makeUser(id: string, userType: number, ownedRoomID: string = ""): User
{
    return new User(id, `User_${id}`, userType, `${id}@test.com`, "", "", ownedRoomID);
}

const ADMIN = makeUser("an-admin", UserTypeEnumMap.Admin);
const MEMBER = makeUser("a-member", UserTypeEnumMap.Member);
const FRIEND = makeUser("a-friend", UserTypeEnumMap.Member);
const GUEST = makeUser("a-guest", UserTypeEnumMap.Guest);
// Ownership is the user naming the room as their own.
const OWNER = makeUser("an-owner", UserTypeEnumMap.Member, "regular");

function getRoom(roomID: string): Room
{
    return ServerRoomManager.roomRuntimeMemories[roomID].room;
}

// Laid directly, in place of whatever zones the room held, each kept for nobody ("*"), which leaves it the
// superuser's alone; how a superuser draws them is tested at the bottom.
function drawZone(room: Room, ...zones: ZoneBlocks[]): void
{
    clearRestrictedZones(room);
    for (const zone of zones)
        addRestrictedZone(room, zone);
}

// Socket users arrive as guests; being an admin is a property of the user.
function becomeAdmin(ctx: ConnectedUser): void
{
    ctx.user.userType = UserTypeEnumMap.Admin;
}

function blockQuadIndex(row: number, col: number, layer: number = LAYER): number
{
    return VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer);
}

function blockIsThere(room: Room, row: number, col: number, layer: number = LAYER): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col)!;
    return VoxelQueryUtil.isVoxelBlockPresent(voxel, layer);
}

// The middle of a voxel in the world, at a height.
function voxelMiddle(row: number, col: number, y: number): {x: number, y: number, z: number}
{
    return {x: VoxelQueryUtil.getWorldXAtVoxelColCenter(col), y, z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(row)};
}

// Over a voxel's middle. Only the collider's position matters, not whether a canvas could really hang there.
function makeCanvasSignal(room: Room, user: User, row: number, col: number,
    objectId: string = "a-canvas", y: number = 2): AddObjectSignal
{
    return new AddObjectSignal(room.id, user.id, user.userName, canvasTypeIndex, objectId,
        new ObjectTransform(voxelMiddle(row, col, y), {x: 0, y: 0, z: -1}, {...UNIT_VEC3}));
}

describe("restricted zones", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── Voxel blocks ───

    it("refuses an ordinary user's block inside a zone, and rolls his own copy back", async () => {
        await runScenario({
            name: "block added inside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");
                drawZone(room, ZONE);
                room.dirty = false;

                ServerVoxelManager.onAddVoxelBlockSignalReceived(users[0].socketUserContext,
                    new AddVoxelBlockSignal(room.id, blockQuadIndex(INSIDE.row, INSIDE.col),
                        [0, 0, 0, 0, 0, 0]));

                expect(blockIsThere(room, INSIDE.row, INSIDE.col)).toBe(false);
                expect(room.dirty).toBe(false);

                // The client applied the add optimistically, so it is sent the removal that undoes it.
                expect(getPendingSignals(users[0], "removeVoxelBlockSignal").length)
                    .toBeGreaterThanOrEqual(1);
            },
        });
    });

    it("lets the same user build in the same room outside the zone", async () => {
        await runScenario({
            name: "block added outside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");
                drawZone(room, ZONE);

                ServerVoxelManager.onAddVoxelBlockSignalReceived(users[0].socketUserContext,
                    new AddVoxelBlockSignal(room.id, blockQuadIndex(OUTSIDE.row, OUTSIDE.col),
                        [0, 0, 0, 0, 0, 0]));

                expect(blockIsThere(room, OUTSIDE.row, OUTSIDE.col)).toBe(true);
            },
        });
    });

    it("covers the blocks its volume covers and none past them, along rows, columns and layers, down to a single one", async () => {
        await runScenario({
            name: "a zone's blocks",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                drawZone(room, PARTIAL_ZONE);
                const blocked = (row: number, col: number, layer: number = LAYER) =>
                    RestrictedZoneUtil.blocksVoxelBlockEdit(MEMBER, room, row, col, layer);

                // Its first and last voxels along rows and cols, and the ones just past them.
                const first = {row: ZONE.rowMin, col: ZONE.colMin};
                const last = {row: ZONE.rowMax, col: ZONE.colMax};
                expect(blocked(first.row, first.col)).toBe(true);
                expect(blocked(last.row, last.col)).toBe(true);
                expect(blocked(first.row - 1, first.col)).toBe(false);
                expect(blocked(first.row, first.col - 1)).toBe(false);
                expect(blocked(last.row + 1, last.col)).toBe(false);
                expect(blocked(last.row, last.col + 1)).toBe(false);

                // Its lowest and highest layers, and the ones just under and over them, which are anybody's.
                expect(blocked(INSIDE.row, INSIDE.col, LOW_LAYER)).toBe(true);
                expect(blocked(INSIDE.row, INSIDE.col, HIGH_LAYER)).toBe(true);
                expect(blocked(INSIDE.row, INSIDE.col, LOW_LAYER - 1)).toBe(false);
                expect(blocked(INSIDE.row, INSIDE.col, HIGH_LAYER + 1)).toBe(false);

                // From the room's floor to its ceiling, it covers every layer.
                drawZone(room, ZONE);
                expect(blocked(INSIDE.row, INSIDE.col, COLLISION_LAYER_MIN)).toBe(true);
                expect(blocked(INSIDE.row, INSIDE.col, COLLISION_LAYER_MAX)).toBe(true);

                // One block is the least a zone covers, and it covers that one alone.
                drawZone(room, {rowMin: OUTSIDE.row, rowMax: OUTSIDE.row, colMin: OUTSIDE.col, colMax: OUTSIDE.col,
                    collisionLayerMin: LAYER, collisionLayerMax: LAYER});
                expect(blocked(OUTSIDE.row, OUTSIDE.col)).toBe(true);
                for (const [rowOffset, colOffset, layerOffset] of [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0],
                    [0, 0, -1], [0, 0, 1]])
                {
                    expect(blocked(OUTSIDE.row + rowOffset, OUTSIDE.col + colOffset, LAYER + layerOffset)).toBe(false);
                }
            },
        });
    });

    it("lets anybody build over and under a zone that takes up part of the room's height", async () => {
        await runScenario({
            name: "blocks over and under a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");
                drawZone(room, PARTIAL_ZONE);
                const add = (layer: number) => ServerVoxelManager.onAddVoxelBlockSignalReceived(
                    users[0].socketUserContext,
                    new AddVoxelBlockSignal(room.id, blockQuadIndex(INSIDE.row, INSIDE.col, layer), [0, 0, 0, 0, 0, 0]));

                for (const layer of [LOW_LAYER - 1, LOW_LAYER, HIGH_LAYER, HIGH_LAYER + 1])
                    add(layer);

                expect(blockIsThere(room, INSIDE.row, INSIDE.col, LOW_LAYER - 1)).toBe(true);
                expect(blockIsThere(room, INSIDE.row, INSIDE.col, LOW_LAYER)).toBe(false);
                expect(blockIsThere(room, INSIDE.row, INSIDE.col, HIGH_LAYER)).toBe(false);
                expect(blockIsThere(room, INSIDE.row, INSIDE.col, HIGH_LAYER + 1)).toBe(true);
            },
        });
    });

    it("lets an admin build inside a hub's zone", async () => {
        await runScenario({
            name: "admin builds inside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");
                drawZone(room, ZONE);
                becomeAdmin(users[0]);

                ServerVoxelManager.onAddVoxelBlockSignalReceived(users[0].socketUserContext,
                    new AddVoxelBlockSignal(room.id, blockQuadIndex(INSIDE.row, INSIDE.col),
                        [0, 0, 0, 0, 0, 0]));

                expect(blockIsThere(room, INSIDE.row, INSIDE.col)).toBe(true);
            },
        });
    });

    it("refuses an ordinary user's removal inside a zone, and puts the block back", async () => {
        await runScenario({
            name: "block removed inside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");

                // A zone drawn over existing blocks doesn't remove them; it stops others touching them.
                ServerVoxelManager.onAddVoxelBlockSignalReceived(users[0].socketUserContext,
                    new AddVoxelBlockSignal(room.id, blockQuadIndex(INSIDE.row, INSIDE.col),
                        [0, 0, 0, 0, 0, 0]));
                expect(blockIsThere(room, INSIDE.row, INSIDE.col)).toBe(true);

                drawZone(room, ZONE);

                ServerVoxelManager.onRemoveVoxelBlockSignalReceived(users[0].socketUserContext,
                    new RemoveVoxelBlockSignal(room.id, blockQuadIndex(INSIDE.row, INSIDE.col)));

                expect(blockIsThere(room, INSIDE.row, INSIDE.col)).toBe(true);
                expect(getPendingSignals(users[0], "addVoxelBlockSignal").length)
                    .toBeGreaterThanOrEqual(1);
            },
        });
    });

    it("refuses an ordinary user's move within, out of or into a zone, and answers with the blocks as they are", async () => {
        await runScenario({
            name: "block moved inside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");
                const inside = blockQuadIndex(INSIDE.row, INSIDE.col);
                const outside = blockQuadIndex(OUTSIDE.row, OUTSIDE.col);
                for (const quadIndex of [inside, outside])
                {
                    ServerVoxelManager.onAddVoxelBlockSignalReceived(users[0].socketUserContext,
                        new AddVoxelBlockSignal(room.id, quadIndex, [0, 0, 0, 0, 0, 0]));
                }
                drawZone(room, PARTIAL_ZONE);
                room.dirty = false;
                // The first voxel row past the zone's far edge, and the first layer over its top.
                const pastZoneRow = ZONE.rowMax + 1;
                const overZoneLayer = HIGH_LAYER + 1;

                // Moving a block within the zone, moving it out sideways, and lifting it out over the top.
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(users[0].socketUserContext,
                    new MoveVoxelBlockSignal(room.id, inside, 1, 0, 0));
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(users[0].socketUserContext,
                    new MoveVoxelBlockSignal(room.id, inside, pastZoneRow - INSIDE.row, 0, 0));
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(users[0].socketUserContext,
                    new MoveVoxelBlockSignal(room.id, inside, 0, 0, overZoneLayer - LAYER));
                // Moving a block in from outside puts a block inside the zone just as adding one would.
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(users[0].socketUserContext,
                    new MoveVoxelBlockSignal(room.id, outside, INSIDE.row + 1 - OUTSIDE.row,
                        INSIDE.col - OUTSIDE.col, 0));

                expect(blockIsThere(room, INSIDE.row, INSIDE.col)).toBe(true);
                expect(blockIsThere(room, OUTSIDE.row, OUTSIDE.col)).toBe(true);
                expect(blockIsThere(room, INSIDE.row + 1, INSIDE.col)).toBe(false);
                expect(blockIsThere(room, pastZoneRow, INSIDE.col)).toBe(false);
                expect(blockIsThere(room, INSIDE.row, INSIDE.col, overZoneLayer)).toBe(false);
                expect(room.dirty).toBe(false);

                // Each refusal is answered with what its cells hold: the block where it was, and nothing
                // where it was sent.
                expect(getPendingSignals(users[0], "addVoxelBlockSignal").map(signal => signal.quadIndex))
                    .toEqual([inside, inside, inside, outside]);
                expect(getPendingSignals(users[0], "removeVoxelBlockSignal").map(signal => signal.quadIndex))
                    .toEqual([blockQuadIndex(INSIDE.row + 1, INSIDE.col), blockQuadIndex(pastZoneRow, INSIDE.col),
                        blockQuadIndex(INSIDE.row, INSIDE.col, overZoneLayer),
                        blockQuadIndex(INSIDE.row + 1, INSIDE.col)]);

                // Outside the zone the same user moves blocks as they like.
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(users[0].socketUserContext,
                    new MoveVoxelBlockSignal(room.id, outside, 1, 0, 0));
                expect(blockIsThere(room, OUTSIDE.row, OUTSIDE.col)).toBe(false);
                expect(blockIsThere(room, OUTSIDE.row + 1, OUTSIDE.col)).toBe(true);

                // And an admin does inside it.
                becomeAdmin(users[0]);
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(users[0].socketUserContext,
                    new MoveVoxelBlockSignal(room.id, inside, 1, 0, 0));
                expect(blockIsThere(room, INSIDE.row, INSIDE.col)).toBe(false);
                expect(blockIsThere(room, INSIDE.row + 1, INSIDE.col)).toBe(true);
            },
        });
    });

    // ─── Voxel faces ───

    it("refuses a repaint inside a zone but leaves the zone's outward faces paintable", async () => {
        await runScenario({
            name: "repainting a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");

                // A block on the zone's west edge: its outward face stays editable, its inward face is in the zone.
                const edge = {row: INSIDE.row, col: ZONE.colMin};
                ServerVoxelManager.onAddVoxelBlockSignalReceived(users[0].socketUserContext,
                    new AddVoxelBlockSignal(room.id, blockQuadIndex(edge.row, edge.col),
                        [0, 0, 0, 0, 0, 0]));
                drawZone(room, ZONE);

                const outward = VoxelQueryUtil.getVoxelQuadIndex(edge.row, edge.col, "x", "-", LAYER);
                const inward = VoxelQueryUtil.getVoxelQuadIndex(edge.row, edge.col, "x", "+", LAYER);

                ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(users[0].socketUserContext,
                    new SetVoxelQuadTextureSignal(room.id, outward, 5));
                ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(users[0].socketUserContext,
                    new SetVoxelQuadTextureSignal(room.id, inward, 5));

                expect(room.voxelQuads[outward] & 0b01111111).toBe(5);
                expect(room.voxelQuads[inward] & 0b01111111).not.toBe(5);
            },
        });
    });

    it("leaves the faces a zone ends at over and under it paintable too, and keeps the room's floor where it reaches it", async () => {
        // A stack standing in the zone's ground, from the room's floor up past the zone's top.
        const stack = Array.from({length: HIGH_LAYER + 2}, (_, layer) => ({row: INSIDE.row, col: INSIDE.col, layer}));
        await runScenario({
            name: "repainting the top and bottom of a zone",
            rooms: [{...EMPTY_HUB, voxels: stack}],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                const blocked = (quadIndex: number) => RestrictedZoneUtil.blocksVoxelQuadEdit(MEMBER, room, quadIndex);
                const side = (layer: number) => VoxelQueryUtil.getVoxelQuadIndex(INSIDE.row, INSIDE.col, "x", "+", layer);
                const top = (layer: number) => VoxelQueryUtil.getVoxelQuadIndex(INSIDE.row, INSIDE.col, "y", "+", layer);
                const bottom = (layer: number) => VoxelQueryUtil.getVoxelQuadIndex(INSIDE.row, INSIDE.col, "y", "-", layer);
                // The room's own floor beside the stack, inside the zone's ground.
                const floor = VoxelQueryUtil.getFloorVoxelQuadIndex(INSIDE.row + 1, INSIDE.col);
                const ceiling = VoxelQueryUtil.getCeilingVoxelQuadIndex(INSIDE.row + 1, INSIDE.col);

                // Over part of the room's height: the sides of its blocks are the zone's, and so is what lies
                // between them, but the faces it ends at, looking up out of it and down out of it, are not.
                drawZone(room, PARTIAL_ZONE);
                expect(blocked(side(LOW_LAYER))).toBe(true);
                expect(blocked(side(HIGH_LAYER))).toBe(true);
                expect(blocked(top(LOW_LAYER))).toBe(true);
                expect(blocked(top(HIGH_LAYER))).toBe(false);
                expect(blocked(bottom(LOW_LAYER))).toBe(false);
                // Nor are the blocks under and over it, or the room's floor, which it stops short of.
                expect(blocked(side(LOW_LAYER - 1))).toBe(false);
                expect(blocked(side(HIGH_LAYER + 1))).toBe(false);
                expect(blocked(floor)).toBe(false);
                expect(blocked(ceiling)).toBe(false);

                // From floor to ceiling, the room's own floor and ceiling over its ground are its as well.
                drawZone(room, ZONE);
                expect(blocked(floor)).toBe(true);
                expect(blocked(ceiling)).toBe(true);
                expect(blocked(top(HIGH_LAYER))).toBe(true);
                expect(blocked(VoxelQueryUtil.getFloorVoxelQuadIndex(OUTSIDE.row, OUTSIDE.col))).toBe(false);
            },
        });
    });

    // ─── Whom a zone holds against ───

    it("counts the owner of a regular room, and the admin of a hub", async () => {
        await runScenario({
            name: "who a superuser is",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub"), userAtCenter("regular")],
            assertions: () => {
                const hub = getRoom("hub");
                const regular = getRoom("regular");
                // True means "the zone blocks this user", so false means superuser.
                const blocked = (user: User, room: Room) =>
                    RestrictedZoneUtil.blocksVoxelBlockEdit(user, room, INSIDE.row, INSIDE.col, LAYER);

                // In a hub, which belongs to the game, only an admin is above the rule.
                drawZone(hub, ZONE);
                expect(blocked(ADMIN, hub)).toBe(false);
                expect(blocked(MEMBER, hub)).toBe(true);
                expect(blocked(OWNER, hub)).toBe(true);

                // In a Regular room only the owner is; an admin has no extra standing.
                drawZone(regular, ZONE);
                expect(blocked(OWNER, regular)).toBe(false);
                expect(blocked(MEMBER, regular)).toBe(true);
                expect(blocked(ADMIN, regular)).toBe(true);
            },
        });
    });

    it("lets the user it is kept for edit inside it, and nobody else but the superuser", async () => {
        await runScenario({
            name: "a zone kept for a user",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub"), userAtCenter("regular")],
            assertions: () => {
                for (const [roomID, superuser] of [["hub", ADMIN], ["regular", OWNER]] as [string, User][])
                {
                    const room = getRoom(roomID);
                    clearRestrictedZones(room);
                    addRestrictedZone(room, ZONE, FRIEND.userName);
                    const canvas = makeCanvasSignal(room, FRIEND, INSIDE.row, INSIDE.col, `canvas-in-${roomID}`);
                    room.objectGroup.addObject(canvas);
                    const side = VoxelQueryUtil.getVoxelQuadIndex(INSIDE.row, INSIDE.col, "x", "+", LAYER);

                    const blockedAnywhere = (user: User) => [
                        RestrictedZoneUtil.blocksVoxelBlockEdit(user, room, INSIDE.row, INSIDE.col, LAYER),
                        RestrictedZoneUtil.blocksVoxelQuadEdit(user, room, side),
                        RestrictedZoneUtil.blocksObjectEdit(user, room, canvas.objectTypeIndex, canvas.transform),
                    ];
                    expect(blockedAnywhere(FRIEND), roomID).toEqual([false, false, false]);
                    expect(blockedAnywhere(superuser), roomID).toEqual([false, false, false]);
                    for (const user of [MEMBER, GUEST])
                        expect(blockedAnywhere(user), roomID).toEqual([true, true, true]);

                    // By the rules edits go through, too: the canvas is the friend's to take down.
                    expect(ObjectUpdateUtil.canRemoveObject(FRIEND, room, new RemoveObjectSignal(room.id, canvas.objectId)))
                        .toBe(true);
                    expect(ObjectUpdateUtil.canRemoveObject(MEMBER, room, new RemoveObjectSignal(room.id, canvas.objectId)))
                        .toBe(false);
                }
            },
        });
    });

    it("goes by the user's name as it stands, and by the name of whoever is asking", async () => {
        await runScenario({
            name: "a zone's user, on the server",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub", {userName: "Somebody#2"}), userAtCenter("hub", {userName: "somebody#2"})],
            assertions: ({users}) => {
                const room = getRoom("hub");
                addRestrictedZone(room, ZONE, "Somebody#2");
                const add = (ctx: ConnectedUser, row: number) => ServerVoxelManager.onAddVoxelBlockSignalReceived(
                    ctx.socketUserContext, new AddVoxelBlockSignal(room.id, blockQuadIndex(row, INSIDE.col), [0, 0, 0, 0, 0, 0]));

                expect(users[0].user.userName).toBe("Somebody#2");
                add(users[0], INSIDE.row);
                expect(blockIsThere(room, INSIDE.row, INSIDE.col)).toBe(true);

                // A name that differs by a letter's case is another user's.
                add(users[1], INSIDE.row + 2);
                expect(blockIsThere(room, INSIDE.row + 2, INSIDE.col)).toBe(false);
            },
        });
    });

    it("is no zone while its volume is kept for nobody", async () => {
        await runScenario({
            name: "a volume with no user",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                const volume = makeZoneSignal(room, ZONE, "", "a-volume");
                room.objectGroup.addObject(volume);
                const blocked = () => RestrictedZoneUtil.blocksVoxelBlockEdit(MEMBER, room, INSIDE.row, INSIDE.col, LAYER);
                const keepFor = (userName: string) => expect(ObjectUpdateUtil.setObjectMetadata(ADMIN, room,
                    new SetObjectMetadataSignal(room.id, volume.objectId, ObjectMetadataKeyEnumMap.ZoneUserName, userName)))
                    .toBe(true);

                expect(RestrictedZoneUtil.isZone(volume)).toBe(false);
                expect(blocked()).toBe(false);

                // Kept for somebody, it holds against everybody else; for nobody again, against nobody.
                keepFor(FRIEND.userName);
                expect(RestrictedZoneUtil.isZone(volume)).toBe(true);
                expect(blocked()).toBe(true);
                keepFor("   ");
                expect(RestrictedZoneUtil.isZone(volume)).toBe(false);
                expect(blocked()).toBe(false);

                // A name no user has keeps it for the superuser alone.
                keepFor("no one");
                expect(blocked()).toBe(true);
                expect(RestrictedZoneUtil.blocksVoxelBlockEdit(ADMIN, room, INSIDE.row, INSIDE.col, LAYER)).toBe(false);
            },
        });
    });

    it("is kept from every user but the superuser where it names \"*\" in place of one, whatever anyone is called", async () => {
        await runScenario({
            name: "a zone kept for nobody",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub", {userName: ZONE_USER_NAME_FOR_NOBODY}), userAtCenter("regular")],
            assertions: ({users}) => {
                expect(ZONE_USER_NAME_FOR_NOBODY).toBe("*");
                // Somebody whose own name is the very thing the zone names.
                const namesake = new User("a-namesake", ZONE_USER_NAME_FOR_NOBODY, UserTypeEnumMap.Member, "", "");

                for (const [roomID, superuser] of [["hub", ADMIN], ["regular", OWNER]] as [string, User][])
                {
                    const room = getRoom(roomID);
                    clearRestrictedZones(room);
                    const zone = addRestrictedZone(room, ZONE, ZONE_USER_NAME_FOR_NOBODY);
                    const blocked = (user: User) =>
                        RestrictedZoneUtil.blocksVoxelBlockEdit(user, room, INSIDE.row, INSIDE.col, LAYER);

                    expect(RestrictedZoneUtil.isZone(zone), roomID).toBe(true);
                    expect(blocked(superuser), roomID).toBe(false);
                    for (const user of [MEMBER, FRIEND, GUEST, namesake])
                        expect(blocked(user), `${roomID}, ${user.userName}`).toBe(true);
                }

                // As the server holds it against a user who came in under that name.
                const hub = getRoom("hub");
                expect(users[0].user.userName).toBe(ZONE_USER_NAME_FOR_NOBODY);
                ServerVoxelManager.onAddVoxelBlockSignalReceived(users[0].socketUserContext,
                    new AddVoxelBlockSignal(hub.id, blockQuadIndex(INSIDE.row, INSIDE.col), [0, 0, 0, 0, 0, 0]));
                expect(blockIsThere(hub, INSIDE.row, INSIDE.col)).toBe(false);
            },
        });
    });

    it("holds where any zone over a block holds: one kept for a user doesn't open another's to them", async () => {
        await runScenario({
            name: "zones over the same ground",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                clearRestrictedZones(room);
                addRestrictedZone(room, ZONE, FRIEND.userName);
                // Over the first one's first rows only, and kept for somebody else.
                addRestrictedZone(room, {...ZONE, rowMax: INSIDE.row}, MEMBER.userName);
                const blocked = (user: User, row: number) =>
                    RestrictedZoneUtil.blocksVoxelBlockEdit(user, room, row, INSIDE.col, LAYER);

                // Where both lie, each keeps the other's user out.
                expect(blocked(FRIEND, INSIDE.row)).toBe(true);
                expect(blocked(MEMBER, INSIDE.row)).toBe(true);
                // Where only the first does, it is the friend's.
                expect(blocked(FRIEND, INSIDE.row + 1)).toBe(false);
                expect(blocked(MEMBER, INSIDE.row + 1)).toBe(true);
                expect(blocked(ADMIN, INSIDE.row)).toBe(false);
            },
        });
    });

    // ─── Objects ───

    it("refuses an ordinary user's canvas that would reach into a zone", async () => {
        await runScenario({
            name: "canvas inside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                const inside = makeCanvasSignal(room, MEMBER, INSIDE.row, INSIDE.col);
                const outside = makeCanvasSignal(room, MEMBER, OUTSIDE.row, OUTSIDE.col);
                const blocks = (user: User, obj: AddObjectSignal) =>
                    RestrictedZoneUtil.blocksObjectEdit(user, room,
                        obj.objectTypeIndex, obj.transform);

                // A room with no zones in it holds nothing against anybody.
                expect(blocks(MEMBER, inside)).toBe(false);

                drawZone(room, ZONE);
                expect(blocks(MEMBER, inside)).toBe(true);
                expect(blocks(MEMBER, outside)).toBe(false);
                expect(blocks(ADMIN, inside)).toBe(false);

                // Also refused via canAddObject, the path clients hit (an admin's is refused too, but for
                // wall validity, not the zone).
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, inside))
                    .toBe(false);

                // Over part of the room's height, it holds for what reaches into those layers alone.
                drawZone(room, PARTIAL_ZONE);
                const zoneMiddleY = 0.5 * (LOW_LAYER + HIGH_LAYER + 1) * COLLISION_LAYER_HEIGHT;
                const zoneTopY = (HIGH_LAYER + 1) * COLLISION_LAYER_HEIGHT;
                const at = (y: number) => makeCanvasSignal(room, MEMBER, INSIDE.row, INSIDE.col, "a-canvas", y);
                expect(blocks(MEMBER, at(zoneMiddleY))).toBe(true);
                expect(blocks(MEMBER, at(zoneTopY + 1))).toBe(false);
            },
        });
    });

    it("refuses taking down, and dragging out of, a canvas standing in a zone", async () => {
        await runScenario({
            name: "canvas already inside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");

                const canvas = makeCanvasSignal(room, MEMBER, INSIDE.row, INSIDE.col);
                room.objectGroup.addObject(canvas);
                drawZone(room, ZONE);

                expect(ObjectUpdateUtil.canRemoveObject(MEMBER, room,
                    new RemoveObjectSignal(room.id, canvas.objectId))).toBe(false);

                // Dragging out of a zone is refused too, or removal could be done in two steps.
                expect(ObjectUpdateUtil.canSetObjectTransform(MEMBER, room,
                    new SetObjectTransformSignal(room.id, canvas.objectId,
                        new ObjectTransform(voxelMiddle(OUTSIDE.row, OUTSIDE.col, 2),
                            {x: 0, y: 0, z: -1}, {...UNIT_VEC3}), false))).toBe(false);
            },
        });
    });

    it("refuses repainting a canvas standing in a zone", async () => {
        await runScenario({
            name: "canvas metadata inside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");

                const inside = makeCanvasSignal(room, MEMBER, INSIDE.row, INSIDE.col, "inside-canvas");
                const outside = makeCanvasSignal(room, MEMBER, OUTSIDE.row, OUTSIDE.col, "outside-canvas");
                room.objectGroup.addObject(inside);
                room.objectGroup.addObject(outside);

                const newPicture = (objectId: string) => new SetObjectMetadataSignal(room.id,
                    objectId, ObjectMetadataKeyEnumMap.ImagePath, CANVAS_IMAGE_PATH);

                // With no zone drawn, the picture is anybody's to change.
                expect(ObjectUpdateUtil.canSetObjectMetadata(MEMBER, room,
                    newPicture(inside.objectId))).toBe(true);

                // A picture's image in a zone is protected like the wall behind it.
                drawZone(room, ZONE);
                expect(ObjectUpdateUtil.canSetObjectMetadata(MEMBER, room,
                    newPicture(inside.objectId))).toBe(false);
                expect(ObjectUpdateUtil.canSetObjectMetadata(MEMBER, room,
                    newPicture(outside.objectId))).toBe(true);
                expect(ObjectUpdateUtil.canSetObjectMetadata(ADMIN, room,
                    newPicture(inside.objectId))).toBe(true);
            },
        });
    });

    it("leaves a canvas on a zone's outer wall editable, and protects one on its inner side", async () => {
        // A wall along the zone's west edge, two voxels thick and six long, tall enough for a canvas on either
        // side of it: where its outer and inner faces lie in the world, and the middle of its length.
        const NUM_WALL_COLS = 2, FIRST_WALL_ROW = 18, NUM_WALL_ROWS = 6;
        const outerX = ZONE.colMin * VOXEL_CELL_SIZE;
        const innerX = (ZONE.colMin + NUM_WALL_COLS) * VOXEL_CELL_SIZE;
        const middleZ = (FIRST_WALL_ROW + 0.5 * NUM_WALL_ROWS) * VOXEL_CELL_SIZE;
        const wall: {row: number, col: number, layer: number}[] = [];
        for (let row = FIRST_WALL_ROW; row < FIRST_WALL_ROW + NUM_WALL_ROWS; ++row)
            for (let col = ZONE.colMin; col < ZONE.colMin + NUM_WALL_COLS; ++col)
                for (let layer = COLLISION_LAYER_MIN; layer < COLLISION_LAYER_MIN + 6; ++layer)
                    wall.push({row, col, layer});

        await runScenario({
            name: "canvases on a zone's edge wall",
            rooms: [{...EMPTY_HUB, voxels: wall}],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                drawZone(room, ZONE);

                // The wall belongs to the zone, but what hangs on its outer face stands outside it.
                const hang = (user: User, objectId: string, x: number, dirX: number) =>
                    new AddObjectSignal(room.id, user.id, user.userName, canvasTypeIndex, objectId,
                        new ObjectTransform({x, y: 1.5, z: middleZ}, {x: dirX, y: 0, z: 0}, {...UNIT_VEC3}));
                const outer = hang(MEMBER, "outer-canvas", outerX, -1);

                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, outer)).toBe(true);
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room,
                    hang(MEMBER, "inner-canvas", innerX, 1))).toBe(false);
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room,
                    hang(ADMIN, "inner-canvas", innerX, 1))).toBe(true);

                room.objectGroup.addObject(outer);
                expect(ObjectUpdateUtil.canSetObjectMetadata(MEMBER, room,
                    new SetObjectMetadataSignal(room.id, outer.objectId,
                        ObjectMetadataKeyEnumMap.ImagePath, CANVAS_IMAGE_PATH))).toBe(true);
                expect(ObjectUpdateUtil.canRemoveObject(MEMBER, room,
                    new RemoveObjectSignal(room.id, outer.objectId))).toBe(true);
            },
        });
    });

    it("leaves a canvas lying on the top a zone ends at editable, and protects one on the floor it reaches", async () => {
        // A platform in the zone's ground, as high as the zone that covers part of the room's height.
        const platform: {row: number, col: number, layer: number}[] = [];
        for (let row = INSIDE.row; row < INSIDE.row + 4; ++row)
            for (let col = INSIDE.col; col < INSIDE.col + 4; ++col)
                for (let layer = COLLISION_LAYER_MIN; layer <= HIGH_LAYER; ++layer)
                    platform.push({row, col, layer});
        const middle = {x: (INSIDE.col + 2) * VOXEL_CELL_SIZE, z: (INSIDE.row + 2) * VOXEL_CELL_SIZE};

        await runScenario({
            name: "canvases over and under a zone",
            rooms: [{...EMPTY_HUB, voxels: platform}],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                const lay = (user: User, objectId: string, x: number, y: number, z: number) =>
                    new AddObjectSignal(room.id, user.id, user.userName, canvasTypeIndex, objectId,
                        new ObjectTransform({x, y, z}, {x: 0, y: 1, z: 0}, {...UNIT_VEC3}));
                const onTop = lay(MEMBER, "on-top", middle.x, (HIGH_LAYER + 1) * COLLISION_LAYER_HEIGHT, middle.z);
                // On the room's own floor, beside the platform and inside the zone's ground.
                const onFloor = lay(MEMBER, "on-floor", middle.x, 0, middle.z + 4 * VOXEL_CELL_SIZE);

                // The platform's blocks are the zone's, but what lies on the top it ends at stands outside it.
                drawZone(room, PARTIAL_ZONE);
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, onTop)).toBe(true);
                // And the zone stops short of the floor.
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, onFloor)).toBe(true);

                // Reaching the floor, it keeps what lies on the floor.
                drawZone(room, {...PARTIAL_ZONE, collisionLayerMin: COLLISION_LAYER_MIN});
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, onFloor)).toBe(false);
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room,
                    lay(ADMIN, "on-floor", middle.x, 0, middle.z + 4 * VOXEL_CELL_SIZE))).toBe(true);
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, onTop)).toBe(true);
            },
        });
    });

    it("lets a player walk through a zone", async () => {
        await runScenario({
            name: "player inside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                drawZone(room, ZONE);

                // Zones restrict building, not standing; players are never checked.
                expect(RestrictedZoneUtil.blocksObjectEdit(MEMBER, room, playerTypeIndex,
                    new ObjectTransform(voxelMiddle(INSIDE.row, INSIDE.col, 1),
                        {x: 0, y: 0, z: -1}, {...UNIT_VEC3}))).toBe(false);
            },
        });
    });

    // ─── Drawing the zones themselves ───

    it("is drawn by a hub's admin as a volume kept for a user, which tells the room and leaves it to be saved", async () => {
        await runScenario({
            name: "admin draws a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub"), userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");
                becomeAdmin(users[0]);
                const admin = users[0].user;
                const volume = new AddObjectSignal(room.id, admin.id, admin.userName,
                    ObjectTypeConfigMap.getIndexByType("Volume"), "a-volume", zoneTransform(ZONE));
                const add = () => ServerVoxelManager.onAddVoxelBlockSignalReceived(users[1].socketUserContext,
                    new AddVoxelBlockSignal(room.id, blockQuadIndex(INSIDE.row, INSIDE.col), [0, 0, 0, 0, 0, 0]));
                const remove = () => ServerVoxelManager.onRemoveVoxelBlockSignalReceived(users[1].socketUserContext,
                    new RemoveVoxelBlockSignal(room.id, blockQuadIndex(INSIDE.row, INSIDE.col)));

                // Laid, it restricts nobody yet.
                expect(ServerObjectManager.onAddObjectSignalReceived(users[0].socketUserContext, volume)).toBe(true);
                add();
                expect(blockIsThere(room, INSIDE.row, INSIDE.col)).toBe(true);

                // Kept for a user, it does.
                room.dirty = false;
                ServerObjectManager.onSetObjectMetadataSignalReceived(users[0].socketUserContext,
                    new SetObjectMetadataSignal(room.id, volume.objectId, ObjectMetadataKeyEnumMap.ZoneUserName, NO_ONE));
                expect(VolumeObjectTypeConfig.util.getZoneUserName(room.objectById[volume.objectId])).toBe(NO_ONE);
                expect(room.dirty).toBe(true);
                remove();
                expect(blockIsThere(room, INSIDE.row, INSIDE.col)).toBe(true);

                // Everybody else in the room is told, and the sender is not told twice.
                expect(getPendingSignals(users[1], "addObjectSignal").map(signal => signal.objectId)).toContain(volume.objectId);
                expect(getPendingSignals(users[1], "setObjectMetadataSignal").length).toBe(1);
                expect(getPendingSignals(users[0], "setObjectMetadataSignal").length).toBe(0);

                // Drawn in to leave the block outside, it lets go of it; and removed, of everything.
                ServerObjectManager.onSetObjectTransformSignalReceived(users[0].socketUserContext,
                    new SetObjectTransformSignal(room.id, volume.objectId,
                        zoneTransform({...ZONE, rowMin: INSIDE.row + 1}), true));
                expect(RestrictedZoneUtil.blocksVoxelBlockEdit(users[1].user, room, INSIDE.row, INSIDE.col, LAYER)).toBe(false);
                expect(RestrictedZoneUtil.blocksVoxelBlockEdit(users[1].user, room, INSIDE.row + 1, INSIDE.col, LAYER)).toBe(true);
                expect(ServerObjectManager.onRemoveObjectSignalReceived(users[0].socketUserContext,
                    new RemoveObjectSignal(room.id, volume.objectId))).toBe(true);
                expect(RestrictedZoneUtil.blocksVoxelBlockEdit(users[1].user, room, INSIDE.row + 1, INSIDE.col, LAYER)).toBe(false);
            },
        });
    });

    it("is drawn by a regular room's owner in their own room, for themselves or for a friend", async () => {
        await runScenario({
            name: "owner draws a zone",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter("regular")],
            assertions: () => {
                const room = getRoom("regular");
                const volume = new AddObjectSignal(room.id, OWNER.id, OWNER.userName,
                    ObjectTypeConfigMap.getIndexByType("Volume"), "a-volume", zoneTransform(ZONE));
                const keepFor = (user: User, userName: string) => ObjectUpdateUtil.setObjectMetadata(user, room,
                    new SetObjectMetadataSignal(room.id, volume.objectId, ObjectMetadataKeyEnumMap.ZoneUserName, userName));
                const blocked = (user: User) =>
                    RestrictedZoneUtil.blocksVoxelBlockEdit(user, room, INSIDE.row, INSIDE.col, LAYER);

                expect(ObjectUpdateUtil.addObject(OWNER, room, volume)).toBe(true);

                // For themselves, it keeps everybody else out; for a friend, everybody but the two of them.
                expect(keepFor(OWNER, OWNER.userName)).toBe(true);
                expect([OWNER, FRIEND, MEMBER].map(blocked)).toEqual([false, true, true]);
                expect(keepFor(OWNER, FRIEND.userName)).toBe(true);
                expect([OWNER, FRIEND, MEMBER].map(blocked)).toEqual([false, false, true]);

                // The friend may edit what is in it, and may not make it anybody else's.
                expect(keepFor(FRIEND, MEMBER.userName)).toBe(false);
                expect(VolumeObjectTypeConfig.util.getZoneUserName(room.objectById[volume.objectId])).toBe(FRIEND.userName);
            },
        });
    });

    it("says so whenever a volume changes, for whoever draws the room's zones", async () => {
        await runScenario({
            name: "zone changes announced",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                const heard: string[] = [];
                restrictedZonesChangedObservable.addListener("restricted-zones-test", roomID => { heard.push(roomID); });
                try
                {
                    const volume = new AddObjectSignal(room.id, ADMIN.id, ADMIN.userName,
                        ObjectTypeConfigMap.getIndexByType("Volume"), "a-volume", zoneTransform(ZONE));
                    const numHeardAfter = (edit: () => unknown) => { heard.length = 0; edit(); return heard.length; };

                    expect(numHeardAfter(() => ObjectUpdateUtil.addObject(ADMIN, room, volume))).toBe(1);
                    expect(numHeardAfter(() => ObjectUpdateUtil.setObjectMetadata(ADMIN, room, new SetObjectMetadataSignal(
                        room.id, volume.objectId, ObjectMetadataKeyEnumMap.ZoneUserName, NO_ONE)))).toBe(1);
                    expect(numHeardAfter(() => ObjectUpdateUtil.setObjectTransform(ADMIN, room, new SetObjectTransformSignal(
                        room.id, volume.objectId, zoneTransform(PARTIAL_ZONE), true)))).toBe(1);
                    expect(numHeardAfter(() => ObjectUpdateUtil.removeObject(ADMIN, room,
                        new RemoveObjectSignal(room.id, volume.objectId)))).toBe(1);
                    expect(heard).toEqual([room.id]);

                    // Nothing else is a zone's change.
                    const canvas = makeCanvasSignal(room, ADMIN, OUTSIDE.row, OUTSIDE.col);
                    expect(numHeardAfter(() => ObjectUpdateUtil.addObject(ADMIN, room, canvas, false))).toBe(0);
                    expect(numHeardAfter(() => ObjectUpdateUtil.removeObject(ADMIN, room,
                        new RemoveObjectSignal(room.id, canvas.objectId), false))).toBe(0);
                }
                finally
                {
                    restrictedZonesChangedObservable.removeListener("restricted-zones-test");
                }
            },
        });
    });

    it("carries a room's zones through a save and a reload", async () => {
        await runScenario({
            name: "zones survive storage",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: async () => {
                const room = getRoom("hub");
                clearRestrictedZones(room);
                addRestrictedZone(room, PARTIAL_ZONE, FRIEND.userName, "zone-a");
                addRestrictedZone(room, {rowMin: 20, rowMax: 20, colMin: 0, colMax: NUM_VOXEL_COLS - 1}, NO_ONE, "zone-b");
                const zonesOf = (zoned: Room) => Object.values(zoned.objectById).filter(RestrictedZoneUtil.isZone)
                    .map(zone => ({objectId: zone.objectId, userName: VolumeObjectTypeConfig.util.getZoneUserName(zone),
                        blocks: {...VolumeObjectTypeConfig.util.getRoomVolume(zone.transform)}}));
                expect(zonesOf(room)).toHaveLength(2);

                const dbRoomUtil = (await import("../../../src/server/db/util/dbRoomUtil")).default;
                expect(await dbRoomUtil.saveRoomContent(room)).toBe(true);

                const reloaded = await dbRoomUtil.getRoomContent(room.id);
                expect(zonesOf(reloaded!)).toEqual(zonesOf(room));
                // (A row the second zone, which is nobody's, doesn't cross.)
                expect(RestrictedZoneUtil.blocksVoxelBlockEdit(MEMBER, reloaded!, INSIDE.row + 1, INSIDE.col, LAYER)).toBe(true);
                expect(RestrictedZoneUtil.blocksVoxelBlockEdit(FRIEND, reloaded!, INSIDE.row + 1, INSIDE.col, LAYER)).toBe(false);
                expect(RestrictedZoneUtil.blocksVoxelBlockEdit(FRIEND, reloaded!, INSIDE.row, INSIDE.col, LAYER)).toBe(true);
            },
        });
    });

    it("puts the player of the sandbox and of the room editor above its zones, whatever their role", async () => {
        // Nobody else is in it, so there is nobody a zone could be protecting the room from.
        await runScenario({
            name: "zones in the sandbox",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                drawZone(room, ZONE);
                for (const mode of [SANDBOX_SINGLE_PLAYER_MODE, ROOM_EDITOR_SINGLE_PLAYER_MODE])
                {
                    const own = Object.create(Object.getPrototypeOf(room),
                        Object.getOwnPropertyDescriptors(room)) as Room;
                    own.roomType = RoomTypeEnumMap.SinglePlayer;
                    own.roomName = mode;

                    expect(RestrictedZoneUtil.blocksVoxelBlockEdit(MEMBER, own, INSIDE.row, INSIDE.col, LAYER), mode)
                        .toBe(false);
                }
                expect(RestrictedZoneUtil.blocksVoxelBlockEdit(MEMBER, room, INSIDE.row, INSIDE.col, LAYER)).toBe(true);
            },
        });
    });
});
