import { useState } from "react";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import PaletteColorInput from "../../input/paletteColorInput";
import RangeInput from "../../input/rangeInput";
import SelectionToolRow from "./selectionToolRow";
import Text from "../../basic/text";
import App from "../../../../app";
import SocketsClient from "../../../../networking/client/socketsClient";
import ClientObjectManager from "../../../../object/clientObjectManager";
import SetObjectMetadataSignal from "../../../../../shared/object/types/setObjectMetadataSignal";
import RemoveObjectSignal from "../../../../../shared/object/types/removeObjectSignal";
import ObjectUpdateUtil from "../../../../../shared/object/util/objectUpdateUtil";
import WallLampObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/wallLampObjectTypeConfig";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { MAX_LAMP_INTENSITY, MAX_LAMP_RANGE, MIN_LAMP_INTENSITY,
    MIN_LAMP_RANGE } from "../../../../../shared/graphics/light/util/lampLightUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../../../shared/system/sharedConstants";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import { clientFeatureFlagsObservable, objectSelectionObservable } from "../../../../system/clientObservables";
import PopupUtil from "../../../util/popupUtil";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";

// Input bounds as strings; the ranges are short enough to tick every value (see LampLightUtil).
const MIN_INTENSITY_ATTRIBUTE = String(MIN_LAMP_INTENSITY);
const MAX_INTENSITY_ATTRIBUTE = String(MAX_LAMP_INTENSITY);
const MIN_RANGE_ATTRIBUTE = String(MIN_LAMP_RANGE);
const MAX_RANGE_ATTRIBUTE = String(MAX_LAMP_RANGE);

// Lamp tools: remove, or change its light (one stored setting that also colors the lit face;
// intensity and range are separate dials, see LampLightUtil).
export default function LampEditOptions(props: {selection: ObjectSelection})
{
    const obj = props.selection.gameObject.params;
    const [light, setLight] = useState(() => ({
        colorIndex: WallLampObjectTypeConfig.util.getColorIndex(obj),
        intensity: WallLampObjectTypeConfig.util.getIntensity(obj),
        range: WallLampObjectTypeConfig.util.getRange(obj),
    }));

    // Written immediately (not deferred): lamp edits are discrete, with few values.
    const apply = (edit: (next: typeof light) => void) => {
        const next = {...light};
        edit(next);
        setLight(next);
        trySetLightProperties(props.selection, WallLampObjectTypeConfig.util.encodeLightProperties(
            next.colorIndex, next.intensity, next.range));
    };

    return <SelectionToolRow>
        <IconButton icon={<TrashIcon/>} size="md" color="red"
            disabled={!canRemoveLamp(props.selection)}
            onClick={() => openRemoveConfirmPopup(props.selection)}
        />
        <div className="flex flex-row items-center gap-1 shrink-0">
            <Text content="Color" size="sm" additionalClassNames="shrink-0"/>
            <PaletteColorInput
                paletteName={LIGHT_COLOR_PALETTE_NAME}
                currValue={light.colorIndex}
                setColorIndex={(index) => apply(next => next.colorIndex = index)}
            />
        </div>
        <div className="flex flex-row items-center gap-1 shrink-0">
            <Text content="Intensity" size="sm" additionalClassNames="shrink-0"/>
            <RangeInput
                currValue={String(light.intensity)}
                setValue={(value) => apply(next => next.intensity = Number(value))}
                min={MIN_INTENSITY_ATTRIBUTE} max={MAX_INTENSITY_ATTRIBUTE} step="1"
                additionalClassNames="w-28"
            />
        </div>
        <div className="flex flex-row items-center gap-1 shrink-0">
            <Text content="Range" size="sm" additionalClassNames="shrink-0"/>
            <RangeInput
                currValue={String(light.range)}
                setValue={(value) => apply(next => next.range = Number(value))}
                min={MIN_RANGE_ATTRIBUTE} max={MAX_RANGE_ATTRIBUTE} step="1"
                additionalClassNames="w-28"
            />
        </div>
    </SelectionToolRow>;
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
