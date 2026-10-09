/**
 * Stored files (see DBFileStorageUtil): saved gzipped, read back as they were handed over, and a file
 * saved before files were gzipped still read as it is.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import zlib from "zlib";

// What the bucket holds, by path.
const _files = vi.hoisted(() => new Map<string, Buffer>());

vi.mock("../../../src/server/networking/util/firebaseUtil", () => ({
    default: {
        getStorage: async () => ({
            bucket: () => ({
                file: (path: string) => ({
                    save: async (buffer: Buffer) => { _files.set(path, Buffer.from(buffer)); },
                    download: async () => {
                        const stored = _files.get(path);
                        if (stored == undefined)
                            throw new Error(`No such object: ${path}`);
                        return [stored];
                    },
                    delete: async () => { _files.delete(path); return [{statusCode: 204}]; },
                }),
            }),
        }),
    },
}));

vi.mock("../../../src/server/system/util/latencySimUtil", () => ({
    default: {
        networkLatencyEnabled: false,
        dbLatencyEnabled: false,
        simulateNetworkLatency: async () => {},
        simulateDBLatency: async () => {},
        getConfigSummary: () => "",
    },
}));

vi.mock("../../../src/shared/system/util/logUtil", () => ({
    default: { log: vi.fn(), logRaw: vi.fn() },
}));

import DBFileStorageUtil from "../../../src/server/db/util/dbFileStorageUtil";
import RoomGenerationUtil from "../../../src/shared/room/generation/util/roomGenerationUtil";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import BufferState from "../../../src/shared/networking/types/bufferState";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";

const PATH = "rooms/a-room/content.bin";

// A generated room's contents as the server writes them: its voxels, then its objects.
function encodeRoomContent(): Buffer
{
    const room = RoomGenerationUtil.generateRoom("", RoomTypeEnumMap.Regular, "owner", "Owner", 7);
    const bufferState = EncodingUtil.startEncoding();
    room.voxelGrid.encode(bufferState);
    new ObjectGroup(Object.values(room.objectById)).encode(bufferState);
    return Buffer.from(EncodingUtil.endEncoding(bufferState));
}

describe("stored files", () => {
    beforeEach(() => {
        _files.clear();
    });

    it("are saved gzipped, and read back as they were handed over", async () => {
        const content = encodeRoomContent();
        expect(await DBFileStorageUtil.saveBinaryFile(PATH, content)).toBe(true);

        const stored = _files.get(PATH)!;
        expect(stored.length).toBeLessThan(content.length / 10);
        expect(zlib.gunzipSync(stored).equals(content)).toBe(true);

        const loaded = await DBFileStorageUtil.loadBinaryFile(PATH);
        expect(loaded!.equals(content)).toBe(true);
    });

    it("are read as they are when they were saved before files were gzipped", async () => {
        const content = encodeRoomContent();
        _files.set(PATH, content);

        const loaded = await DBFileStorageUtil.loadBinaryFile(PATH);
        expect(loaded!.equals(content)).toBe(true);

        // And still a room's contents: voxels, then objects, to the last byte.
        const bufferState = new BufferState(new Uint8Array(loaded!));
        const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
        ObjectGroup.decodeWithParams(bufferState, "a-room", voxelGrid.sourceFormatVersion);
        expect(bufferState.byteIndex).toBe(loaded!.length);
    });

    // A room's contents start with their format version, which is how one saved plain is told from a
    // gzipped file: no version may ever be the byte a gzip stream starts with.
    it("can tell a room's plain contents from a gzipped file by the first byte", () => {
        const gzipFirstByte = zlib.gzipSync(Buffer.from([1, 2, 3]))[0];
        expect(gzipFirstByte).toBe(0x1f);
        expect(VoxelGrid.latestFormatVersion).toBeLessThan(gzipFirstByte);
    });

    it("come back as nothing where there is no file, or an empty one", async () => {
        expect(await DBFileStorageUtil.loadBinaryFile(PATH)).toBeNull();

        _files.set(PATH, Buffer.alloc(0));
        expect(await DBFileStorageUtil.loadBinaryFile(PATH)).toBeNull();
    });

    it("report a gzipped file that was cut short as unreadable, not as a room", async () => {
        await DBFileStorageUtil.saveBinaryFile(PATH, encodeRoomContent());
        const stored = _files.get(PATH)!;
        _files.set(PATH, stored.subarray(0, stored.length >> 1));

        expect(await DBFileStorageUtil.loadBinaryFile(PATH)).toBeNull();
    });
});
