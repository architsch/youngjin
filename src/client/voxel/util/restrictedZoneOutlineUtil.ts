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

// Where a room's restricted zones are, drawn onto the room itself: every face of every voxel a zone
// stands over is painted with a red border, so a zone is seen as the block work it actually covers
// rather than as a shape floating in the air near it (see @docs/gameplay/restricted_zone.md).
//
// The border is painted by the voxel material, which is told per instance whether to draw one (see
// MaterialConstructorMap's addInstanceOutline). What this module does is answer that question — for
// one quad as it comes into view, and for the whole room whenever the answer changes for all of it
// at once.
export const RESTRICTED_ZONE_OUTLINE_COLOR = "#ff2a1f";

const RestrictedZoneOutlineUtil =
{
    // How strongly the given quad should be outlined, as the material reads it.
    //
    // The whole voxel is outlined rather than only the faces a zone forbids painting, because what
    // this marks out is the block work a zone has taken over, and its outermost faces are part of
    // that: they may still be painted, but the block behind them may not be removed. The user is not
    // being shown one rule at a time — he is being shown where the zone is.
    //
    // Everybody in edit mode sees them, the superuser whose zones they are included: he is the one
    // placing them, and cannot place them blind.
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

    // Brings every quad the room currently has on show into line with the answer above. Called when
    // that answer changes for the room as a whole — a zone drawn, dragged or taken away, or edit
    // mode being entered or left — rather than per quad, which is what a quad taking an instance
    // does for itself.
    //
    // The sweep runs over the mesh's instances rather than over the grid's quads, because the mesh
    // holds one instance per quad *on show* while the grid addresses every face of every layer of
    // every cell: two orders of magnitude between them, and the ones not on show have nothing to
    // draw an outline on.
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
