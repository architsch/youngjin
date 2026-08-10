// Produces a room exactly the way the server produces one, for the playtest seeder.
//
// Seeding a room by copying another room's content blob gives you a room that exists, but not
// a room that is representative: every copy shares one interior, and the texture pack recorded
// on the row is whatever the seeder guessed rather than the one generation actually picked. A
// room's voxel texture indices are positions within one specific pack's atlas, so a row and a
// blob that disagree describe a room that could never have been generated.
//
// So this calls the real generator and the real encoder — the same RoomGenerationUtil the
// server calls when a user creates a room, and the same encoding DBRoomUtil writes — and hands
// back both halves of the result: the bytes for Cloud Storage, and the room-level parameters
// that generation decided and the Firestore row therefore has to carry.
//
// It is TypeScript because the generator is; stagingAdmin.js bundles it on demand (see
// generateRoomContent.js). Nothing here is server-specific, so no server module is imported.

// Generation hangs canvases and paints voxels out of the image maps, which both entrypoints
// register as a side-effect import before anything else runs. Without this the generator finds
// no image map and cannot decide what it is placing.
import "../../../src/shared/graphics/image/imageMapDependencies";

import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import { RoomType } from "../../../src/shared/room/types/roomType";

export interface GeneratedRoomContent
{
    // The room-level parameters generation decided. These belong on the Firestore row, not just
    // in the blob — a row whose texturePackPath disagrees with the blob's texture indices
    // renders as a room built out of the wrong atlas.
    texturePackPath: string;
    roomName: string;
    roomType: RoomType;

    // The content blob, byte-identical in layout to what the server writes on room creation.
    content: Buffer;

    // Reported so a seeder can show that generation actually produced something.
    voxelCount: number;
    objectCount: number;
}

export function generateRoomContent(roomName: string, roomType: RoomType,
    ownerUserID: string, ownerUserName: string): GeneratedRoomContent
{
    const room = RoomGenerationUtil.generateRoom(roomName, roomType, ownerUserID, ownerUserName);

    const bufferState = EncodingUtil.startEncoding();
    room.voxelGrid.encode(bufferState);

    // Every object, not only the persistent ones. This mirrors the server's first-time save:
    // on room creation the objects generation placed are the room's intrinsic content, so
    // discarding the non-persistent ones here would seed a room that had already been stripped.
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
