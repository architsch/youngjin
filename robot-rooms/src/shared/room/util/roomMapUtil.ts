import RoomMap from "../types/roomMap";

const roomMapByName: {[mapName: string]: RoomMap} = {};

const RoomMapUtil =
{
    getRoomMap: (mapName: string): RoomMap =>
    {
        return roomMapByName[mapName];
    },
    setRoomMap: (mapName: string, roomMap: RoomMap) =>
    {
        roomMapByName[mapName] = roomMap;
    },
}

export default RoomMapUtil;
