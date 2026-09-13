// Client room-load stages in order, used for the loading progress bar (see RoomLoadProgressUtil).
type RoomLoadPhase = "awaitingServer" | "unloadingRoom" | "loadingGraphics" |
    "loadingVoxels" | "loadingObjects" | "compilingShaders";

export default RoomLoadPhase;
