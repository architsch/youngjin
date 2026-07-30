import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import ImageChooser from "../../input/imageChooser";
import App from "../../../../app";
import SocketsClient from "../../../../networking/client/socketsClient";
import ClientObjectManager from "../../../../object/clientObjectManager";
import SetObjectMetadataSignal from "../../../../../shared/object/types/setObjectMetadataSignal";
import RemoveObjectSignal from "../../../../../shared/object/types/removeObjectSignal";
import ObjectUpdateUtil from "../../../../../shared/object/util/objectUpdateUtil";
import { clientFeatureFlagsObservable, objectSelectionObservable, userRoleObservable } from "../../../../system/clientObservables";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import PopupUtil from "../../../util/popupUtil";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import PictureIcon from "../../../svg/icons/pictureIcon";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import { useEffect } from "react";
import FTUEUtil from "../../../util/ftueUtil";
import { FTUEElementCodeEnumMap } from "../../../types/ftueElementCode";

let changeImageButtonFTUETimeout: ReturnType<typeof setTimeout> | undefined;
let changeFrameButtonFTUETimeout: ReturnType<typeof setTimeout> | undefined;

export default function CanvasEditOptions(props: {selection: ObjectSelection})
{
    const go = props.selection.gameObject;
    const imagePathMetadata = go.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
    const initialImagePath = imagePathMetadata ? imagePathMetadata.str : "";
    const frameCoordsMetadata = go.params.metadata[ObjectMetadataKeyEnumMap.CanvasFrameCoords];
    const initialFrameCoords = frameCoordsMetadata ? frameCoordsMetadata.str : "";

    useEffect(() => {
        clearFTUETimeouts();
        if (!FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasImage))
        {
            // If the user hasn't change a canvas's image yet,
            // we will show a coach mark which tells he user to try changing it.
            changeImageButtonFTUETimeout = setTimeout(() => {
                FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.ChangeCanvasImage,
                    "changeCanvasImageButton", "Choose your own picture.");
            }, 750);
        }
        if (FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasImage) &&
            !FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasFrame))
        {
            // If the user hasn't change a canvas's frame yet (but already has changed a canvas's image),
            // we will show a coach mark which tells he user to try changing it.
            changeFrameButtonFTUETimeout = setTimeout(() => {
                FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.ChangeCanvasFrame,
                    "changeCanvasFrameButton", "Try a different frame.");
            }, 750);
        }
        return () => {
            clearFTUETimeouts();
        };
    }, []);

    return <div className="flex flex-row gap-4 p-2 w-fit pointer-events-auto overflow-hidden bg-gray-800 rounded-md">
        <IconButton icon={<TrashIcon/>} size="md" color="red"
            disabled={!canRemoveCanvas(props.selection)}
            onClick={() => openRemoveConfirmPopup(props.selection)}
        />
        <ImageChooser
            title="Change Image"
            id="changeCanvasImageButton"
            icon={<PictureIcon/>}
            viewType="list"
            mapName="CanvasImageMap"
            initialChoicePath={initialImagePath}
            onChoose={path => {
                trySetCanvasMetadata(props.selection, ObjectMetadataKeyEnumMap.ImagePath, path);
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasImage);
            }}
        />
        <ImageChooser
            title="Change Frame"
            id="changeCanvasFrameButton"
            icon={<PictureFrameIcon/>}
            viewType="grid"
            mapName="CanvasFrameImageMap"
            initialChoicePath={initialFrameCoords}
            onChoose={coords => {
                trySetCanvasMetadata(props.selection, ObjectMetadataKeyEnumMap.CanvasFrameCoords, coords);
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasFrame);
            }}
        />
    </div>;
}

function clearFTUETimeouts()
{
    if (changeImageButtonFTUETimeout)
    {
        clearTimeout(changeImageButtonFTUETimeout);
        changeImageButtonFTUETimeout = undefined;
    }
    if (changeFrameButtonFTUETimeout)
    {
        clearTimeout(changeFrameButtonFTUETimeout);
        changeFrameButtonFTUETimeout = undefined;
    }
}

function canRemoveCanvas(selection: ObjectSelection): boolean
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
            message: "Want to remove this?",
            onConfirm: () => {
                tryRemoveCanvas(selection);
                PopupUtil.closePopup();
            },
            onCancel: PopupUtil.closePopup
        }
    });
}

async function tryRemoveCanvas(selection: ObjectSelection)
{
    if (objectSelectionObservable.peek() != selection || !canRemoveCanvas(selection))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;

    // Remove the game object locally, and report it to the server if successful.
    ObjectSelection.unselect();
    const success = await ClientObjectManager.removeObject(objectId);
    if (success)
    {
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
    }
}

function canSetCanvasMetadata(selection: ObjectSelection, metadataKey: ObjectMetadataKey, metadataValue: string): boolean
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

function trySetCanvasMetadata(selection: ObjectSelection, metadataKey: ObjectMetadataKey, metadataValue: string)
{
    if (!canSetCanvasMetadata(selection, metadataKey, metadataValue))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;
    if (!ClientObjectManager.setObjectMetadata(objectId, metadataKey, metadataValue))
        return;

    objectSelectionObservable.notify();

    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue));
}
