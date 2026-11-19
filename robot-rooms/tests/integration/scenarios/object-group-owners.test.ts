/**
 * How an object group stores its objects' owners (see ObjectGroup): each owner once, and each object by its
 * owner's index, so a room built by many users still reads back whole.
 */
import { describe, it, expect, vi } from "vitest";
import BufferState from "../../../src/shared/networking/types/bufferState";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { writeLegacyObjectGroup } from "../helpers/legacyObjectGroup";

const ROOM_ID = "owners-room";

// One object for each of `count` owners.
function objectsByOwners(count: number): AddObjectSignal[]
{
    const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
    return Array.from({length: count}, (_, i) => new AddObjectSignal(ROOM_ID, `user-${i}`, `name-${i}`,
        lampTypeIndex, `lamp-${i}`, new ObjectTransform({x: 2, y: 1, z: 2}, {x: 0, y: 0, z: 1}, {x: 1, y: 1, z: 1})));
}

function decode(bytes: Uint8Array): ObjectGroup
{
    return ObjectGroup.decodeWithParams(new BufferState(bytes), ROOM_ID) as ObjectGroup;
}

function ownersOf(objectGroup: ObjectGroup): string[][]
{
    return Object.values(objectGroup.objectById).map(o => [o.objectId, o.sourceUserID, o.sourceUserName]);
}

describe("object group owners", () => {
    it("round-trips a group whose objects come from more than 255 users", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const objects = objectsByOwners(300);
        const view = new Uint8Array(256 * 1024);
        const writeState = new BufferState(view);
        new ObjectGroup(objects).encodeWithParams(writeState, {});

        expect(view[0]).toBe(ObjectGroup.latestFormatVersion);
        const decoded = decode(view.subarray(0, writeState.byteIndex));
        expect(ownersOf(decoded)).toEqual(objects.map(o => [o.objectId, o.sourceUserID, o.sourceUserName]));
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    it("still reads groups stored with the owner count in one byte", () => {
        const objects = objectsByOwners(3);
        const view = new Uint8Array(64 * 1024);
        const writeState = new BufferState(view);
        writeLegacyObjectGroup(writeState, objects, 7);

        const decoded = decode(view.subarray(0, writeState.byteIndex));
        expect(decoded.sourceFormatVersion).toBe(7);
        expect(ownersOf(decoded)).toEqual(objects.map(o => [o.objectId, o.sourceUserID, o.sourceUserName]));
    });
});
