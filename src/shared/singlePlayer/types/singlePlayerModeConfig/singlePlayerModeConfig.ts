import RoomBuilderParams from "../../../room/generation/types/params/roomBuilderParams";
import Room from "../../../room/types/room";

// A single-player mode's room parameters and construction (shared). Steps are client-only
// (SinglePlayerModeClientConfig). Template rooms declare every room-level parameter rather than drawing
// them (see @docs/geometry/room_generation.md).
export default interface SinglePlayerModeConfig
{
    getRoomBuilderParams: () => RoomBuilderParams;
    buildRoom: (room: Room) => void;
}
