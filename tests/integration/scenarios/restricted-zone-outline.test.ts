/**
 * Scenario tests: restricted zones as the room's faces show them (see RestrictedZoneOutlineUtil) — every face
 * of a block in a zone outlined, along rows, columns and layers, with the room's own floor and ceiling where
 * the zone reaches them; in edit mode alone, and for everybody; and followed as the room's volumes change.
 * Browser-bound client modules are stubbed; the room and the rule that reads its zones run for real.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    return { default: { getCamera: () => camera, getScene: () => scene } };
});

vi.mock("../../../src/client/app", () => ({
    default: {
        getCurrentRoom: vi.fn(),
        getVoxelQuads: vi.fn(),
        getUser: vi.fn(),
        getEnv: vi.fn(),
    },
}));

import App from "../../../src/client/app";
import InstancedMeshGraphics from "../../../src/client/object/components/instancedMeshGraphics";
import { gameModeObservable } from "../../../src/client/system/clientObservables";
import ClientVoxelQueryUtil from "../../../src/client/voxel/util/clientVoxelQueryUtil";
import RestrictedZoneOutlineUtil from "../../../src/client/voxel/util/restrictedZoneOutlineUtil";
import VoxelQuadInstanceUtil from "../../../src/client/voxel/util/voxelQuadInstanceUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import Room from "../../../src/shared/room/types/room";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { createEditingUser } from "../helpers/mockUser";
import { addRestrictedZone, zoneTransform, ZoneBlocks } from "../helpers/restrictedZone";
import { ceilingQuadIndexOf, createRoom, floorQuadIndexOf, quadIndexOf } from "../helpers/selectionHarness";

// The acting user, an admin: the hub's superuser, whom no zone holds against.
const actingUser = createEditingUser();

// Over part of the room's height, clear of its floor and its boundary walls.
const LOW_LAYER = COLLISION_LAYER_MIN + 1;
const HIGH_LAYER = COLLISION_LAYER_MIN + 4;
const ZONE: ZoneBlocks = {rowMin: 17, rowMax: 30, colMin: 17, colMax: 30,
    collisionLayerMin: LOW_LAYER, collisionLayerMax: HIGH_LAYER};
const INSIDE = {row: 20, col: 20};
const OUTSIDE = {row: 40, col: 40};

const FACES: ["x" | "y" | "z", "-" | "+"][] = [["x", "-"], ["x", "+"], ["y", "-"], ["y", "+"], ["z", "-"], ["z", "+"]];

let room: Room;

/** How every face of a block is outlined, in the order of FACES. */
function outlinesOfBlock(row: number, col: number, layer: number): number[]
{
    return FACES.map(([axis, orientation]) =>
        RestrictedZoneOutlineUtil.getOutlineStrength(quadIndexOf(row, col, axis, orientation, layer)));
}

const ALL = [1, 1, 1, 1, 1, 1];
const NONE = [0, 0, 0, 0, 0, 0];

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    gameModeObservable.set("edit");
    (App.getUser as Mock).mockReturnValue(actingUser);
    room = createRoom("zone-outline-room");
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
});

