// The successive stages a room load goes through on the client side, in the order they run.
// The loading indicator's progress bar is derived from which stage is currently under way and how
// far into it the client is (see RoomLoadProgressUtil).
//
// "awaitingServer": the room change has been requested and the room's contents have not arrived
//      yet. Nothing needs to report this stage — it is where every room load begins.
// "unloadingRoom": the room being left is being torn down (skipped when there is no room yet).
// "loadingGraphics": the renderer and the physics world are being prepared for the new room.
// "loadingVoxels": the new room's voxel texture pack is being applied.
// "loadingObjects": the new room's voxels and objects are being spawned, along with the images
//      each of them needs — which makes this the longest stage of a typical load.
// "compilingShaders": the shader program of every material now in the scene is being compiled
//      up front, so that none of them stalls a frame later on.
type RoomLoadPhase = "awaitingServer" | "unloadingRoom" | "loadingGraphics" |
    "loadingVoxels" | "loadingObjects" | "compilingShaders";

export default RoomLoadPhase;
