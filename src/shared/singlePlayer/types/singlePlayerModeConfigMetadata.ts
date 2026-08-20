import RoomGenerationVolume from "../../room/types/roomGeneration/roomGenerationVolume";

type SinglePlayerModeConfigMetadata = {
    entranceVoxelCol: number,
    entranceVoxelRow: number,
    hotspots: {[name: string]: {row: number, col: number}},

    // The parts of the room a scripted step has to be able to name: the spaces it is built out of,
    // and the stretches of wall it opens up along the way. Both are volumes, so a step opening one
    // of the latter takes the wall's own height from it rather than being told how tall the room is.
    volumes: {[name: string]: RoomGenerationVolume},
}

export default SinglePlayerModeConfigMetadata;
