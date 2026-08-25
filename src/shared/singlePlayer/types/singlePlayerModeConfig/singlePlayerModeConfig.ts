import RoomBuilderParams from "../../../room/generation/types/params/roomBuilderParams";
import Room from "../../../room/types/room";

// What a single-player mode's room is: the parameters it is built from, and how it is built.
// Shared, because the server generates the same room the client does.
//
// What the mode *does* to the user once he is inside that room — the steps he is walked through — is
// the client's alone, and lives in SinglePlayerModeClientConfig.
//
// A single-player room is a fixed, hand-authored template rather than a procedural one, so it
// *declares* the room-level parameters it is built with instead of drawing them. It still has to
// account for every one of them, for the same reason a procedural generator does
// (see @docs/geometry/room_generation.md).
export default interface SinglePlayerModeConfig
{
    getRoomBuilderParams: () => RoomBuilderParams;
    buildRoom: (room: Room) => void;
}
