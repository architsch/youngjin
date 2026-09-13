import RoomBuilder from "./roomBuilder";
import RoomVolumeUtil from "../../util/roomVolumeUtil";
import RoomVolume from "../roomVolume";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../../system/sharedConstants";

export default class SandboxRoomBuilder extends RoomBuilder
{
    override run(): RoomBuilder
    {
        super.run();

        const {params, room} = this;
        const voxels = room.voxelGrid.voxels;

        // Carve everything but the bottom floor and top ceiling. A palette is required even here, since
        // carving refuses volumes without one.
        RoomVolumeUtil.carveOutVolume(voxels, new RoomVolume(
            0, NUM_VOXEL_ROWS-1, 0, NUM_VOXEL_COLS-1,
            COLLISION_LAYER_MIN, COLLISION_LAYER_MAX, this.nextPalette()));
        return this;
    }
}