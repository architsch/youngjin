// Generates a room exactly as the server does (RoomGenerationUtil, encoded as DBRoomUtil writes) for the
// playtest seeder, returning the storage bytes and the room-level parameters the Firestore row must carry
// (texture indices only mean something within the generated texture pack). TypeScript because the
// generator is; stagingAdmin.js bundles it on demand (see generateRoomContent.js).

// Registers the image maps generation places canvases and paints voxels from (as both entrypoints do).
import "../../../src/shared/graphics/image/imageMapDependencies";

import RoomGenerationUtil from "../../../src/shared/room/generation/util/roomGenerationUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import { RoomType } from "../../../src/shared/room/types/roomType";

export interface GeneratedRoomContent
{
    // Must go on the Firestore row: a mismatched texturePackPath renders with the wrong atlas.
    texturePackPath: string;
    roomName: string;
    roomType: RoomType;

    // The content blob, byte-identical in layout to what the server writes on room creation.
    content: Buffer;

    // Reported so a seeder can show that generation actually produced something.
    voxelCount: number;
    objectCount: number;
}

// A `seed` reproduces the same interior (stable script coordinates); omitted, a fresh room is drawn.
export function generateRoomContent(roomName: string, roomType: RoomType,
    ownerUserID: string, ownerUserName: string, seed?: number): GeneratedRoomContent
{
    const room = RoomGenerationUtil.generateRoom(roomName, roomType, ownerUserID, ownerUserName, seed);

    const bufferState = EncodingUtil.startEncoding();
    room.voxelGrid.encode(bufferState);

    // All objects, not only persistent ones, mirroring the server's first save of a new room.
    new ObjectGroup(Object.values(room.objectById)).encode(bufferState);

    const content = Buffer.from(EncodingUtil.endEncoding(bufferState));

    return {
        texturePackPath: room.texturePackPath,
        roomName: room.roomName,
        roomType: room.roomType,
        content,
        voxelCount: room.voxelGrid.voxels.length,
        objectCount: Object.keys(room.objectById).length,
    };
}
