/**
 * Integration tests: what a browser does with what the server says of the room it is in (see ClientObjectManager): a
 * helper's moves, which are only shown, carry its body and collider and leave the room's copy of it at home, as a room
 * file saves it, while the browser's guess at which helper will answer goes by where they took it; and what is said of a
 * room while it is still loading reaches it once it has loaded, in the order said.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const scene = new THREE.Scene();
    return { default: { getScene: () => scene } };
});

vi.mock("../../../src/client/app", () => ({
    default: {
        getCurrentRoom: vi.fn(),
        getUser: vi.fn(),
        whenInRoom: vi.fn(),
    },
}));

vi.mock("../../../src/client/networking/client/socketsClient", () => ({ default: {} }));

import * as THREE from "three";
import App from "../../../src/client/app";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import NpcGameObject from "../../../src/client/object/types/gameObject/npcGameObject";
import HelperThinkingUtil from "../../../src/client/object/util/helperThinkingUtil";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import NpcFacingUtil from "../../../src/shared/object/util/npcFacingUtil";
import PhysicsObjectUtil from "../../../src/shared/physics/util/physicsObjectUtil";
import Room from "../../../src/shared/room/types/room";
import RoomFile from "../../../src/shared/room/types/roomFile";
import Vec3 from "../../../src/shared/math/types/vec3";
import { createEditingUser } from "../helpers/mockUser";
import { createRoom } from "../helpers/selectionHarness";

const ROOM_ID = "a-hub";
const NPC_ID = "a-helper";
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const UP: Vec3 = {x: 0, y: 1, z: 0};
const HOME: Vec3 = {x: 10, y: 0, z: 10};
const AWAY: Vec3 = {x: 13, y: 0, z: 14};

const user = createEditingUser();
let room: Room;
// Where the helper's body has been put, in turn.
let bodyAt: Vec3[];

function transformTo(pos: Vec3): ObjectTransform
{
    return new ObjectTransform({...pos}, {...UP}, {x: 1, y: 1, z: 1});
}

// Whether the helper's collider is near a floor point, as whatever looks for what is near asks (see
// PlayerProximityDetectionUpdater).
function colliderIsNear(point: Vec3): boolean
{
    return PhysicsObjectUtil.getObjectsIn2DDist(ROOM_ID, point.x, point.z, 0.5)[NPC_ID] != undefined;
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getUser as Mock).mockReturnValue(user);
    (App.whenInRoom as Mock).mockImplementation(async (roomID: string) => App.getCurrentRoom()?.id == roomID);

    // A helper, as the room keeps it, and the body its game object draws.
    expect(ObjectUpdateUtil.addObject(user, room, new AddObjectSignal(ROOM_ID, user.id, user.userName, NPC_TYPE_INDEX,
        NPC_ID, transformTo(HOME), {}), false)).toBe(true);
    bodyAt = [];
    const body = {
        params: room.objectById[NPC_ID],
        components: {},
        setObjectTransform: (pos: Vec3) => { bodyAt.push({...pos}); },
        onSetMetadata: () => {},
    } as unknown as GameObject;
    vi.spyOn(ClientObjectManager, "getObjectById").mockImplementation(
        (objectId: string) => (objectId == NPC_ID) ? body : undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("a helper's moves in a browser", () => {
    it("carry its body and collider when only shown, and leave the room's copy of it at home, as a room file saves it",
        async () => {
        await ClientObjectManager.onSetObjectTransformSignalReceived(
            new SetObjectTransformSignal(ROOM_ID, NPC_ID, transformTo(AWAY), true, true));
        expect(bodyAt).toEqual([AWAY]);
        expect(colliderIsNear(AWAY)).toBe(true);
        expect(colliderIsNear(HOME)).toBe(false);
        expect(room.objectById[NPC_ID].transform.pos).toEqual(HOME);
        expect(RoomFile.fromRoom(room).objectGroup.objectById[NPC_ID].transform.pos).toEqual(HOME);

        // An admin's move of it, which the room keeps, moves its home.
        await ClientObjectManager.onSetObjectTransformSignalReceived(
            new SetObjectTransformSignal(ROOM_ID, NPC_ID, transformTo(AWAY), true));
        expect(room.objectById[NPC_ID].transform.pos).toEqual(AWAY);
    });

    it("leave it where the browser guesses which helper will answer a line from, as the server picks it", () => {
        // The user stands facing north, one helper at home ahead of them but shown off to their right, the other the
        // other way round.
        const me = {x: 10, y: 0, z: 20};
        const ahead = {x: 10, y: 0, z: 15};
        const right = {x: 16, y: 0, z: 20};
        const thinking: string[] = [];
        const bodies: {[objectId: string]: GameObject} = {};
        for (const [objectId, home, shownAt] of [["ahead-at-home", ahead, right], ["right-at-home", right, ahead]] as
            [string, Vec3, Vec3][])
        {
            expect(ObjectUpdateUtil.addObject(user, room, new AddObjectSignal(ROOM_ID, user.id, user.userName,
                NPC_TYPE_INDEX, objectId, transformTo(home), {}), false)).toBe(true);
            bodies[objectId] = Object.assign(Object.create(NpcGameObject.prototype), {
                params: room.objectById[objectId],
                obj: {position: {...shownAt}},
                components: {speechBubble: {expectThinking: () => thinking.push(objectId)}},
            });
        }
        vi.spyOn(ClientObjectManager, "getObjectById").mockImplementation((objectId: string) => bodies[objectId]);
        // A player's transform points behind it (see PlayerController).
        vi.spyOn(ClientObjectManager, "getMyPlayer").mockReturnValue({
            params: new AddObjectSignal(ROOM_ID, user.id, user.userName, ObjectTypeConfigMap.getIndexByType("Player"),
                "me", transformTo(me), {}),
            position: new THREE.Vector3(me.x, me.y + 0.5 * PLAYER_HEIGHT, me.z),
            direction: new THREE.Vector3(0, 0, 1),
        } as unknown as GameObject);

        HelperThinkingUtil.expectAnswerTo("hello?");
        expect(thinking).toEqual(["right-at-home"]);
    });
});

describe("what is said of a room in a browser", () => {
    it("reaches the room once it has loaded, in the order said, and nothing said of another room reaches it",
        async () => {
        let loaded = () => {};
        const loading = new Promise<void>(resolve => { loaded = resolve; });
        (App.whenInRoom as Mock).mockImplementation(
            (roomID: string) => loading.then(() => App.getCurrentRoom()?.id == roomID));
        const facing = (roomID: string, degrees: number) => ClientObjectManager.onSetObjectMetadataSignalReceived(
            new SetObjectMetadataSignal(roomID, NPC_ID, ObjectMetadataKeyEnumMap.Facing, NpcFacingUtil.encode(degrees)));

        const received = [facing(ROOM_ID, 90), facing(ROOM_ID, 180), facing(ROOM_ID, 270), facing("another-room", 45)];
        await new Promise(resolve => setImmediate(resolve));
        expect(room.objectById[NPC_ID].metadata[ObjectMetadataKeyEnumMap.Facing]).toBeUndefined();

        loaded();
        await Promise.all(received);
        expect(room.objectById[NPC_ID].metadata[ObjectMetadataKeyEnumMap.Facing].str).toBe("270");
    });
});
