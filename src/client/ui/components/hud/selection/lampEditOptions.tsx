import { useState } from "react";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import PaletteColorInput from "../../input/paletteColorInput";
import RangeInput from "../../input/rangeInput";
import Text from "../../basic/text";
import App from "../../../../app";
import SocketsClient from "../../../../networking/client/socketsClient";
import ClientObjectManager from "../../../../object/clientObjectManager";
import SetObjectMetadataSignal from "../../../../../shared/object/types/setObjectMetadataSignal";
import RemoveObjectSignal from "../../../../../shared/object/types/removeObjectSignal";
import ObjectUpdateUtil from "../../../../../shared/object/util/objectUpdateUtil";
import LampObjectUtil from "../../../../../shared/object/util/lampObjectUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { MAX_ROOM_PREFS_STEP } from "../../../../../shared/room/util/roomPrefsUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../../../shared/system/sharedConstants";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import { clientFeatureFlagsObservable, objectSelectionObservable } from "../../../../system/clientObservables";
import PopupUtil from "../../../util/popupUtil";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";

const MAX_STEP_ATTRIBUTE = String(MAX_ROOM_PREFS_STEP);

// The tools for a lamp somebody has picked out: take it down, or change what it gives off.
//
// Everything about the light is one setting stored and written together, because the lit face of
// the lamp takes its color from the same value the light does — see LampObjectUtil. How strong it
// is and how far it spreads are separate dials within that, so a dim wash and a tight bright pool
// are both askable for (see LampLightUtil).
export default function LampEditOptions(props: {selection: ObjectSelection})
{
    const obj = props.selection.gameObject.params;
    const [light, setLight] = useState(() => ({
        colorIndex: LampObjectUtil.getColorIndex(obj),
        intensityStep: LampObjectUtil.getIntensityStep(obj),
        spreadStep: LampObjectUtil.getSpreadStep(obj),
    }));

    // Written straight through rather than deferred, the way a room's own lighting is: a lamp is
    // adjusted a step at a time from a palette and a slider that is let go of, not dragged against
    // a live preview, and there are only three values to send.
    const apply = (edit: (next: typeof light) => void) => {
        const next = {...light};
        edit(next);
        setLight(next);
        trySetLightProperties(props.selection, LampObjectUtil.encodeLightProperties(
            next.colorIndex, next.intensityStep, next.spreadStep));
    };

    return <div className="flex flex-row items-center gap-4 p-2 w-fit pointer-events-auto overflow-hidden bg-gray-800 rounded-md yj-surface-convex">
        <IconButton icon={<TrashIcon/>} size="md" color="red"
            disabled={!canRemoveLamp(props.selection)}
            onClick={() => openRemoveConfirmPopup(props.selection)}
        />
        <div className="flex flex-row items-center gap-1">
            <Text content="Color" size="sm"/>
            <PaletteColorInput
                paletteName={LIGHT_COLOR_PALETTE_NAME}
                currValue={light.colorIndex}
                setColorIndex={(index) => apply(next => next.colorIndex = index)}
            />
        </div>
        <div className="flex flex-row items-center gap-1">
            <Text content="Strength" size="sm"/>
            <RangeInput
                currValue={String(light.intensityStep)}
                setValue={(value) => apply(next => next.intensityStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
                additionalClassNames="w-28 shrink-0"
            />
        </div>
        <div className="flex flex-row items-center gap-1">
            <Text content="Spread" size="sm"/>
            <RangeInput
                currValue={String(light.spreadStep)}
                setValue={(value) => apply(next => next.spreadStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
                additionalClassNames="w-28 shrink-0"
            />
        </div>
    </div>;
}

function canRemoveLamp(selection: ObjectSelection): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectRemoval))
        return false;

    const room = App.getCurrentRoom();
    if (!room)
        return false;

    const objectId = selection.gameObject.params.objectId;
    return ObjectUpdateUtil.canRemoveObject(App.getUser(), room,
        new RemoveObjectSignal(room.id, objectId));
}

function openRemoveConfirmPopup(selection: ObjectSelection)
{
    PopupUtil.openPopup({
        popupType: "confirm",
        params: {
            message: "Want to remove this?",
            onConfirm: () => {
                tryRemoveLamp(selection);
                PopupUtil.closePopup();
            },
            onCancel: PopupUtil.closePopup
        }
    });
}

async function tryRemoveLamp(selection: ObjectSelection)
{
    if (objectSelectionObservable.peek() != selection || !canRemoveLamp(selection))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;

    ObjectSelection.unselect();
    VoxelQuadSelection.trySelectBestQuadNearby(selection.gameObject.params.transform.pos);
    const success = await ClientObjectManager.removeObject(objectId);
    if (success && room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
}

function trySetLightProperties(selection: ObjectSelection, lightProperties: string)
{
    const room = App.getCurrentRoom();
    if (!room)
        return;

    const objectId = selection.gameObject.params.objectId;
    const signal = new SetObjectMetadataSignal(room.id, objectId,
        ObjectMetadataKeyEnumMap.LightProperties, lightProperties);
    if (!ObjectUpdateUtil.canSetObjectMetadata(App.getUser(), room, signal))
        return;

    if (!ClientObjectManager.setObjectMetadata(objectId,
        ObjectMetadataKeyEnumMap.LightProperties, lightProperties))
    {
        return;
    }

    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitSetObjectMetadataSignal(signal);
}
