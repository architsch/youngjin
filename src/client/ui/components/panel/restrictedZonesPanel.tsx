import { useCallback, useEffect, useState } from "react";
import App from "../../../app";
import RoomVolume from "../../../../shared/room/types/roomVolume";
import RestrictedZoneUtil from "../../../../shared/voxel/util/restrictedZoneUtil";
import { restrictedZonesChangedObservable } from "../../../../shared/system/sharedObservables";
import { notificationMessageObservable } from "../../../system/clientObservables";
import RestrictedZonePlanUtil from "../../util/restrictedZonePlanUtil";
import IconButton from "../input/iconButton";
import TooltipButton from "../input/tooltipButton";
import PlusIcon from "../../svg/icons/plusIcon";
import TrashIcon from "../../svg/icons/trashIcon";
import RestrictedZoneGrid from "../input/restrictedZoneGrid";
import ScrollPanel from "./scrollPanel";

// Restricted zone plan panel (see CustomizeRoomPanel, @docs/gameplay/restricted_zone.md).
export default function RestrictedZonesPanel({ anchorElementId, onClose }: Props)
{
    const room = App.getCurrentRoom();

    // By its object's id (see RestrictedZoneUtil), so a zone somebody else took away leaves nothing selected.
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

    // The zones live in the room, so this counter forces a re-read when one changes.
    const [, setEditCount] = useState(0);
    useEffect(() => {
        restrictedZonesChangedObservable.addListener("restrictedZonesPanel",
            () => setEditCount(n => n + 1));
        return () => restrictedZonesChangedObservable.removeListener("restrictedZonesPanel");
    }, []);

    const zones = room ? RestrictedZoneUtil.getZones(room) : [];
    const selected = zones.find(zone => zone.objectId == selectedObjectId);

    const addZone = useCallback(async () => {
        if (!room)
            return;
        const objectId = await RestrictedZonePlanUtil.addZone(room);
        if (objectId == null)
            notificationMessageObservable.set(FAILURE_MESSAGE);
        else
            setSelectedObjectId(objectId);
    }, [room]);

    const removeZone = useCallback(async () => {
        if (!room || selectedObjectId == null)
            return;
        if (!await RestrictedZonePlanUtil.removeZone(room, selectedObjectId))
            notificationMessageObservable.set(FAILURE_MESSAGE);
    }, [room, selectedObjectId]);

    const setZoneBlocks = useCallback(async (objectId: string, blocks: RoomVolume) => {
        if (!room || !await RestrictedZonePlanUtil.setZoneBlocks(room, objectId, blocks))
            notificationMessageObservable.set(FAILURE_MESSAGE);
    }, [room]);

    return <ScrollPanel id="restrictedZonesOptions" anchorElementId={anchorElementId} onClose={onClose} size="lg">
        <div className="flex flex-col items-center gap-1 shrink-0">
            <TooltipButton id="restrictedZonesTooltipButton"
                text="Only you can edit things that are in the Restricted Zones."/>
            <IconButton id="addRestrictedZoneButton" icon={<PlusIcon/>} size="sm" color="green"
                disabled={!room || !RestrictedZonePlanUtil.canAddZone(room)} onClick={addZone}/>
            <IconButton id="removeRestrictedZoneButton" icon={<TrashIcon/>} size="sm" color="red"
                disabled={selected == undefined} onClick={removeZone}/>
        </div>
        <RestrictedZoneGrid
            zones={zones}
            selectedObjectId={selected?.objectId ?? null}
            onSelect={setSelectedObjectId}
            onCommit={setZoneBlocks}
        />
    </ScrollPanel>;
}

const FAILURE_MESSAGE = "Failed to update the restricted zones.";

interface Props
{
    anchorElementId: string; // DOM element id of the toggle the panel hangs from (see ScrollPanel)
    onClose: () => void;
}
