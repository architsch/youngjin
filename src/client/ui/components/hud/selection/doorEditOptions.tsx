import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import TextCursorIcon from "../../../svg/icons/textCursorIcon";
import PaletteIcon from "../../../svg/icons/paletteIcon";
import DestinationIcon from "../../../svg/icons/destinationIcon";
import PaintBrushIcon from "../../../svg/icons/paintBrushIcon";
import GearIcon from "../../../svg/icons/gearIcon";
import DoorIcon from "../../../svg/icons/doorIcon";
import DoorGameObject from "../../../../object/types/gameObject/doorGameObject";
import DoorObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import LabelTextUtil from "../../../../../shared/object/util/labelTextUtil";
import { DoorTypeEnumMap } from "../../../../../shared/object/types/doorType";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { LABEL_COLOR_PALETTE_NAME } from "../../../../../shared/system/sharedConstants";
import PopupUtil from "../../../util/popupUtil";
import ObjectEditUtil from "../../../util/objectEditUtil";
import ColorPaletteThumbnailPanel from "../../panel/colorPaletteThumbnailPanel";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import CustomizeLabelTextPanel from "../../panel/customizeLabelTextPanel";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

// Superuser tools for a selected door: remove, name, name color, destination, finish, default entrance. The name,
// color and finish buttons are toggles, each showing its panel beneath this row, one at a time; the rest open as
// popups.
export default function DoorEditOptions(props: EditOptionsProps)
{
    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        <SelectionToolRow>
            <IconButton id="removeDoorButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection,
                    "Want to remove this door?")}
            />
            <IconButton id="changeDoorLabelButton" icon={<TextCursorIcon/>} size="md"
                highlight={props.openPanel == "labelText"}
                onClick={() => props.setOpenPanel("labelText")}
            />
            <IconButton id="changeDoorLabelColorButton" icon={<PaletteIcon/>} size="md"
                highlight={props.openPanel == "colorPaletteThumbnail"}
                onClick={() => props.setOpenPanel("colorPaletteThumbnail")}
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
                highlight={props.openPanel == "compositionThumbnail"}
                onClick={() => props.setOpenPanel("compositionThumbnail")}
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
        {props.openPanel == "labelText" && <CustomizeLabelTextPanel selection={props.selection}/>}
        {props.openPanel == "colorPaletteThumbnail" && <ColorPaletteThumbnailPanel
            id="labelColorOptions"
            paletteName={LABEL_COLOR_PALETTE_NAME}
            currentColorIndex={LabelTextUtil.getColorIndex(props.selection.gameObject.params)}
            onChoose={(colorIndex) => ObjectEditUtil.trySetObjectMetadata(props.selection,
                ObjectMetadataKeyEnumMap.LabelColor, `${colorIndex}`)}
        />}
        {props.openPanel == "compositionThumbnail" && <CompositionThumbnailPanel
            id="customizeDoorOptions"
            objectType={DoorObjectTypeConfig.objectType}
            currentCompositionIndex={ObjectEditUtil.getCompositionIndex(props.selection)}
            onChoose={(compositionIndex) => ObjectEditUtil.trySetCompositionIndex(props.selection, compositionIndex)}
        />}
    </div>;
}
