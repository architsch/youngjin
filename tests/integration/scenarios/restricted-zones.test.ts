/**
 * Restricted zones: the stretches of a room only a superuser may edit.
 *
 * A zone is a rectangle of the voxel grid reaching the whole height of the room, and inside one the
 * right to edit voxels and persistent objects belongs to the admin (in a hub) or the room's owner
 * (in a regular room) alone. See @docs/gameplay/restricted_zone.md.
 *
 * What is asserted here is the rule as the *server* enforces it, because that is the only place it
 * counts: a client that has been talked into ignoring a zone still has to get past this. The
 * refusals therefore go in as signals and come back out as the rollback the sender is sent, which is
 * what a real client would receive.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import { ConnectedUser } from "../helpers/serverHarness";

import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import Room from "../../../src/shared/room/types/room";
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
import "../../../src/shared/graphics/image/maps/canvasImageMap";
import RestrictedZone from "../../../src/shared/voxel/types/restrictedZone";
import RestrictedZoneUtil from "../../../src/shared/voxel/util/restrictedZoneUtil";
import SetRestrictedZonesSignal from "../../../src/shared/voxel/types/update/setRestrictedZonesSignal";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MIN, MAX_RESTRICTED_ZONES,
    NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";

// The zone every test below draws, well clear of the room's boundary walls and of the stretch its
// own door hangs on, so that nothing here is really asking about those.
const ZONE = new RestrictedZone(8, 15, 8, 15);

// A cell inside that zone, and one outside it, at a height the room is hollow at.
const INSIDE = {row: 10, col: 10};
const OUTSIDE = {row: 20, col: 20};
const LAYER = COLLISION_LAYER_MIN + 2;

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
// A picture the canvas rule will actually accept — it checks the value against CanvasImageMap, so
// what matters here is only that it is one of the authored ones.
const CANVAS_IMAGE_PATH = "1/1";
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");

function makeUser(id: string, userType: number, ownedRoomID: string = ""): User
{
    return new User(id, `User_${id}`, userType, `${id}@test.com`, "", "", ownedRoomID);
}

const ADMIN = makeUser("an-admin", UserTypeEnumMap.Admin);
const MEMBER = makeUser("a-member", UserTypeEnumMap.Member);
// The owner of the regular room below. Owning a room is a matter of the user naming it as his own,
// which is what every permission check reads.
const OWNER = makeUser("an-owner", UserTypeEnumMap.Member, "regular");

function getRoom(roomID: string): Room
{
    return ServerRoomManager.roomRuntimeMemories[roomID].room;
}

// Draws the zone straight onto the room, rather than through a signal. Setting the zones up is not
// what these tests are about — the tests that are, are at the bottom of this file.
function drawZone(room: Room, ...zones: RestrictedZone[]): void
{
    room.voxelGrid.restrictedZones = zones;
}

// Makes the given user whatever kind of person the test needs, since a socket user arrives as an
// ordinary guest and being an admin is a property of the person rather than of the room.
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
    return VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer);
}

// A canvas hung on the wall at the given cell. Only where its collider ends up matters here, so this
// is deliberately not asking whether that is a wall a canvas could really be hung on.
function makeCanvasSignal(room: Room, user: User, row: number, col: number,
    objectId: string = "a-canvas"): AddObjectSignal
{
    return new AddObjectSignal(room.id, user.id, user.userName, canvasTypeIndex, objectId,
        new ObjectTransform({x: col + 0.5, y: 2, z: row + 0.5}, {x: 0, y: 0, z: -1}));
}

describe("restricted zones", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    //-------------------------------------------------------------------------------------------
    // Voxel blocks
    //-------------------------------------------------------------------------------------------

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

                // Built before the zone is drawn over it. A zone drawn over what is already there
                // does not take it away; it stops anybody else touching it.
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

    //-------------------------------------------------------------------------------------------
    // Voxel faces
    //-------------------------------------------------------------------------------------------

    it("refuses a repaint inside a zone but leaves the zone's outward faces paintable", async () => {
        await runScenario({
            name: "repainting a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");

                // A block on the zone's own western edge, built before the zone is drawn. Its
                // outward face is the surface the zone is seen through from outside it, and stays
                // the room's to finish; the face pointing the other way is inside the zone.
                const edge = {row: 10, col: ZONE.colMin};
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

    //-------------------------------------------------------------------------------------------
    // Who counts as a superuser
    //-------------------------------------------------------------------------------------------

    it("counts the owner of a regular room, and the admin of a hub", async () => {
        await runScenario({
            name: "who a superuser is",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub"), userAtCenter("regular")],
            assertions: () => {
                const hub = getRoom("hub");
                const regular = getRoom("regular");
                // Reads as "the zone shuts this user out", so `false` is what being a superuser
                // looks like here.
                const blocked = RestrictedZoneUtil.blocksVoxelBlockEdit;

                // In a hub, which belongs to the game, only an admin is above the rule.
                drawZone(hub, ZONE);
                expect(blocked(ADMIN, hub, INSIDE.row, INSIDE.col)).toBe(false);
                expect(blocked(MEMBER, hub, INSIDE.row, INSIDE.col)).toBe(true);
                expect(blocked(OWNER, hub, INSIDE.row, INSIDE.col)).toBe(true);

                // In a regular room, which belongs to one person, only that person is — and an
                // admin has no standing there that anybody else lacks.
                drawZone(regular, ZONE);
                expect(blocked(OWNER, regular, INSIDE.row, INSIDE.col)).toBe(false);
                expect(blocked(MEMBER, regular, INSIDE.row, INSIDE.col)).toBe(true);
                expect(blocked(ADMIN, regular, INSIDE.row, INSIDE.col)).toBe(true);
            },
        });
    });

    //-------------------------------------------------------------------------------------------
    // Objects
    //-------------------------------------------------------------------------------------------

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
                        obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);

                // A room with no zones in it holds nothing against anybody.
                expect(blocks(MEMBER, inside)).toBe(false);

                drawZone(room, ZONE);
                expect(blocks(MEMBER, inside)).toBe(true);
                expect(blocks(MEMBER, outside)).toBe(false);
                expect(blocks(ADMIN, inside)).toBe(false);

                // And the refusal is reached through the same door every other object rule is —
                // this is what a client's request actually runs into. (An admin's is turned away
                // here too, but on the separate question of whether that is a wall a canvas can
                // hang on at all, which is what the assertions above hold this one apart from.)
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, inside))
                    .toBe(false);
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
                room.objectById[canvas.objectId] = canvas;
                drawZone(room, ZONE);

                expect(ObjectUpdateUtil.canRemoveObject(MEMBER, room,
                    new RemoveObjectSignal(room.id, canvas.objectId))).toBe(false);

                // Dragging it out of the zone is refused as well as dragging one in. Allowing the
                // way out would leave the removal rule undone in two steps instead of one.
                expect(ObjectUpdateUtil.canSetObjectTransform(MEMBER, room,
                    new SetObjectTransformSignal(room.id, canvas.objectId,
                        new ObjectTransform({x: OUTSIDE.col + 0.5, y: 2, z: OUTSIDE.row + 0.5},
                            {x: 0, y: 0, z: -1}), false))).toBe(false);
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
                room.objectById[inside.objectId] = inside;
                room.objectById[outside.objectId] = outside;

                const newPicture = (objectId: string) => new SetObjectMetadataSignal(room.id,
                    objectId, ObjectMetadataKeyEnumMap.ImagePath, CANVAS_IMAGE_PATH);

                // With no zone drawn, the picture is anybody's to change.
                expect(ObjectUpdateUtil.canSetObjectMetadata(MEMBER, room,
                    newPicture(inside.objectId))).toBe(true);

                // What a picture inside a zone shows is as much a part of that stretch of the room
                // as the wall behind it, so it goes out of reach along with the wall.
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

    it("lets a player walk through a zone", async () => {
        await runScenario({
            name: "player inside a zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                drawZone(room, ZONE);

                // A zone says who may build here, not who may stand here — and a player is not
                // something the room keeps, so it is never asked about at all.
                expect(RestrictedZoneUtil.blocksObjectEdit(MEMBER, room,
                    playerTypeIndex, {x: INSIDE.col + 0.5, y: 1, z: INSIDE.row + 0.5},
                    {x: 0, y: 0, z: -1})).toBe(false);
            },
        });
    });

    //-------------------------------------------------------------------------------------------
    // Drawing the zones themselves
    //-------------------------------------------------------------------------------------------

    it("lets an admin redraw a hub's zones, tells the room, and leaves the room to be saved later",
        async () => {
        await runScenario({
            name: "admin redraws the zones",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub"), userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");
                becomeAdmin(users[0]);
                room.dirty = false;

                ServerVoxelManager.onSetRestrictedZonesSignalReceived(users[0].socketUserContext,
                    new SetRestrictedZonesSignal(room.id, [ZONE]));

                expect(room.voxelGrid.restrictedZones).toEqual([ZONE]);

                // Marked for the periodic save rather than written out on the spot — a zone is
                // dragged about, and each frame of that is not worth a room's worth of storage.
                expect(room.dirty).toBe(true);

                // Everybody else in the room is told, and the sender is not told twice.
                expect(getPendingSignals(users[1], "setRestrictedZonesSignal").length).toBe(1);
                expect(getPendingSignals(users[0], "setRestrictedZonesSignal").length).toBe(0);
            },
        });
    });

    it("refuses an ordinary user's redraw, and hands him the room's own zones back", async () => {
        await runScenario({
            name: "ordinary user redraws the zones",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const room = getRoom("hub");
                drawZone(room, ZONE);

                ServerVoxelManager.onSetRestrictedZonesSignalReceived(users[0].socketUserContext,
                    new SetRestrictedZonesSignal(room.id, [new RestrictedZone(0, 31, 0, 31)]));

                expect(room.voxelGrid.restrictedZones).toEqual([ZONE]);

                // The whole list is what was sent, so the whole list is what puts him right again.
                const rollback = getPendingSignals(users[0], "setRestrictedZonesSignal");
                expect(rollback.length).toBe(1);
                expect(rollback[0].restrictedZones).toEqual([ZONE]);
            },
        });
    });

    it("refuses a list that is too long, out of range, or inside out", async () => {
        await runScenario({
            name: "malformed zone lists",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                const canSet = (zones: RestrictedZone[]) =>
                    RestrictedZoneUtil.canSetRestrictedZones(ADMIN, room, zones);

                expect(canSet([ZONE])).toBe(true);
                expect(canSet([])).toBe(true);

                const tooMany: RestrictedZone[] = [];
                for (let i = 0; i <= MAX_RESTRICTED_ZONES; ++i)
                    tooMany.push(new RestrictedZone(i, i, 0, 0));
                expect(canSet(tooMany)).toBe(false);

                expect(canSet([new RestrictedZone(-1, 4, 0, 4)])).toBe(false);
                expect(canSet([new RestrictedZone(0, NUM_VOXEL_ROWS, 0, 4)])).toBe(false);
                expect(canSet([new RestrictedZone(0, 4, 0, NUM_VOXEL_COLS)])).toBe(false);
                expect(canSet([new RestrictedZone(9, 4, 0, 4)])).toBe(false); // inside out
                expect(canSet([new RestrictedZone(0, 4, 9, 4)])).toBe(false); // inside out
                expect(canSet([new RestrictedZone(0.5, 4, 0, 4)])).toBe(false); // not whole voxels
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
                drawZone(room, ZONE, new RestrictedZone(20, 20, 0, NUM_VOXEL_COLS - 1));

                const dbRoomUtil = (await import("../../../src/server/db/util/dbRoomUtil")).default;
                expect(await dbRoomUtil.saveRoomContent(room)).toBe(true);

                const reloaded = await dbRoomUtil.getRoomContent(room.id, room.roomName,
                    room.roomType, room.ownerUserID, room.ownerUserName, room.texturePackPath);
                expect(reloaded?.voxelGrid.restrictedZones).toEqual(room.voxelGrid.restrictedZones);
            },
        });
    });

    it("keeps a user's role out of the question in a single-player room", async () => {
        // Nobody else is in it, so there is nobody a zone could be protecting the room from.
        await runScenario({
            name: "zones in a single-player room",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getRoom("hub");
                const singlePlayer = Object.create(Object.getPrototypeOf(room),
                    Object.getOwnPropertyDescriptors(room)) as Room;
                singlePlayer.roomType = 2; // RoomTypeEnumMap.SinglePlayer
                drawZone(singlePlayer, ZONE);

                expect(RestrictedZoneUtil.blocksVoxelBlockEdit(MEMBER, singlePlayer, INSIDE.row, INSIDE.col)).toBe(false);
            },
        });
    });
});