describe("a restricted zone's outline", () => {
    it("is on every face of a block in the zone, and on none past it along rows, columns or layers", () => {
        addRestrictedZone(room, ZONE);

        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER)).toEqual(ALL);
        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, HIGH_LAYER)).toEqual(ALL);
        expect(outlinesOfBlock(ZONE.rowMin, ZONE.colMin, LOW_LAYER)).toEqual(ALL);
        expect(outlinesOfBlock(ZONE.rowMax, ZONE.colMax, HIGH_LAYER)).toEqual(ALL);

        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER - 1)).toEqual(NONE);
        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, HIGH_LAYER + 1)).toEqual(NONE);
        expect(outlinesOfBlock(ZONE.rowMin - 1, INSIDE.col, LOW_LAYER)).toEqual(NONE);
        expect(outlinesOfBlock(ZONE.rowMax + 1, INSIDE.col, LOW_LAYER)).toEqual(NONE);
        expect(outlinesOfBlock(INSIDE.row, ZONE.colMin - 1, LOW_LAYER)).toEqual(NONE);
        expect(outlinesOfBlock(INSIDE.row, ZONE.colMax + 1, LOW_LAYER)).toEqual(NONE);
        expect(outlinesOfBlock(OUTSIDE.row, OUTSIDE.col, LOW_LAYER)).toEqual(NONE);
    });

    it("takes in the room's own floor and ceiling only where the zone reaches them", () => {
        const floor = floorQuadIndexOf(INSIDE.row, INSIDE.col);
        const ceiling = ceilingQuadIndexOf(INSIDE.row, INSIDE.col);
        const outlines = () => [floor, ceiling].map(quadIndex => RestrictedZoneOutlineUtil.getOutlineStrength(quadIndex));

        const zone = addRestrictedZone(room, ZONE);
        expect(outlines()).toEqual([0, 0]);

        const reach = (blocks: ZoneBlocks) => ObjectUpdateUtil.setObjectTransform(actingUser, room,
            new SetObjectTransformSignal(room.id, zone.objectId, zoneTransform(blocks), true), false);
        reach({...ZONE, collisionLayerMin: COLLISION_LAYER_MIN});
        expect(outlines()).toEqual([1, 0]);
        reach({...ZONE, collisionLayerMax: COLLISION_LAYER_MAX});
        expect(outlines()).toEqual([0, 1]);
        reach({...ZONE, collisionLayerMin: undefined, collisionLayerMax: undefined});
        expect(outlines()).toEqual([1, 1]);
        // Never the floor or ceiling beside its ground.
        expect(RestrictedZoneOutlineUtil.getOutlineStrength(floorQuadIndexOf(OUTSIDE.row, OUTSIDE.col))).toBe(0);
    });

    it("shows in edit mode alone", () => {
        addRestrictedZone(room, ZONE);
        gameModeObservable.set("play");
        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER)).toEqual(NONE);
        gameModeObservable.set("edit");
        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER)).toEqual(ALL);
    });

    it("shows to everybody, whomever the zone is kept for, and never for a volume kept for nobody", () => {
        const zone = addRestrictedZone(room, ZONE, actingUser.userName);
        // Its own user, who is the room's superuser besides: neither is held by it, and both see it.
        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER)).toEqual(ALL);
        (App.getUser as Mock).mockReturnValue(createEditingUser());
        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER)).toEqual(ALL);

        ObjectUpdateUtil.setObjectMetadata(actingUser, room, new SetObjectMetadataSignal(room.id, zone.objectId,
            ObjectMetadataKeyEnumMap.ZoneUserName, ""), false);
        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER)).toEqual(NONE);
    });

    it("follows the room's volumes as they are laid, kept for a user, resized and removed", () => {
        const user = actingUser;
        const volume = new AddObjectSignal(room.id, user.id, user.userName, ObjectTypeConfigMap.getIndexByType("Volume"),
            "a-volume", zoneTransform(ZONE));
        const inside = () => outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER);

        expect(inside()).toEqual(NONE);
        expect(ObjectUpdateUtil.addObject(user, room, volume)).toBe(true);
        expect(inside()).toEqual(NONE);
        expect(ObjectUpdateUtil.setObjectMetadata(user, room, new SetObjectMetadataSignal(room.id, volume.objectId,
            ObjectMetadataKeyEnumMap.ZoneUserName, "somebody"))).toBe(true);
        expect(inside()).toEqual(ALL);

        ObjectUpdateUtil.setObjectTransform(user, room, new SetObjectTransformSignal(room.id, volume.objectId,
            zoneTransform({...ZONE, rowMin: INSIDE.row + 1}), true));
        expect(inside()).toEqual(NONE);
        expect(outlinesOfBlock(INSIDE.row + 1, INSIDE.col, LOW_LAYER)).toEqual(ALL);

        expect(ObjectUpdateUtil.removeObject(user, room, new RemoveObjectSignal(room.id, volume.objectId))).toBe(true);
        expect(outlinesOfBlock(INSIDE.row + 1, INSIDE.col, LOW_LAYER)).toEqual(NONE);
    });

    it("is another room's zones' once the room is another", () => {
        addRestrictedZone(room, ZONE);
        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER)).toEqual(ALL);

        const other = createRoom("another-zone-outline-room");
        (App.getCurrentRoom as Mock).mockReturnValue(other);
        expect(outlinesOfBlock(INSIDE.row, INSIDE.col, LOW_LAYER)).toEqual(NONE);
    });

    it("is put onto the quads the room draws again whenever a volume changes", () => {
        // One quad drawn, by the first instance of the voxel mesh: a face of a block in the zone to be.
        const drawn = quadIndexOf(INSIDE.row, INSIDE.col, "x", "+", LOW_LAYER);
        vi.spyOn(VoxelQuadInstanceUtil, "getQuadIndex").mockImplementation(instanceId => (instanceId == 0) ? drawn : -1);
        const setOutline = vi.spyOn(InstancedMeshGraphics, "setInstanceOutline").mockImplementation(() => {});
        const lastOutline = () => setOutline.mock.calls[setOutline.mock.calls.length - 1];

        const zone = addRestrictedZone(room, ZONE);
        expect(lastOutline()).toEqual([ClientVoxelQueryUtil.getVoxelInstancedMeshId(), 0, 1]);

        setOutline.mockClear();
        ObjectUpdateUtil.removeObject(actingUser, room, new RemoveObjectSignal(room.id, zone.objectId), false);
        expect(setOutline.mock.calls).toEqual([[ClientVoxelQueryUtil.getVoxelInstancedMeshId(), 0, 0]]);
        expect(VoxelQueryUtil.isValidVoxelQuadIndex(drawn)).toBe(true);
    });
});
