import { useEffect, useReducer } from "react";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import AddBlockIcon from "../../../svg/icons/addBlockIcon";
import AddCanvasIcon from "../../../svg/icons/addCanvasIcon";
import AddDoorIcon from "../../../svg/icons/addDoorIcon";
import AddLampIcon from "../../../svg/icons/addLampIcon";
import App from "../../../../app";
import SocketsClient from "../../../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../../../shared/object/maps/objectTypeConfigMap";
import VoxelQueryUtil from "../../../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../../../shared/networking/types/encodableByteString";
import ObjectUpdateUtil from "../../../../../shared/object/util/objectUpdateUtil";
import ObjectFactory from "../../../../object/factories/objectFactory";
import ClientObjectManager from "../../../../object/clientObjectManager";
import AddObjectSignal from "../../../../../shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../../../shared/object/types/removeObjectSignal";
import WallAttachedObjectUtil from "../../../../../shared/object/util/wallAttachedObjectUtil";
import ObjectTransform from "../../../../../shared/object/types/objectTransform";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import Vec3 from "../../../../../shared/math/types/vec3";
import ErrorUtil from "../../../../../shared/system/util/errorUtil";
import ImageMapUtil from "../../../../../shared/graphics/image/util/imageMapUtil";
import ClientVoxelManager from "../../../../voxel/clientVoxelManager";
import VoxelUpdateUtil from "../../../../../shared/voxel/util/voxelUpdateUtil";
import RemoveVoxelBlockSignal from "../../../../../shared/voxel/types/update/removeVoxelBlockSignal";
import DoorObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER } from "../../../../../shared/system/sharedConstants";
import AddVoxelBlockSignal from "../../../../../shared/voxel/types/update/addVoxelBlockSignal";
import ObjectIdUtil from "../../../../../shared/object/util/objectIdUtil";
import { clientFeatureFlagsObservable, notificationMessageObservable, voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import Room from "../../../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import PopupUtil from "../../../util/popupUtil";
import NumUtil from "../../../../../shared/math/util/numUtil";
import RoomValidationUtil from "../../../../../shared/room/util/roomValidationUtil";
import { DoorTypeEnumMap } from "../../../../../shared/object/types/doorType";
import WallLampObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/wallLampObjectTypeConfig";
import SelectionToolRow from "./selectionToolRow";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("WallLamp");

// Feature flags whose toggling changes whether this menu's buttons are enabled.
const placementFeatureFlags = [
    FeatureFlag.DisableManualVoxelBlockAddition,
    FeatureFlag.DisableManualVoxelBlockRemoval,
    FeatureFlag.DisableManualObjectAddition,
];

export default function VoxelQuadPlacementOptions(props: {selection: VoxelQuadSelection})
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);

    // Re-render this menu only when the feature flags it depends on change (e.g. tutorial steps).
    useEffect(() => {
        for (const flag of placementFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("voxelQuadPlacementOptions", flag, forceRefresh);
        return () => {
            for (const flag of placementFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("voxelQuadPlacementOptions", flag);
        };
    }, []);

    const canAddCanvas = getPlaceableWallAttachedObjectTransform(
        props.selection, canvasTypeIndex) !== null;

    // Doors: admin only, in rooms whose doors are theirs to lay (see RoomValidationUtil).
    const room = App.getCurrentRoom();
    const canManageDoors = room != undefined &&
        RoomValidationUtil.canUserManageDoors(App.getUser(), room);
    const canAddDoor = canManageDoors &&
        getPlaceableWallAttachedObjectTransform(props.selection, doorTypeIndex) !== null;

    const canAddLamp = getPlaceableWallAttachedObjectTransform(props.selection, lampTypeIndex) !== null;

    return <SelectionToolRow>
        <IconButton id="removeVoxelBlockButton" icon={<TrashIcon/>} size="md" color="red"
            disabled={!canRemoveVoxelBlock(props.selection)}
            onClick={() => tryRemoveVoxelBlock(props.selection)}/>
        <IconButton id="addVoxelBlockButton" icon={<AddBlockIcon/>} size="md"
            disabled={!canAddVoxelBlock(props.selection)}
            onClick={() => tryAddVoxelBlock(props.selection)}/>
        <IconButton id="addCanvasButton" icon={<AddCanvasIcon/>} size="md"
            disabled={!canAddCanvas}
            onClick={() => {
                const randomImagePath = ImageMapUtil.getImageMap("CanvasImageMap").getRandomImagePath();
                const randomFrameCoords = ImageMapUtil.getImageMap("CanvasFrameImageMap").getRandomImagePath();
                tryAddObjectFromQuad(props.selection, canvasTypeIndex, {
                    [ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(randomImagePath),
                    [ObjectMetadataKeyEnumMap.CanvasFrameCoords]: new EncodableByteString(randomFrameCoords),
                });
            }}
        />
        {canManageDoors && <IconButton id="addDoorButton" icon={<AddDoorIcon/>} size="md"
            disabled={!canAddDoor}
            onClick={() => {
                // New doors lead nowhere and aren't default entrances until configured.
                tryAddObjectFromQuad(props.selection, doorTypeIndex, {
                    [ObjectMetadataKeyEnumMap.DoorType]:
                        new EncodableByteString(`${DoorTypeEnumMap.CustomEntrance}`),
                });
            }}
        />}
        <IconButton id="addLampButton" icon={<AddLampIcon/>} size="md"
            disabled={!canAddLamp}
            onClick={() => {
                // New lamps use default light settings.
                tryAddObjectFromQuad(props.selection, lampTypeIndex, {
                    [ObjectMetadataKeyEnumMap.LightProperties]:
                        new EncodableByteString(WallLampObjectTypeConfig.util.getDefaultLightProperties()),
                });
            }}
        />
    </SelectionToolRow>;
}

// Placement transform for an attachment on the clicked wall, or null. Position and facing come from
// the quad; heights are tried per type (see getCandidateHeights).
function getPlaceableWallAttachedObjectTransform(selection: VoxelQuadSelection,
    objectTypeIndex: number): ObjectTransform | null
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectAddition))
        return null;

    const room = App.getCurrentRoom();
    if (!room)
        return null;
    const user = App.getUser();

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex);

    if (dirY != 0)
        return null; // a floor or a ceiling, which nothing hangs on

    const x = voxel.col + 0.5 + offsetX;
    const z = voxel.row + 0.5 + offsetZ;
    const dir: Vec3 = {x: dirX, y: dirY, z: dirZ};

    for (const y of getCandidateHeights(objectTypeIndex, quadIndex, offsetY))
    {
        const tr = new ObjectTransform({x, y, z}, dir);
        const obj = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex,
            ObjectIdUtil.generateRandomObjectId(), tr);
        if (ObjectUpdateUtil.canAddObject(user, room, obj))
            return tr;
    }
    return null;
}

