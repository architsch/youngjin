import App from "../../app";
import GameModeUtil from "../../system/util/gameModeUtil";
import InstancedMeshGraphics from "../../object/components/instancedMeshGraphics";
import RestrictedZoneUtil from "../../../shared/voxel/util/restrictedZoneUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import VoxelQuadInstanceUtil from "./voxelQuadInstanceUtil";
import ClientVoxelQueryUtil from "./clientVoxelQueryUtil";
import { MAX_VISIBLE_VOXEL_QUADS_PER_ROOM } from "../../../shared/system/sharedConstants";
import { restrictedZonesChangedObservable } from "../../../shared/system/sharedObservables";
import { gameModeObservable } from "../../system/clientObservables";

// Paints restricted zones onto the room: every face of every voxel under a zone gets a red border via
// the voxel material's per-instance outline (see @docs/gameplay/restricted_zone.md).
export const RESTRICTED_ZONE_OUTLINE_COLOR = "#ff2a1f";

const RestrictedZoneOutlineUtil =
{
    // Outline strength for a quad. The whole voxel is outlined (not just unpaintable faces) to show
    // where the zone is. Shown to everyone in edit mode, including the superuser.
    getOutlineStrength(quadIndex: number): number
    {
        if (!GameModeUtil.isInEditMode())
            return 0;
        const room = App.getCurrentRoom();
        if (!room || room.voxelGrid.restrictedZones.length == 0)
            return 0;

        return RestrictedZoneUtil.voxelIsInAZone(room,
            VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
            VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex)) ? 1 : 0;
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

restrictedZonesChangedObservable.addListener("restrictedZoneOutlineUtil",
    () => RestrictedZoneOutlineUtil.refreshAll());
gameModeObservable.addListener("restrictedZoneOutlineUtil",
    () => RestrictedZoneOutlineUtil.refreshAll());

export default RestrictedZoneOutlineUtil;
