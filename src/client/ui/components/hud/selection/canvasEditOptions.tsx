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
import RestrictedZoneUtil from "../../../../../shared/voxel/util/restrictedZoneUtil";
import { clientFeatureFlagsObservable, objectSelectionObservable } from "../../../../system/clientObservables";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import PopupUtil from "../../../util/popupUtil";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import PictureIcon from "../../../svg/icons/pictureIcon";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import CustomizeCanvasPanel from "../../panel/customizeCanvasPanel";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

const FRAME_PANEL = "frame";

// Canvas tools: remove, image, and frame. The frame bar stacks above this row (it belongs to the canvas).
export default function CanvasEditOptions(props: EditOptionsProps)
{
    const imagePathMetadata = props.selection.gameObject.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
    const initialImagePath = imagePathMetadata ? imagePathMetadata.str : "";

    const customizingFrame = props.openPanel == FRAME_PANEL;

    // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager).
    const canEdit = canEditCanvas(props.selection);

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {customizingFrame && canEdit && <CustomizeCanvasPanel
            selection={props.selection}
            onClose={() => props.setOpenPanel(null)}
        />}
        <SelectionToolRow>
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
                disabled={!canEdit}
                onChoose={path => {
                    trySetCanvasMetadata(props.selection, ObjectMetadataKeyEnumMap.ImagePath, path);
                }}
            />
            <IconButton id="changeCanvasFrameButton" icon={<PictureFrameIcon/>} size="md"
                disabled={!canEdit}
                highlight={customizingFrame && canEdit}
                onClick={() => props.setOpenPanel(customizingFrame ? null : FRAME_PANEL)}
            />
        </SelectionToolRow>
    </div>;
}

// The room must be editable and the canvas outside others' restricted zones (see
// @docs/gameplay/restricted_zone.md). Choosers are disabled as a whole.
function canEditCanvas(selection: ObjectSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();
    const params = selection.gameObject.params;

    return !RestrictedZoneUtil.blocksObjectEdit(user, room, params.objectTypeIndex, params.transform);
}

function canRemoveCanvas(selection: ObjectSelection): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectRemoval))
        return false;

    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();

    const objectId = selection.gameObject.params.objectId;
    return ObjectUpdateUtil.canRemoveObject(user, room, new RemoveObjectSignal(room.id, objectId));
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
    VoxelQuadSelection.trySelectBestQuadNearby(selection.gameObject.params.transform.pos);
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

    const objectId = selection.gameObject.params.objectId;
    const signal = new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue);
    return ObjectUpdateUtil.canSetObjectMetadata(user, room, signal);
}

function trySetCanvasMetadata(selection: ObjectSelection, metadataKey: ObjectMetadataKey, metadataValue: string)
{
    if (!canSetCanvasMetadata(selection, metadataKey, metadataValue))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;
    if (!ClientObjectManager.setObjectMetadata(objectId, metadataKey, metadataValue))
        return;

    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue));
}