// Candidate heights in order: pictures try the snap steps around the click height; lamps (one layer
// tall) try the clicked layer then the one above; doors stand on the storey floor, origin half a
// footprint up (see DoorObjectTypeConfig).
function getCandidateHeights(objectTypeIndex: number, quadIndex: number, offsetY: number): number[]
{
    if (objectTypeIndex == lampTypeIndex)
    {
        // A wall quad is exactly one layer, as tall as a lamp.
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            return [];
        return [
            VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(collisionLayer),
            VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(collisionLayer + 1),
        ];
    }
    if (objectTypeIndex != doorTypeIndex)
        return [0.5 * Math.ceil(2 * offsetY), 0.5 * Math.floor(2 * offsetY)];

    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return [];

    const storeyFloorLayer = (collisionLayer >= STOREY_FLOOR_COLLISION_LAYER)
        ? STOREY_FLOOR_COLLISION_LAYER + 1 : COLLISION_LAYER_MIN;
    const floorY = (storeyFloorLayer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT;
    return [floorY + 0.5 * DoorObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeY];
}

async function tryAddObjectFromQuad(selection: VoxelQuadSelection,
    objectTypeIndex: number, metadata: {[key: number]: EncodableByteString})
{
    try {
        const tr = getPlaceableWallAttachedObjectTransform(selection, objectTypeIndex);
        if (tr == null)
            return;

        const room = App.getCurrentRoom()!;
        const user = App.getUser();
        const objectId = ObjectIdUtil.generateRandomObjectId();
        const signal = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex, objectId, tr, metadata);
        
        // Add the game object locally, and report it to the server if successful.
        const gameObject = ObjectFactory.createServerSideObject(signal);
        const success = await ClientObjectManager.addObject(gameObject);
        if (success)
        {
            if (room.roomType != RoomTypeEnumMap.SinglePlayer)
                SocketsClient.emitAddObjectSignal(signal);
            VoxelQuadSelection.unselect();
            ObjectSelection.trySelect(gameObject);
        }
    } catch (err) {
        console.error(`Exception while trying to add an object from a voxelQuad :: Error: ${ErrorUtil.getErrorMessage(err)}`);
    }
}

