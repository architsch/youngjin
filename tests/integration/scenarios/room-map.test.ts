/**
 * The single-player room map (see @docs/networking/single_player_mode.md): it lists the room files the game comes
 * with, every single-player mode names one of them, and each is a file this build reads.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import "../../../src/shared/room/roomMapDependencies";
import ServerRoomFileUtil from "../../../src/server/room/util/serverRoomFileUtil";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import RoomFile from "../../../src/shared/room/types/roomFile";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import RoomMapUtil from "../../../src/shared/room/util/roomMapUtil";
import SinglePlayerModeConfigMap from "../../../src/shared/singlePlayer/maps/singlePlayerModeConfigMap";
import { ROOM_EDITOR_SINGLE_PLAYER_MODE } from "../../../src/shared/system/sharedConstants";

const ROOMS_ROOT_PATH = path.join(process.cwd(), "public/app/assets/rooms");

const roomMap = () => RoomMapUtil.getRoomMap("SinglePlayerRoomMap");

function readFileBytes(roomPath: string): Buffer
{
    return fs.readFileSync(path.join(ROOMS_ROOT_PATH, `${roomPath}${RoomFile.FILE_EXTENSION}`));
}

function encode(roomFile: RoomFile): string
{
    const bufferState = EncodingUtil.startEncoding();
    roomFile.encode(bufferState);
    return Buffer.from(EncodingUtil.endEncoding(bufferState)).toString("base64");
}

describe("the single-player room map", () => {
    it("lists exactly the room files under its root directory, each by its path there without the extension", () => {
        const roomPathsOnDisk = (fs.readdirSync(ROOMS_ROOT_PATH, {recursive: true}) as string[])
            .map(filePath => filePath.split(path.sep).join("/"))
            .filter(filePath => filePath.endsWith(RoomFile.FILE_EXTENSION))
            .map(filePath => filePath.slice(0, -RoomFile.FILE_EXTENSION.length))
            .sort();
        expect(roomPathsOnDisk.length).toBeGreaterThan(0);
        expect(roomMap().getRoomPaths().slice().sort()).toEqual(roomPathsOnDisk);
        for (const roomPath of roomPathsOnDisk)
            expect(roomMap().hasRoomPath(roomPath)).toBe(true);
        expect(roomMap().hasRoomPath("no-such-room")).toBe(false);
    });

    it("gives a room's address under the assets, which is where its file is", () => {
        for (const roomPath of roomMap().getRoomPaths())
        {
            const url = roomMap().getRoomURLByPath("https://example.test/app/assets", roomPath);
            expect(url).toBe(`https://example.test/app/assets/rooms/${roomPath}.room`);
            expect(fs.existsSync(path.join(process.cwd(), "public", url.slice("https://example.test/".length)))).toBe(true);
        }
    });

    it("holds the room every single-player mode is played in", () => {
        const modes = Object.keys(SinglePlayerModeConfigMap);
        expect(modes.length).toBeGreaterThan(0);
        for (const mode of modes)
            expect(roomMap().hasRoomPath(SinglePlayerModeConfigMap[mode].roomPath), mode).toBe(true);
    });

    it("lists only files this build reads as rooms, each gzipped and finished in a texture pack the game has", () => {
        for (const roomPath of roomMap().getRoomPaths())
        {
            const fileBytes = readFileBytes(roomPath);
            expect(RoomFile.isGzipped(fileBytes), roomPath).toBe(true);
            const roomFile = ServerRoomFileUtil.decode(fileBytes, "room");
            expect(ImageMapUtil.getImageMap("VoxelTexturePackImageMap").hasImagePath(roomFile.texturePackPath), roomPath)
                .toBe(true);
        }
    });

    it("has the room editor open on a room as the server makes one", () => {
        const opened = ServerRoomFileUtil.decode(
            readFileBytes(SinglePlayerModeConfigMap[ROOM_EDITOR_SINGLE_PLAYER_MODE].roomPath), "room");
        const generated = RoomGenerationUtil.generateRoom("", RoomTypeEnumMap.Regular);
        expect(encode(opened)).toBe(encode(RoomFile.fromRoom(generated)));
    });
});
