import RoomMapSeed from "../../../shared/room/types/roomMapSeed";

// Every room map SSG builds, by map name.
export const RoomMapSeeds = {
    // The rooms single-player modes are played in (see SinglePlayerModeConfig).
    SinglePlayerRoomMap: {
        rootDirName: "rooms",
        mapName: "SinglePlayerRoomMap",
    },
} satisfies {[mapName: string]: RoomMapSeed};