function canAddVoxelBlock(selection: VoxelQuadSelection): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualVoxelBlockAddition))
        return false;

    const room = App.getCurrentRoom();
    if (!room)
        return false;

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (facingAxis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (facingAxis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newCollisionLayer = collisionLayer;
    if (facingAxis == "y")
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = (orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX;
        else
            newCollisionLayer += (orientation == "+") ? 1 : -1;
    }

    const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    return VoxelUpdateUtil.canAddVoxelBlock(App.getUser(), room, targetQuadIndex);
}

function tryAddVoxelBlock(selection: VoxelQuadSelection)
{
    if (!canAddVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (facingAxis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (facingAxis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newCollisionLayer = collisionLayer;
    if (facingAxis == "y")
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = (orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX;
        else
            newCollisionLayer += (orientation == "+") ? 1 : -1;
    }

    const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, collisionLayer);
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        quadTextureIndicesWithinLayer[i - startIndex] = App.getVoxelQuads()[i] & 0b01111111;

    const idealQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    if (ClientVoxelManager.addVoxelBlock(room, idealQuadIndex, quadTextureIndicesWithinLayer))
    {
        VoxelQuadSelection.unselect();
        const idealVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, newRow, newCol);
        if (idealVoxel)
            VoxelQuadSelection.trySelectBestQuad(idealVoxel, idealQuadIndex);
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitAddVoxelBlockSignal(new AddVoxelBlockSignal(room.id, idealQuadIndex, quadTextureIndicesWithinLayer));
    }
}

// Attachments don't disable removal; the user is warned and they are removed with the block.
function canRemoveVoxelBlock(selection: VoxelQuadSelection): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualVoxelBlockRemoval))
        return false;

    const room = App.getCurrentRoom();
    if (!room)
        return false;
    return VoxelUpdateUtil.canRemoveVoxelBlockWithItsWallAttachments(
        App.getUser(), room, selection.quadIndex);
}

function tryRemoveVoxelBlock(selection: VoxelQuadSelection)
{
    if (voxelQuadSelectionObservable.peek() != selection || !canRemoveVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;

    if (reportUndetachableAttachment(room, selection.quadIndex))
        return;

    // Confirm only when hand-placed attachments would be destroyed.
    if (WallAttachedObjectUtil.getObjectIdsAttachedToVoxelBlock(room, selection.quadIndex).length > 0)
    {
        PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message: "Something is attached to the wall. Removing the wall will destroy it, too. Want to proceed?",
                onConfirm: () => {
                    PopupUtil.closePopup();
                    removeVoxelBlockWithItsWallAttachments(selection);
                },
                onCancel: PopupUtil.closePopup,
            },
        });
        return;
    }
    removeVoxelBlockWithItsWallAttachments(selection);
}

// Reports and returns true if an attachment on the block can't be removed by this user (e.g. a door),
// instead of confirming a removal that would then fail.
function reportUndetachableAttachment(room: Room, quadIndex: number): boolean
{
    const user = App.getUser();

    for (const objectId of WallAttachedObjectUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
    {
        const obj = room.objectById[objectId];
        if (obj == undefined || ObjectUpdateUtil.canRemoveObject(user, room,
            new RemoveObjectSignal(room.id, objectId)))
        {
            continue;
        }
        // Type names are CamelCase ("WallLamp"), so split into words for display.
        const objectName = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex)
            .objectType.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
        notificationMessageObservable.set(
            `Can't remove a block because a ${objectName} is attached to it.`);
        return true;
    }
    return false;
}

async function removeVoxelBlockWithItsWallAttachments(selection: VoxelQuadSelection)
{
    // Re-checked: the room may have changed while the confirmation popup was up.
    if (voxelQuadSelectionObservable.peek() != selection || !canRemoveVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const quadIndex = selection.quadIndex;

    // A door may have been hung meanwhile.
    if (reportUndetachableAttachment(room, quadIndex))
        return;

    // Attachments first; the server processes signals in order and reaches the same result.
    for (const objectId of WallAttachedObjectUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
    {
        const removed = await ClientObjectManager.removeObject(objectId);
        if (removed && room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
    }

    if (ClientVoxelManager.removeVoxelBlock(room, quadIndex))
    {
        VoxelQuadSelection.unselect();

        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const newRow = NumUtil.clampInRange(
            (facingAxis == "z") ? (orientation == "-" ? row+1 : row-1) : row,
            0, NUM_VOXEL_ROWS-1);
        const newCol = NumUtil.clampInRange(
            (facingAxis == "x") ? (orientation == "-" ? col+1 : col-1) : col,
            0, NUM_VOXEL_COLS-1);
        const newCollisionLayer = (facingAxis == "y")
            ? VoxelQueryUtil.getVoxelQuadCollisionLayerAfterOffset(quadIndex, (orientation == "-") ? 1 : -1)
            : collisionLayer;
        
        const idealQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
        const idealVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, newRow, newCol);
        if (idealVoxel)
            VoxelQuadSelection.trySelectBestQuad(idealVoxel, idealQuadIndex);

        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitRemoveVoxelBlockSignal(new RemoveVoxelBlockSignal(room.id, quadIndex));
    }
}