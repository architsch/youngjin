/**
 * Scenario tests: object tags (see ObjectTagUtil) — how a tags string is tidied, who may give tags and to what,
 * and how a room's scripts find an object by one.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ObjectMetadataEntryMap from "../../../src/shared/object/maps/objectMetadataEntryMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { ENTRANCE_DOOR_OBJECT_ID } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import ObjectTagUtil from "../../../src/shared/object/util/objectTagUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import Room from "../../../src/shared/room/types/room";
import { INITIAL_MULTI_PLAYER_ENTRANCE_POS, OBJECT_TAGS_MAX_LENGTH,
    UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");

const ADMIN = new User("an-admin", "Admin", UserTypeEnumMap.Admin, "admin@test.com", "");
const MEMBER = new User("a-member", "Member", UserTypeEnumMap.Member, "member@test.com", "");
const GUEST = new User("a-guest", "Guest", UserTypeEnumMap.Guest, "guest@test.com", "");
// The owner of the regular fixture room.
const OWNER = new User("an-owner", "Owner", UserTypeEnumMap.Member, "owner@test.com", "", "", "regular");

const preprocess = (rawTags: string) => ObjectMetadataEntryMap.preprocess(ObjectMetadataKeyEnumMap.Tags, rawTags);

// A lamp on the boundary wall, clear of the room's door.
function addLamp(room: Room, objectId: string, colOffset: number): AddObjectSignal
{
    const lamp = new AddObjectSignal(room.id, MEMBER.id, MEMBER.userName, lampTypeIndex, objectId,
        new ObjectTransform({x: INITIAL_MULTI_PLAYER_ENTRANCE_POS.x + colOffset, y: 2.25,
            z: INITIAL_MULTI_PLAYER_ENTRANCE_POS.z}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3}));
    expect(ObjectUpdateUtil.addObject(MEMBER, room, lamp)).toBe(true);
    return lamp;
}

function canTag(user: User, room: Room, objectId: string): boolean
{
    return ObjectUpdateUtil.canSetObjectMetadata(user, room,
        new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.Tags, "marked"));
}

describe("a tags string", () => {
    it("is stored as its tags alone: trimmed of everything a tag isn't made of, without empty ones or repeats", () => {
        expect(preprocess("npc")).toBe("npc");
        expect(preprocess(" npc ,  exit ")).toBe("npc,exit");
        expect(preprocess("npc,,exit,")).toBe("npc,exit");
        expect(preprocess("npc,exit,npc")).toBe("npc,exit");
        expect(preprocess("wall 1, way-out, north_door")).toBe("wall1,way-out,north_door");
        expect(preprocess("näme!, 😀, <b>")).toBe("nme,b");
        expect(preprocess("")).toBe("");
        expect(preprocess(" , ,")).toBe("");
    });

    it("keeps as many whole tags as fit its length, never part of one", () => {
        const tag = "t".repeat(19); // 20 characters with its number, so three and their commas fit, and no fourth
        const stored = preprocess([`${tag}1`, `${tag}2`, `${tag}3`, `${tag}4`].join(","));
        expect(stored).toBe(`${tag}1,${tag}2,${tag}3`);
        expect(stored.length).toBeLessThanOrEqual(OBJECT_TAGS_MAX_LENGTH);
        // One too long by itself is none.
        expect(preprocess("t".repeat(OBJECT_TAGS_MAX_LENGTH + 1))).toBe("");
        expect(preprocess("t".repeat(OBJECT_TAGS_MAX_LENGTH))).toBe("t".repeat(OBJECT_TAGS_MAX_LENGTH));
    });

    it("comes out within its length whatever goes in, and tidying it again changes nothing", () => {
        fc.assert(fc.property(fc.string({maxLength: 3 * OBJECT_TAGS_MAX_LENGTH}), (rawTags) => {
            const stored = preprocess(rawTags);
            expect(stored.length).toBeLessThanOrEqual(OBJECT_TAGS_MAX_LENGTH);
            expect(stored).toMatch(/^[A-Za-z0-9_,-]*$/);
            expect(preprocess(stored)).toBe(stored);
            // Read back as the tags it lists.
            const tags = ObjectTagUtil.getTags({metadata: {[ObjectMetadataKeyEnumMap.Tags]: {str: stored}} as any});
            expect(tags.join(",")).toBe(stored);
            expect(new Set(tags).size).toBe(tags.length);
        }));
    });
});

describe("tagging an object", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("is an admin's to do, to an object of any type, and nobody else's", async () => {
        await runScenario({
            name: "tags in a hub",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addLamp(room, "a-lamp", -5);

                // A lamp's own rule lets its light be set and nothing else; a door's is its superuser's.
                for (const objectId of ["a-lamp", ENTRANCE_DOOR_OBJECT_ID])
                {
                    expect(canTag(ADMIN, room, objectId), objectId).toBe(true);
                    expect(canTag(MEMBER, room, objectId), objectId).toBe(false);
                    expect(canTag(GUEST, room, objectId), objectId).toBe(false);
                }
            },
        });
    });

    it("is not an owner's to do in their own room", async () => {
        await runScenario({
            name: "tags in a regular room",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter("regular")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["regular"].room;
                addLamp(room, "a-lamp", -5);

                expect(canTag(OWNER, room, "a-lamp")).toBe(false);
                expect(canTag(OWNER, room, ENTRANCE_DOOR_OBJECT_ID)).toBe(false);
                expect(canTag(ADMIN, room, "a-lamp")).toBe(true);
            },
        });
    });

    it("leaves every other key under its type's own rule", async () => {
        await runScenario({
            name: "tags don't open other keys",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addLamp(room, "a-lamp", -5);
                const canSet = (key: number) => ObjectUpdateUtil.canSetObjectMetadata(ADMIN, room,
                    new SetObjectMetadataSignal(room.id, "a-lamp", key, "x"));

                expect(canSet(ObjectMetadataKeyEnumMap.LightProperties)).toBe(true);
                expect(canSet(ObjectMetadataKeyEnumMap.Label)).toBe(false);
                expect(canSet(ObjectMetadataKeyEnumMap.DestinationRoomId)).toBe(false);
            },
        });
    });

    it("stores the tags tidied, and finds the first object carrying one", async () => {
        await runScenario({
            name: "finding by tag",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const first = addLamp(room, "first-lamp", -5);
                const second = addLamp(room, "second-lamp", 5);
                const tag = (objectId: string, tags: string) => ObjectUpdateUtil.setObjectMetadata(ADMIN, room,
                    new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.Tags, tags));

                expect(ObjectTagUtil.findObject(room, "start")).toBeUndefined();
                expect(tag("first-lamp", " start , light")).toBe(true);
                expect(tag("second-lamp", "light")).toBe(true);

                expect(first.metadata[ObjectMetadataKeyEnumMap.Tags].str).toBe("start,light");
                expect(ObjectTagUtil.getTags(first)).toEqual(["start", "light"]);
                expect(ObjectTagUtil.hasTag(second, "light")).toBe(true);
                expect(ObjectTagUtil.hasTag(second, "start")).toBe(false);
                // A tag is matched whole, never as part of another.
                expect(ObjectTagUtil.hasTag(first, "star")).toBe(false);

                expect(ObjectTagUtil.findObject(room, "start")).toBe(first);
                expect(ObjectTagUtil.findObject(room, "light")).toBe(first);
                expect(ObjectTagUtil.findObject(room, "nothing")).toBeUndefined();

                // Tags taken away again leave the object found by none.
                expect(tag("first-lamp", "")).toBe(true);
                expect(ObjectTagUtil.findObject(room, "start")).toBeUndefined();
                expect(ObjectTagUtil.findObject(room, "light")).toBe(second);
            },
        });
    });
});
