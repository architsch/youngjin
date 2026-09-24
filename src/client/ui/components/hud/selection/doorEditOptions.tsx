import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import TextCursorIcon from "../../../svg/icons/textCursorIcon";
import DestinationIcon from "../../../svg/icons/destinationIcon";
import PaintBrushIcon from "../../../svg/icons/paintBrushIcon";
import GearIcon from "../../../svg/icons/gearIcon";
import DoorIcon from "../../../svg/icons/doorIcon";
import DoorGameObject from "../../../../object/types/doorGameObject";
import DoorObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { DoorTypeEnumMap } from "../../../../../shared/object/types/doorType";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import PopupUtil from "../../../util/popupUtil";
import ObjectEditUtil from "../../../util/objectEditUtil";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import CustomizeLabelTextPanel from "../../panel/customizeLabelTextPanel";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

const TEXT_PANEL = "text";
const APPEARANCE_PANEL = "appearance";

// Superuser tools for a selected door: remove, name, destination, finish, default entrance. The name bar and
// the finish list stack above this row (they belong to the door), one at a time; the rest open as popups.
export default function DoorEditOptions(props: EditOptionsProps)
{
    const customizingText = props.openPanel == TEXT_PANEL;
    const customizing = props.openPanel == APPEARANCE_PANEL;

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {customizingText && <CustomizeLabelTextPanel
            selection={props.selection}
            onClose={() => props.setOpenPanel(null)}
        />}
        {customizing && <CompositionThumbnailPanel
            id="customizeDoorOptions"
            objectType={DoorObjectTypeConfig.objectType}
            currentCompositionIndex={ObjectEditUtil.getCompositionIndex(props.selection)}
            onChoose={(compositionIndex) => ObjectEditUtil.trySetCompositionIndex(props.selection, compositionIndex)}
            onClose={() => props.setOpenPanel(null)}
        />}
        <SelectionToolRow>
            <IconButton id="removeDoorButton" icon={<TrashIcon/>} size="md" color="red"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection,
                    "Want to remove this door?")}
            />
            <IconButton id="changeDoorLabelButton" icon={<TextCursorIcon/>} size="md"
                highlight={customizingText}
                onClick={() => props.setOpenPanel(customizingText ? null : TEXT_PANEL)}
            />
            <IconButton id="changeDoorDestinationButton" icon={<DestinationIcon/>} size="md"
                onClick={() => PopupUtil.openPopup({popupType: "doorDestination", params: {
                    initialDestinationRoomID:
                        DoorObjectTypeConfig.util.getDestinationRoomId(props.selection.gameObject.params),
                    initialDestinationDoorLabel:
                        DoorObjectTypeConfig.util.getDestinationDoorLabel(props.selection.gameObject.params),
                    onChooseRoom: (roomID: string) => ObjectEditUtil.trySetObjectMetadata(props.selection,
                        ObjectMetadataKeyEnumMap.DestinationRoomId, roomID),
                    onSetDoorLabel: (label: string) => ObjectEditUtil.trySetObjectMetadata(props.selection,
                        ObjectMetadataKeyEnumMap.DestinationDoorLabel, label),
                }})}
            />
            <IconButton id="customizeDoorButton" icon={<PaintBrushIcon/>} size="md"
                highlight={customizing}
                onClick={() => props.setOpenPanel(customizing ? null : APPEARANCE_PANEL)}
            />
            <IconButton id="doorSettingsButton" icon={<GearIcon/>} size="md"
                onClick={() => PopupUtil.openPopup({popupType: "doorSettings", params: {
                    isDefaultEntrance:
                        DoorObjectTypeConfig.util.getDoorType(props.selection.gameObject.params)
                            == DoorTypeEnumMap.DefaultEntrance,
                    onSetDefaultEntrance: (isDefaultEntrance: boolean) => ObjectEditUtil.trySetObjectMetadata(
                        props.selection, ObjectMetadataKeyEnumMap.DoorType,
                        `${isDefaultEntrance ? DoorTypeEnumMap.DefaultEntrance : DoorTypeEnumMap.CustomEntrance}`),
                }})}
            />
            {/* Set apart: it uses the door rather than editing it (a selected door can't be clicked through). */}
            <div className="w-px shrink-0 self-stretch bg-gray-600"/>
            <IconButton id="enterDoorButton" icon={<DoorIcon/>} size="md" color="green"
                onClick={() => (props.selection.gameObject as DoorGameObject).enter()}
            />
        </SelectionToolRow>
    </div>;
}
