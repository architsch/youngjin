import RandomNumberGenerator from "../../../../math/types/randomNumberGenerator";
import Vec3 from "../../../../math/types/vec3";
import RoomVolume from "../roomVolume";
import RoomPaletteSelectionParams from "./roomPaletteSelectionParams";

// Everything a RoomBuilder is told before it starts, and the only place a room-level parameter is
// named for a room that is built from a template rather than drawn.
//
// Every field is required. A builder that is handed nothing to work with gets empty collections
// rather than absent ones, so that nothing downstream has to ask whether it was given anything —
// a single-player mode's steps address `volumes.wall1` by name, and a name that is not there is a
// mistake in the config rather than a case to handle.
type RoomBuilderParams = {
    entranceVoxelCol: number,
    entranceVoxelRow: number,
    entranceVoxelCollisionLayer: number, // = where the player's bottom (feet) will be placed on the y-axis. If collisionLayer is 0, the player's bottom will be located at (y = 0).

    // What the room may be finished in: the packs its textures may be positions within, and the
    // palettes its spaces may wear. Every room is finished by drawing from these, so how much
    // decoration one comes out wearing is settled by how much it was offered — a room given a
    // single pack and a single palette comes out plain throughout.
    paletteSelection: RoomPaletteSelectionParams,

    // Places in the room a caller outside generation has to be able to name — where an NPC stands,
    // where the way out is — as world positions, so that nothing reading one has to know how a voxel
    // cell maps onto the world.
    hotspots: {[name: string]: Vec3},

    // The parts of the room a caller outside generation has to be able to name: the spaces it is
    // built out of, and the stretches of wall a scripted step opens up as it sends the player on.
    // Both are volumes, so a step opening one of the latter takes the wall's own height from it
    // rather than being told how tall the room is.
    volumes: {[name: string]: RoomVolume},

    rand: RandomNumberGenerator,
}

export default RoomBuilderParams;
