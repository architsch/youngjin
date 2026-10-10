import App from "../../app";
import ImageMapUtil from "../../../shared/graphics/image/util/imageMapUtil";
import Room from "../../../shared/room/types/room";
import ClientRoomFileUtil from "../../system/util/clientRoomFileUtil";
import RoomMapUtil from "../../../shared/room/util/roomMapUtil";
import SinglePlayerModeConfigMap from "../../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
import RoomEditorUtil from "./roomEditorUtil";

// A file that doesn't come is asked for again, this many times in all, this far apart.
const NUM_FETCH_ATTEMPTS = 3;
const FETCH_RETRY_DELAY_MS = 1000;

const SinglePlayerRoomLoadUtil =
{
    // Fills a single-player room in, which arrives empty (see Room.encode): from its mode's file in the
    // single-player room map (see SinglePlayerModeConfig.roomPath), or from the file the room editor was asked to
    // open. False if that can't be had or read, with the room left as it came.
    tryLoad: async (room: Room): Promise<boolean> =>
    {
        try
        {
            const bytes = RoomEditorUtil.takeFileToOpen(room) ?? await fetchRoomFile(room.roomName);
            const roomFile = ClientRoomFileUtil.decode(bytes, room.id);
            if (!ImageMapUtil.getImageMap("VoxelTexturePackImageMap").hasImagePath(roomFile.texturePackPath))
                throw new Error(`Unknown texture pack (texturePackPath = ${roomFile.texturePackPath})`);

            room.voxelGrid = roomFile.voxelGrid;
            room.objectGroup = roomFile.objectGroup;
            room.texturePackPath = roomFile.texturePackPath;
            room.prefs = roomFile.prefs;
            return true;
        }
        catch (err)
        {
            console.error(`Failed to load the single-player room (mode = ${room.roomName}).`, err);
            return false;
        }
    },
}

async function fetchRoomFile(singlePlayerMode: string): Promise<Uint8Array>
{
    const roomPath = SinglePlayerModeConfigMap[singlePlayerMode].roomPath;
    const roomMap = RoomMapUtil.getRoomMap("SinglePlayerRoomMap");
    if (!roomMap.hasRoomPath(roomPath))
        throw new Error(`No such room in the map (roomPath = ${roomPath})`);
    const url = roomMap.getRoomURLByPath(App.getEnv().assets_url, roomPath);

    for (let attempt = 1; ; ++attempt)
    {
        try
        {
            const response = await fetch(url);
            if (!response.ok)
                throw new Error(`Status ${response.status}`);
            return new Uint8Array(await response.arrayBuffer());
        }
        catch (err)
        {
            if (attempt >= NUM_FETCH_ATTEMPTS)
                throw new Error(`Failed to fetch "${url}" :: ${err}`);
            await new Promise(resolve => setTimeout(resolve, FETCH_RETRY_DELAY_MS));
        }
    }
}

export default SinglePlayerRoomLoadUtil;
