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

        // Carve out everything and leave only the bottommost floor and topmost ceiling.
        //
        // The palette is what the carve finishes the enclosing faces in, and a volume handed none
        // is refused outright - so it has to be asked for even here, where every face it settles is
        // the one floor and the one ceiling this room has.
        RoomVolumeUtil.carveOutVolume(voxels, new RoomVolume(
            0, NUM_VOXEL_ROWS-1, 0, NUM_VOXEL_COLS-1,
            COLLISION_LAYER_MIN, COLLISION_LAYER_MAX, this.nextPalette()));
        return this;
    }
}