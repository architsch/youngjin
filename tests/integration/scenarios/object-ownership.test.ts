/**
 * Who adds and removes an object, and whose it is (see @docs/networking/object_update.md): a player character
 * is the server's to add and remove, never a client's, and a client adds objects in its own name only, carrying
 * only values it could set on them, which are stored tidied as a set stores them.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, userAtCenter } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import { zoneTransform } from "../helpers/restrictedZone";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { ObjectMetadata } from "../../../src/shared/object/types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import LampObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import { INITIAL_MULTI_PLAYER_ENTRANCE_POS, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const PLAYER_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Player");

function getHub()
{
    return ServerRoomManager.roomRuntimeMemories["hub"].room;
}

// A lamp on the boundary wall beside the hub's door, carrying the values given.
function lampOnWall(roomID: string, userID: string, userName: string, objectId: string, colOffset: number,
    values: {[key: number]: string}): AddObjectSignal
{
    const metadata: ObjectMetadata = {};
    for (const [key, value] of Object.entries(values))
        metadata[Number(key)] = new EncodableByteString(value);
    return new AddObjectSignal(roomID, userID, userName, ObjectTypeConfigMap.getIndexByType("Lamp"), objectId,
        new ObjectTransform({x: INITIAL_MULTI_PLAYER_ENTRANCE_POS.x + colOffset, y: 2.25,
            z: INITIAL_MULTI_PLAYER_ENTRANCE_POS.z}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3}), metadata);
}

describe("object ownership", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("a client may not add a player character, its own or anyone else's", async () => {
        await runScenario({
            name: "client-sent player add refused",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub"), userAtCenter("hub")],
            assertions: ({ users }) => {
                const room = getHub();
                const [sender, other] = users;
                const transform = ServerUserManager.getPlayerObject(sender.user.id)!.transform;
                const forgeries = [
                    new AddObjectSignal(room.id, sender.user.id, sender.user.userName, PLAYER_TYPE_INDEX, "forged-own", transform),
                    new AddObjectSignal(room.id, other.user.id, other.user.userName, PLAYER_TYPE_INDEX, "forged-other", transform),
                ];
                for (const forgery of forgeries)
                {
                    expect(ServerObjectManager.onAddObjectSignalReceived(sender.socketUserContext, forgery)).toBe(false);
                    expect(room.objectById[forgery.objectId]).toBeUndefined();
                    // The sender is told to drop it, and nobody else hears of it.
                    expect(getPendingSignals(sender, "removeObjectSignal").map(s => s.objectId)).toContain(forgery.objectId);
                    expect(getPendingSignals(other, "addObjectSignal").map(s => s.objectId)).not.toContain(forgery.objectId);
                }
            },
        });
    });

    it("a client may not remove a player character, another's or its own", async () => {
        await runScenario({
            name: "client-sent player remove refused",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub"), userAtCenter("hub")],
            assertions: ({ users }) => {
                const room = getHub();
                const [sender, other] = users;
                for (const owner of [other, sender])
                {
                    const player = ServerUserManager.getPlayerObject(owner.user.id)!;
                    expect(ServerObjectManager.onRemoveObjectSignalReceived(sender.socketUserContext,
                        new RemoveObjectSignal(room.id, player.objectId))).toBe(false);
                    expect(room.objectById[player.objectId]?.sourceUserID).toBe(owner.user.id);
                }
                expect(getPendingSignals(other, "removeObjectSignal").length).toBe(0);
            },
        });
    });

    it("a client may not add an object in another user's name", async () => {
        await runScenario({
            name: "client-sent add naming another owner refused",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub"), userAtCenter("hub")],
            assertions: ({ users }) => {
                const room = getHub();
                const [sender, other] = users;
                sender.user.userType = UserTypeEnumMap.Admin; // volumes are an admin's to lay in a hub
                const makeVolume = (owner: typeof sender, objectId: string) => new AddObjectSignal(room.id,
                    owner.user.id, owner.user.userName, ObjectTypeConfigMap.getIndexByType("Volume"), objectId,
                    zoneTransform({rowMin: 10, rowMax: 12, colMin: 10, colMax: 12}));

                expect(ServerObjectManager.onAddObjectSignalReceived(sender.socketUserContext,
                    makeVolume(other, "named-for-another"))).toBe(false);
                expect(room.objectById["named-for-another"]).toBeUndefined();
                expect(getPendingSignals(sender, "removeObjectSignal").map(s => s.objectId)).toContain("named-for-another");

                // The same object in its sender's own name is taken.
                expect(ServerObjectManager.onAddObjectSignalReceived(sender.socketUserContext,
                    makeVolume(sender, "named-for-sender"))).toBe(true);
                expect(room.objectById["named-for-sender"]?.sourceUserID).toBe(sender.user.id);
            },
        });
    });

    it("a client's add may carry no value the client couldn't give the object once it is there", async () => {
        await runScenario({
            name: "an add's metadata held to the rules of setting it",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub"), userAtCenter("hub")],
            assertions: ({ users }) => {
                const room = getHub();
                const [sender, other] = users;
                const add = (objectId: string, colOffset: number, metadata: {[key: number]: string}) =>
                    ServerObjectManager.onAddObjectSignalReceived(sender.socketUserContext,
                        lampOnWall(room.id, sender.user.id, sender.user.userName, objectId, colOffset, metadata));

                const refused: [string, {[key: number]: string}][] = [
                    ["lamp-with-text", {[ObjectMetadataKeyEnumMap.Label]: "no lamp shows text"}],
                    ["lamp-tagged", {[ObjectMetadataKeyEnumMap.Tags]: "marked"}],
                    ["lamp-marked", {[ObjectMetadataKeyEnumMap.AgentMark]: "1"}],
                ];
                for (const [objectId, metadata] of refused)
                {
                    expect(add(objectId, -4, metadata), objectId).toBe(false);
                    expect(room.objectById[objectId]).toBeUndefined();
                    expect(getPendingSignals(sender, "removeObjectSignal").map(s => s.objectId)).toContain(objectId);
                    expect(getPendingSignals(other, "addObjectSignal").map(s => s.objectId)).not.toContain(objectId);
                }

                // A lamp's own value is anyone's to give it; an admin's key is an admin's; the agent mark is nobody's.
                expect(add("lamp-lit", -4, {[ObjectMetadataKeyEnumMap.LightProperties]:
                    LampObjectTypeConfig.util.getDefaultLightProperties()})).toBe(true);
                sender.user.userType = UserTypeEnumMap.Admin;
                expect(add("lamp-tagged-by-admin", -7, {[ObjectMetadataKeyEnumMap.Tags]: "marked"})).toBe(true);
                expect(add("lamp-marked-by-admin", -10, {[ObjectMetadataKeyEnumMap.AgentMark]: "1"})).toBe(false);
            },
        });
    });

    it("stores an add, and passes it on, with each value as setting it would store it", async () => {
        await runScenario({
            name: "an add's metadata stored tidied",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub"), userAtCenter("hub")],
            assertions: ({ users }) => {
                const room = getHub();
                const [sender, other] = users;
                const scrawl = "~~~~~~~~~~";
                const lightKey = ObjectMetadataKeyEnumMap.LightProperties;

                expect(ServerObjectManager.onAddObjectSignalReceived(sender.socketUserContext,
                    lampOnWall(room.id, sender.user.id, sender.user.userName, "scrawled-lamp", -4, {[lightKey]: scrawl})))
                    .toBe(true);

                const tidied = LampObjectTypeConfig.util.canonicalize(scrawl);
                expect(tidied).not.toBe(scrawl);
                expect(room.objectById["scrawled-lamp"].metadata[lightKey].str).toBe(tidied);
                expect(getPendingSignals(other, "addObjectSignal").find(s => s.objectId == "scrawled-lamp")
                    .metadata[lightKey].str).toBe(tidied);
            },
        });
    });

    it("the server spawns a joining user's player and removes it when they leave", async () => {
        await runScenario({
            name: "server spawns and removes players",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub"), userAtCenter("hub")],
            assertions: async ({ users, harness }) => {
                const room = getHub();
                const [stayer, leaver] = users;
                const player = ServerUserManager.getPlayerObject(leaver.user.id)!;
                expect(room.objectById[player.objectId]?.objectTypeIndex).toBe(PLAYER_TYPE_INDEX);
                expect(room.objectById[player.objectId]?.sourceUserID).toBe(leaver.user.id);
                expect(getPendingSignals(stayer, "addObjectSignal").map(s => s.objectId)).toContain(player.objectId);

                await harness.disconnectUser(leaver);
                expect(room.objectById[player.objectId]).toBeUndefined();
                expect(getPendingSignals(stayer, "removeObjectSignal").map(s => s.objectId)).toContain(player.objectId);
            },
        });
    });
});
