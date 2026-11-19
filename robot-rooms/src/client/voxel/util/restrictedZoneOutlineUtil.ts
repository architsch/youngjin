import App from "../../app";
import GameModeUtil from "../../system/util/gameModeUtil";
import InstancedMeshGraphics from "../../object/components/instancedMeshGraphics";
import Room from "../../../shared/room/types/room";
import RoomVolume from "../../../shared/room/types/roomVolume";
import RestrictedZoneUtil from "../../../shared/voxel/util/restrictedZoneUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import VoxelQuadInstanceUtil from "./voxelQuadInstanceUtil";
import ClientVoxelQueryUtil from "./clientVoxelQueryUtil";
import { MAX_VISIBLE_VOXEL_QUADS_PER_ROOM } from "../../../shared/system/sharedConstants";
import { restrictedZonesChangedObservable } from "../../../shared/system/sharedObservables";
import { gameModeObservable } from "../../system/clientObservables";

// Paints restricted zones onto the room: every face of every block in a zone gets a red border via
// the voxel material's per-instance outline (see @docs/gameplay/restricted_zone.md).
export const RESTRICTED_ZONE_OUTLINE_COLOR = "#ff2a1f";

// The blocks of a room's zones as last read off it, which every quad drawn asks after: read again once a
// volume of the room has changed, or the room is another.
let zonesRoom: Room | undefined;
let blocksOfZones: RoomVolume[] = [];

const RestrictedZoneOutlineUtil =
{
    // Outline strength for a quad. Every face of a block in a zone is outlined (not just the unpaintable
    // ones) to show where the zone is. Shown to everyone in edit mode, whomever the zone is kept for.
    getOutlineStrength(quadIndex: number): number
    {
        if (!GameModeUtil.isInEditMode())
            return 0;
        const room = App.getCurrentRoom();
        if (!room)
            return 0;
        if (room != zonesRoom)
        {
            zonesRoom = room;
            blocksOfZones = RestrictedZoneUtil.getBlocksOfZones(room);
        }
        if (blocksOfZones.length == 0)
            return 0;

        // The room's own floor and ceiling count as the faces of the solid past the layers, which a zone
        // reaching that far covers (see RestrictedZoneUtil).
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex(quadIndex);
        return blocksOfZones.some(blocks => RestrictedZoneUtil.blocksHold(blocks, row, col, collisionLayer)) ? 1 : 0;
    },

    // Re-applies outlines to all visible quads when the answer changes room-wide (zone edits, mode
    // changes). Iterates mesh instances, which are far fewer than addressable quads.
    refreshAll(): void
    {
        const instancedMeshId = ClientVoxelQueryUtil.getVoxelInstancedMeshId();
        for (let instanceId = 0; instanceId < MAX_VISIBLE_VOXEL_QUADS_PER_ROOM; ++instanceId)
        {
            const quadIndex = VoxelQuadInstanceUtil.getQuadIndex(instanceId);
            if (quadIndex < 0)
                continue; // The instance is back in the pool, so it is drawing nothing.
            InstancedMeshGraphics.setInstanceOutline(instancedMeshId, instanceId,
                RestrictedZoneOutlineUtil.getOutlineStrength(quadIndex));
        }
    },
};

restrictedZonesChangedObservable.addListener("restrictedZoneOutlineUtil", () => {
    zonesRoom = undefined;
    RestrictedZoneOutlineUtil.refreshAll();
});
gameModeObservable.addListener("restrictedZoneOutlineUtil",
    () => RestrictedZoneOutlineUtil.refreshAll());

export default RestrictedZoneOutlineUtil;
