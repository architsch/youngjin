// What both sides know of a single-player mode. Its steps are client-only (see SinglePlayerModeClientConfig).
export default interface SinglePlayerModeConfig
{
    // The room the mode is played in, as its file's path in the single-player room map (see RoomMap). The
    // client fetches the file; the server keeps no copy of the room.
    roomPath: string;
    // Whether only an admin may enter.
    adminOnly: boolean;
}
