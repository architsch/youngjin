/**
 * Event: User sending an object-message.
 *
 * Covers criteria items:
 * - User sending an object-message (via objectMessageParams)
 * - Message metadata set on sender's player object
 * - Message metadata visible to other users in the same room
 * - Message metadata persists in saved state after disconnect
 * - Message metadata reflected in getUserGameplayState
 * - Message not visible to users in different rooms
 */
import { describe, it, expect, beforeEach } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomManager from "../../../src/server/room/roomManager";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";

const ROOM_ID = "msg-room";

describe("object message events", () => {
    beforeEach(() => {
        harness.reset();
        harness.seedRoom(ROOM_ID, "Message Room", RoomTypeEnumMap.Regular);
    });

    it("sendObjectMessage sets SentMessage metadata on player object", async () => {
        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, ROOM_ID);

        harness.sendObjectMessage(ctx, "hello world");

        const obj = harness.getPlayerObjectInRoom(ctx);
        expect(obj).toBeDefined();
        expect(obj!.hasMetadata(ObjectMetadataKeyEnumMap.SentMessage)).toBe(true);
        expect(obj!.getMetadata(ObjectMetadataKeyEnumMap.SentMessage)).toBe("hello world");
    });

    it("metadata persists in saved state after disconnect", async () => {
        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, ROOM_ID);

        harness.sendObjectMessage(ctx, "goodbye");

        await harness.disconnectUser(ctx, true);
        const saved = harness.savedGameplayStates[0];
        expect(saved.playerMetadata[String(ObjectMetadataKeyEnumMap.SentMessage)]).toBe("goodbye");
    });

    it("metadata set via sendObjectMessage reflected in getUserGameplayState", async () => {
        const ctx = harness.connectUser({
            playerMetadata: { "0": "initial-msg", "1": "some-room" },
        });
        await harness.joinRoom(ctx, ROOM_ID);

        harness.sendObjectMessage(ctx, "updated-msg");

        const obj = harness.getPlayerObjectInRoom(ctx)!;
        const gameplayState = harness.getGameplayState(ctx)!;

        // Metadata key 0 (SentMessage) should be updated
        expect(gameplayState.playerMetadata["0"]).toBe(obj.metadata[0].str);
        expect(gameplayState.playerMetadata["0"]).toBe("updated-msg");
        // Metadata key 1 should be unchanged
        expect(gameplayState.playerMetadata["1"]).toBe(obj.metadata[1].str);
        expect(gameplayState.playerMetadata["1"]).toBe("some-room");
    });

    it("message metadata visible to other users in the same room", async () => {
        const sender = harness.connectUser({ id: "sender" });
        const observer = harness.connectUser({ id: "observer" });
        await harness.joinRoom(sender, ROOM_ID);
        await harness.joinRoom(observer, ROOM_ID);

        harness.sendObjectMessage(sender, "hi everyone");

        // Observer can see the sender's metadata in the room's object runtime memory
        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const senderObj = roomMem.playerObjectMemoryByUserID["sender"];
        expect(senderObj).toBeDefined();
        expect(senderObj.objectSpawnParams.hasMetadata(ObjectMetadataKeyEnumMap.SentMessage)).toBe(true);
        expect(senderObj.objectSpawnParams.getMetadata(ObjectMetadataKeyEnumMap.SentMessage)).toBe("hi everyone");
    });

    it("message metadata not visible to users in different rooms", async () => {
        harness.seedRoom("other-room", "Other Room", RoomTypeEnumMap.Regular);

        const sender = harness.connectUser({ id: "room-a-user" });
        const otherUser = harness.connectUser({ id: "room-b-user" });
        await harness.joinRoom(sender, ROOM_ID);
        await harness.joinRoom(otherUser, "other-room");

        harness.sendObjectMessage(sender, "room A only");

        // The other room should not contain the sender's object
        const otherRoomMem = RoomManager.roomRuntimeMemories["other-room"];
        expect(otherRoomMem.playerObjectMemoryByUserID["room-a-user"]).toBeUndefined();

        // Sender's room should have the metadata
        const senderRoomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const senderObj = senderRoomMem.playerObjectMemoryByUserID["room-a-user"];
        expect(senderObj.objectSpawnParams.getMetadata(ObjectMetadataKeyEnumMap.SentMessage)).toBe("room A only");
    });

    it("sending multiple messages updates metadata to the latest one", async () => {
        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, ROOM_ID);

        harness.sendObjectMessage(ctx, "first");
        harness.sendObjectMessage(ctx, "second");
        harness.sendObjectMessage(ctx, "third");

        const obj = harness.getPlayerObjectInRoom(ctx);
        expect(obj!.getMetadata(ObjectMetadataKeyEnumMap.SentMessage)).toBe("third");
    });
});
