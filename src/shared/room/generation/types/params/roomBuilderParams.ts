import RandomNumberGenerator from "../../../../math/types/randomNumberGenerator";
import Vec3 from "../../../../math/types/vec3";
import RoomVolume from "../roomVolume";
import RoomPaletteSelectionParams from "./roomPaletteSelectionParams";

// Inputs to a RoomBuilder; where template-built rooms declare their room-level parameters. All fields
// are required (empty collections when unused), so a missing name is a config error, not a case.
type RoomBuilderParams = {
    // Where the room is entered, in world units and at floor level: where a single-player room's player
    // starts, or where a multiplayer room's entrance door stands (see DoorObjectTypeConfig).
    entrancePos: Vec3,

    // Packs and palettes the room may use; fewer candidates mean a plainer room.
    paletteSelection: RoomPaletteSelectionParams,

    // Named world positions (e.g. NPC spot, exit) for code outside generation.
    hotspots: {[name: string]: Vec3},

    // Named volumes (spaces, and walls a step opens) for code outside generation.
    volumes: {[name: string]: RoomVolume},

    rand: RandomNumberGenerator,
}

export default RoomBuilderParams;
