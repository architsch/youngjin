import { useState } from "react";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import TextCursorIcon from "../../../svg/icons/textCursorIcon";
import DestinationIcon from "../../../svg/icons/destinationIcon";
import PaintBrushIcon from "../../../svg/icons/paintBrushIcon";
import GearIcon from "../../../svg/icons/gearIcon";
import DoorIcon from "../../../svg/icons/doorIcon";
import DoorGameObject from "../../../../object/types/doorGameObject";
import App from "../../../../app";
import SocketsClient from "../../../../networking/client/socketsClient";
import ClientObjectManager from "../../../../object/clientObjectManager";
import SetObjectMetadataSignal from "../../../../../shared/object/types/setObjectMetadataSignal";
import RemoveObjectSignal from "../../../../../shared/object/types/removeObjectSignal";
import ObjectUpdateUtil from "../../../../../shared/object/util/objectUpdateUtil";
import DoorObjectUtil from "../../../../../shared/object/util/doorObjectUtil";
import { DoorTypeEnumMap } from "../../../../../shared/object/types/doorType";
import { clientFeatureFlagsObservable, objectSelectionObservable, userRoleObservable } from "../../../../system/clientObservables";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import PopupUtil from "../../../util/popupUtil";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import CustomizeDoorForm from "../../form/customizeDoorForm";

// What an admin can do to the door he has picked out: take it down, name it, point it somewhere,
// paint it, and say whether it is the room's own way in.
//
// The appearance bar is raised from here rather than from the screen's own layout, and stacks above
// this row: it belongs to this door, and it should go away when the door does. Everything else opens
// as a popup, since each is a question with an answer rather than a control to keep to hand.
export default function DoorEditOptions(props: {selection: ObjectSelection})
{
    const [customizing, setCustomizing] = useState<boolean>(false);

    // The column takes the width it is given rather than shrinking to its contents: the appearance
    // bar scrolls sideways when it holds more than fits, and a column sized to its widest child would
    // grow to fit it instead and leave it nothing to scroll within. The tool row keeps its own
    // width — it is a row of buttons, not a panel.
    return <div className="flex flex-col gap-1 w-full">
        {customizing && <CustomizeDoorForm
            selection={props.selection}
            onClose={() => setCustomizing(false)}
        />}
        <div className="flex flex-row gap-4 p-2 w-fit pointer-events-auto overflow-hidden bg-gray-800 rounded-md yj-surface-convex">
            <IconButton icon={<TrashIcon/>} size="md" color="red"
                disabled={!canRemoveDoor(props.selection)}
                onClick={() => openRemoveConfirmPopup(props.selection)}
            />
            <IconButton id="changeDoorLabelButton" icon={<TextCursorIcon/>} size="md"
                onClick={() => PopupUtil.openPopup({popupType: "objectLabel", params: {
                    initialText: DoorObjectUtil.getLabel(props.selection.gameObject.params),
                    initialColorIndex: DoorObjectUtil.getLabelColorIndex(
                        props.selection.gameObject.params),
                    onSetText: (text: string) => trySetDoorMetadata(props.selection,
                        ObjectMetadataKeyEnumMap.Label, text),
                    onSetColorIndex: (colorIndex: number) => trySetDoorMetadata(props.selection,
                        ObjectMetadataKeyEnumMap.LabelColor, `${colorIndex}`),
                }})}
            />
            <IconButton id="changeDoorDestinationButton" icon={<DestinationIcon/>} size="md"
                onClick={() => PopupUtil.openPopup({popupType: "doorDestination", params: {
                    initialDestinationRoomID:
                        DoorObjectUtil.getDestinationRoomId(props.selection.gameObject.params),
                    initialDestinationDoorLabel:
                        DoorObjectUtil.getDestinationDoorLabel(props.selection.gameObject.params),
                    onChooseRoom: (roomID: string) => trySetDoorMetadata(props.selection,
                        ObjectMetadataKeyEnumMap.DestinationRoomId, roomID),
                    onSetDoorLabel: (label: string) => trySetDoorMetadata(props.selection,
                        ObjectMetadataKeyEnumMap.DestinationDoorLabel, label),
                }})}
            />
            <IconButton id="customizeDoorButton" icon={<PaintBrushIcon/>} size="md"
                highlight={customizing}
                onClick={() => setCustomizing(prev => !prev)}
            />
            <IconButton id="doorSettingsButton" icon={<GearIcon/>} size="md"
                onClick={() => PopupUtil.openPopup({popupType: "doorSettings", params: {
                    isDefaultEntrance:
                        DoorObjectUtil.getDoorType(props.selection.gameObject.params)
                            == DoorTypeEnumMap.DefaultEntrance,
                    onSetDefaultEntrance: (isDefaultEntrance: boolean) => trySetDoorMetadata(
                        props.selection, ObjectMetadataKeyEnumMap.DoorType,
                        `${isDefaultEntrance ? DoorTypeEnumMap.DefaultEntrance : DoorTypeEnumMap.CustomEntrance}`),
                }})}
            />
            {/* Set apart from the rest, because it is the one button here that does nothing to the
                door: it uses it. Picking a door out is how an admin comes to be working on it, so
                this is also the only way left for him to walk through one. */}
            <div className="w-px self-stretch bg-gray-600"/>
            <IconButton id="enterDoorButton" icon={<DoorIcon/>} size="md" color="green"
                onClick={() => (props.selection.gameObject as DoorGameObject).enter()}
            />
        </div>
    </div>;
}

function canRemoveDoor(selection: ObjectSelection): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectRemoval))
        return false;

    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();
    const userRole = userRoleObservable.peek();

    const objectId = selection.gameObject.params.objectId;
    return ObjectUpdateUtil.canRemoveObject(user, userRole, room, new RemoveObjectSignal(room.id, objectId));
}

function openRemoveConfirmPopup(selection: ObjectSelection)
{
    PopupUtil.openPopup({
        popupType: "confirm",
        params: {
            message: "Want to remove this door?",
            onConfirm: () => {
                tryRemoveDoor(selection);
                PopupUtil.closePopup();
            },
            onCancel: PopupUtil.closePopup
        }
    });
}

async function tryRemoveDoor(selection: ObjectSelection)
{
    // Re-checked rather than trusted from the caller: a confirmation popup stands between the click
    // and this call, and the room may have moved on while it was up.
    if (objectSelectionObservable.peek() != selection || !canRemoveDoor(selection))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;

    ObjectSelection.unselect();
    VoxelQuadSelection.trySelectBestQuadNearby(selection.gameObject.params.transform.pos);
    const success = await ClientObjectManager.removeObject(objectId);
    if (success)
    {
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
    }
}

function canSetDoorMetadata(selection: ObjectSelection, metadataKey: ObjectMetadataKey, metadataValue: string): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();
    const userRole = userRoleObservable.peek();

    const objectId = selection.gameObject.params.objectId;
    const signal = new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue);
    return ObjectUpdateUtil.canSetObjectMetadata(user, userRole, room, signal);
}

function trySetDoorMetadata(selection: ObjectSelection, metadataKey: ObjectMetadataKey, metadataValue: string)
{
    if (!canSetDoorMetadata(selection, metadataKey, metadataValue))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;
    if (!ClientObjectManager.setObjectMetadata(objectId, metadataKey, metadataValue))
        return;

    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue));
}
