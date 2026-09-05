import { useCallback, useEffect, useState } from "react";
import App from "../../../app";
import ClientVoxelManager from "../../../voxel/clientVoxelManager";
import SocketsClient from "../../../networking/client/socketsClient";
import RestrictedZone from "../../../../shared/voxel/types/restrictedZone";
import SetRestrictedZonesSignal from "../../../../shared/voxel/types/update/setRestrictedZonesSignal";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import { MAX_RESTRICTED_ZONES, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../../shared/system/sharedConstants";
import { restrictedZonesChangedObservable } from "../../../../shared/system/sharedObservables";
import { notificationMessageObservable } from "../../../system/clientObservables";
import Text from "../basic/text";
import CompactIconButton from "./compactIconButton";
import IconButton from "./iconButton";
import QuestionMarkIcon from "../../svg/icons/questionMarkIcon";
import PlusIcon from "../../svg/icons/plusIcon";
import TrashIcon from "../../svg/icons/trashIcon";
import RestrictedZoneGrid from "./restrictedZoneGrid";

export const RESTRICTED_ZONES_TOOLTIP_BUTTON_ID = "restrictedZonesTooltipButton";
export const RESTRICTED_ZONES_TOOLTIP_TEXT = "Only you can edit things that are in the Restricted Zones.";

// The "Restricted Zones" section of a room's settings, shared by the two forms that offer it — a
// hub's, which an admin opens, and a room owner's own. What a zone is for is in
// @docs/gameplay/restricted_zone.md.
export default function RestrictedZonesSection({onToggleTooltip}: Props)
{
    const room = App.getCurrentRoom();

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // The room's own list is the one on screen, so a zone another superuser draws shows up here
    // without a reload. This counter is what re-reads it: the list is a field of the room rather
    // than state of this component, so React has to be told when it has been replaced.
    const [editCount, setEditCount] = useState(0);
    useEffect(() => {
        restrictedZonesChangedObservable.addListener("restrictedZonesSection",
            () => setEditCount(n => n + 1));
        return () => restrictedZonesChangedObservable.removeListener("restrictedZonesSection");
    }, []);

    const zones = room?.voxelGrid.restrictedZones ?? [];

    // A zone somebody else took away leaves nothing to be holding on to.
    useEffect(() => {
        if (selectedIndex != null && selectedIndex >= zones.length)
            setSelectedIndex(null);
    }, [editCount, zones.length, selectedIndex]);

    const apply = useCallback((next: RestrictedZone[]) => {
        if (!room)
            return false;
        if (!ClientVoxelManager.setRestrictedZones(room, next))
        {
            notificationMessageObservable.set("Failed to update the restricted zones.");
            return false;
        }
        // A single-player room is the client's own, regenerated locally each time and never stored,
        // so there is nobody to tell.
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitSetRestrictedZonesSignal(new SetRestrictedZonesSignal(room.id, next));
        return true;
    }, [room]);

    const addZone = useCallback(() => {
        const next = zones.concat(makeNewZone());
        if (apply(next))
            setSelectedIndex(next.length - 1);
    }, [zones, apply]);

    const removeZone = useCallback(() => {
        if (selectedIndex == null)
            return;
        if (apply(zones.filter((_zone, index) => index != selectedIndex)))
            setSelectedIndex(null);
    }, [zones, selectedIndex, apply]);

    return <>
        <div className="flex flex-row items-center">
            <CompactIconButton id={RESTRICTED_ZONES_TOOLTIP_BUTTON_ID} icon={<QuestionMarkIcon/>} size="md"
                onClick={() => onToggleTooltip(RESTRICTED_ZONES_TOOLTIP_BUTTON_ID, RESTRICTED_ZONES_TOOLTIP_TEXT)}/>
            <Text content="Restricted Zones:" size="sm"/>
        </div>
        <div className="flex flex-row items-center gap-1">
            <IconButton id="addRestrictedZoneButton" icon={<PlusIcon/>} size="sm" color="green"
                disabled={zones.length >= MAX_RESTRICTED_ZONES} onClick={addZone}/>
            <IconButton id="removeRestrictedZoneButton" icon={<TrashIcon/>} size="sm" color="red"
                disabled={selectedIndex == null} onClick={removeZone}/>
        </div>
        <RestrictedZoneGrid
            zones={zones}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onCommit={apply}
        />
    </>
}

// How big a zone starts out, in voxels. Big enough to be taken hold of straight away on a phone,
// where a voxel is only a few pixels across, and small enough that it is obviously something to be
// dragged into shape rather than a room already spoken for.
const NEW_ZONE_SIZE = 6;

// A new zone is dropped in the middle of the room, where it is furthest from being mistaken for one
// of the walls. The plan scrolls to wherever it lands, so it is never laid down out of sight.
function makeNewZone(): RestrictedZone
{
    const rowMin = Math.floor((NUM_VOXEL_ROWS - NEW_ZONE_SIZE) / 2);
    const colMin = Math.floor((NUM_VOXEL_COLS - NEW_ZONE_SIZE) / 2);
    return new RestrictedZone(rowMin, rowMin + NEW_ZONE_SIZE - 1,
        colMin, colMin + NEW_ZONE_SIZE - 1);
}

interface Props
{
    // Raising this section's explanation, which the form owns so that only one is ever up at a time.
    onToggleTooltip: (targetElementId: string, text: string) => void;
}
