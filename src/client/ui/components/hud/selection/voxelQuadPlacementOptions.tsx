import { ReactNode, useEffect, useReducer, useState } from "react";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import AddBlockIcon from "../../../svg/icons/addBlockIcon";
import AddCanvasIcon from "../../../svg/icons/addCanvasIcon";
import AddPropIcon from "../../../svg/icons/addPropIcon";
import AddDoorIcon from "../../../svg/icons/addDoorIcon";
import AddLampIcon from "../../../svg/icons/addLampIcon";
import AddLabelIcon from "../../../svg/icons/addLabelIcon";
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
import ObjectAttachmentUtil from "../../../../../shared/object/util/objectAttachmentUtil";
import ObjectScaleUtil from "../../../../../shared/object/util/objectScaleUtil";
import ObjectTransform from "../../../../../shared/object/types/objectTransform";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import Vec3 from "../../../../../shared/math/types/vec3";
import ErrorUtil from "../../../../../shared/system/util/errorUtil";
import ImageMapUtil from "../../../../../shared/graphics/image/util/imageMapUtil";
import ImageMetadata from "../../../../../shared/graphics/image/types/imageMetadata";
import ClientVoxelManager from "../../../../voxel/clientVoxelManager";
import VoxelUpdateUtil from "../../../../../shared/voxel/util/voxelUpdateUtil";
import RemoveVoxelBlockSignal from "../../../../../shared/voxel/types/update/removeVoxelBlockSignal";
import DoorObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, DIR_VEC_BY_NAME, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3 } from "../../../../../shared/system/sharedConstants";
import QuarterTurnsUtil from "../../../../../shared/object/util/quarterTurnsUtil";
import PointerCoordUtil from "../../../../graphics/util/pointerCoordUtil";
import AddVoxelBlockSignal from "../../../../../shared/voxel/types/update/addVoxelBlockSignal";
import ObjectIdUtil from "../../../../../shared/object/util/objectIdUtil";
import { clientFeatureFlagsObservable, notificationMessageObservable, objectInstalledObservable,
    voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import Room from "../../../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import PopupUtil from "../../../util/popupUtil";
import NumUtil from "../../../../../shared/math/util/numUtil";
import RoomValidationUtil from "../../../../../shared/room/util/roomValidationUtil";
import { DoorTypeEnumMap } from "../../../../../shared/object/types/doorType";
import LampObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import LabelObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import CanvasObjectTypeConfig, { CANVAS_IMAGE_SUBFOLDER } from "../../../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import PropObjectTypeConfig, { PROP_IMAGE_SUBFOLDER } from "../../../../../shared/object/types/objectTypeConfig/propObjectTypeConfig";
import SelectionToolRow from "./selectionToolRow";
import { ObjectMetadata } from "../../../../../shared/object/types/objectMetadata";
import ImageMapThumbnailPanel from "../../panel/imageMapThumbnailPanel";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import CompositionMetadataUtil from "../../../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
import PreEncodedCompositionIndexMap from "../../../../../shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const propTypeIndex = ObjectTypeConfigMap.getIndexByType("Prop");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
const labelTypeIndex = ObjectTypeConfigMap.getIndexByType("Label");

// What a new label says, so it shows (and can be clicked) before anything is written on it.
const NEW_LABEL_TEXT = "Label";

// Feature flags whose toggling changes whether this menu's buttons are enabled.
const placementFeatureFlags = [
    FeatureFlag.DisableManualVoxelBlockAddition,
    FeatureFlag.DisableManualVoxelBlockRemoval,
    FeatureFlag.DisableManualObjectAddition,
];

// Face tools: remove or add a block, or add an object. An object's look is picked first, from a chooser that stacks
// above this row, and the pick adds it.
export default function VoxelQuadPlacementOptions(props: {selection: VoxelQuadSelection})
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);
    // The type whose chooser is open.
    const [choosingTypeIndex, setChoosingTypeIndex] = useState<number | null>(null);

    // Re-render this menu only when the feature flags it depends on change (e.g. tutorial steps).
    useEffect(() => {
        for (const flag of placementFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("voxelQuadPlacementOptions", flag, forceRefresh);
        return () => {
            for (const flag of placementFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("voxelQuadPlacementOptions", flag);
        };
    }, []);

    const canAddCanvas = getImages(CANVAS_IMAGE_SUBFOLDER).length > 0
        && getPlaceableAttachedObjectTransform(props.selection, canvasTypeIndex) !== null;
    const propImageFits = getPropImageFits(props.selection);
    const canAddProp = getImages(PROP_IMAGE_SUBFOLDER).some(image => propImageFits(image.path));
    const lampSizeFits = (compositionIndex: number) => getPlaceableAttachedObjectTransform(props.selection,
        lampTypeIndex, LampObjectTypeConfig.util.getScale(compositionIndex)) !== null;
    const canAddLamp = (PreEncodedCompositionIndexMap.Lamp ?? []).some(lampSizeFits);

    // Doors and labels: the room's superuser only (see RoomValidationUtil).
    const room = App.getCurrentRoom();
    const isSuperuser = room != undefined &&
        RoomValidationUtil.isRoomSuperuser(App.getUser(), room);
    const canAddDoor = isSuperuser &&
        getPlaceableAttachedObjectTransform(props.selection, doorTypeIndex) !== null;
    const canAddLabel = isSuperuser &&
        getPlaceableAttachedObjectTransform(props.selection, labelTypeIndex) !== null;

    // A chooser shows only while its type can be added to the selected face. A pick closes it at once, so a second
    // click can't add another while the first goes up.
    const canAdd = new Map([[canvasTypeIndex, canAddCanvas], [propTypeIndex, canAddProp], [lampTypeIndex, canAddLamp],
        [labelTypeIndex, canAddLabel], [doorTypeIndex, canAddDoor]]);
    const choosing = (choosingTypeIndex != null && canAdd.get(choosingTypeIndex)) ? choosingTypeIndex : null;
    const close = () => setChoosingTypeIndex(null);
    const addButton = (id: string, icon: ReactNode, objectTypeIndex: number) => <IconButton id={id} icon={icon}
        size="md" disabled={!canAdd.get(objectTypeIndex)} highlight={choosing == objectTypeIndex}
        onClick={() => setChoosingTypeIndex((choosing == objectTypeIndex) ? null : objectTypeIndex)}/>;

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {choosing == canvasTypeIndex && <ImageMapThumbnailPanel
            id="canvasImageOptions"
            searchInputId="canvasImageSearchInput"
            searchPlaceholder="Search by title or author"
            mapName="PictureImageMap"
            subfolder={CANVAS_IMAGE_SUBFOLDER}
            onChoose={path => { close(); tryAddCanvasFromQuad(props.selection, path); }}
            onClose={close}
        />}
        {choosing == propTypeIndex && <ImageMapThumbnailPanel
            id="propImageOptions"
            searchInputId="propImageSearchInput"
            searchPlaceholder="Search"
            mapName="PictureImageMap"
            subfolder={PROP_IMAGE_SUBFOLDER}
            canChoose={propImageFits}
            onChoose={path => { close(); tryAddPropFromQuad(props.selection, path); }}
            onClose={close}
        />}
        {choosing == lampTypeIndex && <CompositionThumbnailPanel
            id="lampSizeOptions"
            objectType={LampObjectTypeConfig.objectType}
            canChoose={lampSizeFits}
            onChoose={compositionIndex => { close(); tryAddLampFromQuad(props.selection, compositionIndex); }}
            onClose={close}
        />}
        {choosing == labelTypeIndex && <CompositionThumbnailPanel
            id="customizeLabelOptions"
            objectType={LabelObjectTypeConfig.objectType}
            onChoose={compositionIndex => { close(); tryAddLabelFromQuad(props.selection, compositionIndex); }}
            onClose={close}
        />}
        {choosing == doorTypeIndex && <CompositionThumbnailPanel
            id="customizeDoorOptions"
            objectType={DoorObjectTypeConfig.objectType}
            onChoose={compositionIndex => { close(); tryAddDoorFromQuad(props.selection, compositionIndex); }}
            onClose={close}
        />}
        <SelectionToolRow>
            <IconButton id="removeVoxelBlockButton" icon={<TrashIcon/>} size="md" color="red"
                disabled={!canRemoveVoxelBlock(props.selection)}
                onClick={() => tryRemoveVoxelBlock(props.selection)}/>
            <IconButton id="addVoxelBlockButton" icon={<AddBlockIcon/>} size="md"
                disabled={!canAddVoxelBlock(props.selection)}
                onClick={() => tryAddVoxelBlock(props.selection)}/>
            {addButton("addCanvasButton", <AddCanvasIcon/>, canvasTypeIndex)}
            {addButton("addPropButton", <AddPropIcon/>, propTypeIndex)}
            {addButton("addLampButton", <AddLampIcon/>, lampTypeIndex)}
            {isSuperuser && addButton("addLabelButton", <AddLabelIcon/>, labelTypeIndex)}
            {isSuperuser && addButton("addDoorButton", <AddDoorIcon/>, doorTypeIndex)}
        </SelectionToolRow>
    </div>;
}

// Placement transform for an object attached to the clicked face, or null if its type can't face that way
// or nothing on the face near the click takes it (see ObjectAttachmentUtil.findPlacement). At the scale a new one
// takes, given the scales that find a placement, unless given one; checked with the metadata it will be added with.
function getPlaceableAttachedObjectTransform(selection: VoxelQuadSelection, objectTypeIndex: number,
    scale?: Vec3, metadata: ObjectMetadata = {}): ObjectTransform | null
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectAddition))
        return null;

    const room = App.getCurrentRoom();
    if (!room)
        return null;
    const user = App.getUser();

    const {center, dir} = getClickedFace(selection);
    if (!ObjectAttachmentUtil.allowsFacing(objectTypeIndex, dir))
        return null;

    const objectId = ObjectIdUtil.generateRandomObjectId();
    const accepts = (tr: ObjectTransform) => ObjectUpdateUtil.canAddObject(user, room,
        new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex, objectId, tr, metadata));

    // Doors stand on the storey floor, origin half a footprint up (see DoorObjectTypeConfig), rather than
    // wherever there is room near the click.
    if (objectTypeIndex == doorTypeIndex)
    {
        const doorY = getDoorHeight(selection.quadIndex);
        if (doorY == undefined)
            return null;
        const tr = new ObjectTransform({...center, y: doorY}, dir, {...UNIT_VEC3});
        return accepts(tr) ? tr : null;
    }
    const place = (placedScale: Vec3) => ObjectAttachmentUtil.findPlacement(room, objectTypeIndex, center, dir,
        placedScale, accepts);
    return place(scale ?? ObjectScaleUtil.getDefaultScale(objectTypeIndex, fitting => place(fitting) != undefined))
        ?? null;
}

// The clicked face's middle, and the way it faces.
function getClickedFace(selection: VoxelQuadSelection): {center: Vec3, dir: Vec3}
{
    const voxel = selection.voxel;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, selection.quadIndex);
    return {
        center: {x: voxel.col + 0.5 + offsetX, y: offsetY, z: voxel.row + 0.5 + offsetZ},
        dir: {x: dirX, y: dirY, z: dirZ},
    };
}

function getDoorHeight(quadIndex: number): number | undefined
{
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return undefined;

    const storeyFloorLayer = (collisionLayer >= STOREY_FLOOR_COLLISION_LAYER)
        ? STOREY_FLOOR_COLLISION_LAYER + 1 : COLLISION_LAYER_MIN;
    const floorY = (storeyFloorLayer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT;
    return floorY + 0.5 * DoorObjectTypeConfig.components.spawnedByAny.collider.baseHitboxSize.sizeY;
}

async function tryAddObjectFromQuad(selection: VoxelQuadSelection, objectTypeIndex: number,
    metadata: ObjectMetadata, scale?: Vec3)
{
    const tr = getPlaceableAttachedObjectTransform(selection, objectTypeIndex, scale, metadata);
    if (tr != null)
        await addObject(objectTypeIndex, tr, metadata);
}

// Frameless until its frame is picked, at the size a new canvas takes where it goes (see CanvasObjectTypeConfig) and
// upright as the user sees it (on a floor or ceiling too).
async function tryAddCanvasFromQuad(selection: VoxelQuadSelection, imagePath: string)
{
    await tryAddObjectFromQuad(selection, canvasTypeIndex, {
        [ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(imagePath),
        [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: new EncodableByteString(
            CanvasObjectTypeConfig.util.getFramelessLook()),
        [ObjectMetadataKeyEnumMap.QuarterTurns]: new EncodableByteString(
            QuarterTurnsUtil.encode(getUprightQuarterTurns(selection))),
    });
}

// An everyday object at its image's own size, upright as the user sees it (on a floor or ceiling too).
async function tryAddPropFromQuad(selection: VoxelQuadSelection, imagePath: string)
{
    const quarterTurns = getUprightQuarterTurns(selection);
    await tryAddObjectFromQuad(selection, propTypeIndex, getPropMetadata(imagePath, quarterTurns),
        PropObjectTypeConfig.util.getImageScale(imagePath, quarterTurns));
}

// At the size of the look picked, with default light settings (see LampObjectTypeConfig).
async function tryAddLampFromQuad(selection: VoxelQuadSelection, compositionIndex: number)
{
    await tryAddObjectFromQuad(selection, lampTypeIndex, {
        [ObjectMetadataKeyEnumMap.LightProperties]:
            new EncodableByteString(LampObjectTypeConfig.util.getDefaultLightProperties()),
    }, LampObjectTypeConfig.util.getScale(compositionIndex));
}

async function tryAddLabelFromQuad(selection: VoxelQuadSelection, compositionIndex: number)
{
    const look = CompositionMetadataUtil.encodeIndexed(compositionIndex,
        LabelObjectTypeConfig.components.spawnedByAny.instancedMeshComposer.codecVersion);
    await tryAddObjectFromQuad(selection, labelTypeIndex, {
        [ObjectMetadataKeyEnumMap.Label]: new EncodableByteString(NEW_LABEL_TEXT),
        [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: new EncodableByteString(look),
    });
}

// New doors lead nowhere and aren't default entrances until configured.
async function tryAddDoorFromQuad(selection: VoxelQuadSelection, compositionIndex: number)
{
    const look = CompositionMetadataUtil.encodeIndexed(compositionIndex,
        DoorObjectTypeConfig.components.spawnedByAny.instancedMeshComposer.codecVersion);
    await tryAddObjectFromQuad(selection, doorTypeIndex, {
        [ObjectMetadataKeyEnumMap.DoorType]: new EncodableByteString(`${DoorTypeEnumMap.CustomEntrance}`),
        [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: new EncodableByteString(look),
    });
}

// Whether a prop showing an image fits near the click, at the size the image pins it to: asked once per size, as
// images share a handful of them.
function getPropImageFits(selection: VoxelQuadSelection): (imagePath: string) => boolean
{
    const quarterTurns = getUprightQuarterTurns(selection);
    const fitsBySize = new Map<string, boolean>();
    return (imagePath: string) => {
        const scale = PropObjectTypeConfig.util.getImageScale(imagePath, quarterTurns);
        const size = scale ? `${scale.x},${scale.y}` : "";
        if (!fitsBySize.has(size))
        {
            fitsBySize.set(size, getPlaceableAttachedObjectTransform(selection, propTypeIndex, scale,
                getPropMetadata(imagePath, quarterTurns)) !== null);
        }
        return fitsBySize.get(size)!;
    };
}

function getPropMetadata(imagePath: string, quarterTurns: number): ObjectMetadata
{
    return {
        [ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(imagePath),
        [ObjectMetadataKeyEnumMap.QuarterTurns]: new EncodableByteString(QuarterTurnsUtil.encode(quarterTurns)),
    };
}

// The turn that shows content upright on the clicked face as the user sees it (see
// QuarterTurnsUtil.pickQuarterTurnsOnScreen).
function getUprightQuarterTurns(selection: VoxelQuadSelection): number
{
    const {center, dir} = getClickedFace(selection);
    return QuarterTurnsUtil.pickQuarterTurnsOnScreen(center, DIR_VEC_BY_NAME["+y"], center, dir,
        PointerCoordUtil.projectPoint);
}

// The picture map's images a canvas (paintings) or a prop (everyday objects) may show.
function getImages(subfolder: string): ImageMetadata[]
{
    return ImageMapUtil.getImageMap("PictureImageMap").getImageMetadataListInSubfolder(subfolder);
}

async function addObject(objectTypeIndex: number, tr: ObjectTransform, metadata: ObjectMetadata)
{
    try {
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
            if (ObjectSelection.trySelect(gameObject))
                objectInstalledObservable.set(objectId);
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
    return VoxelUpdateUtil.canRemoveVoxelBlockWithItsAttachments(
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
    if (ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, selection.quadIndex).length > 0)
    {
        PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message: "Something is attached to this block. Removing the block will destroy it, too. Want to proceed?",
                onConfirm: () => {
                    PopupUtil.closePopup();
                    removeVoxelBlockWithItsAttachments(selection);
                },
                onCancel: PopupUtil.closePopup,
            },
        });
        return;
    }
    removeVoxelBlockWithItsAttachments(selection);
}

// Reports and returns true if an attachment on the block can't be removed by this user (e.g. a door),
// instead of confirming a removal that would then fail.
function reportUndetachableAttachment(room: Room, quadIndex: number): boolean
{
    const user = App.getUser();

    for (const objectId of ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
    {
        const obj = room.objectById[objectId];
        if (obj == undefined || ObjectUpdateUtil.canRemoveObject(user, room,
            new RemoveObjectSignal(room.id, objectId)))
        {
            continue;
        }
        // Type names are CamelCase, so split into words for display.
        const objectName = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex)
            .objectType.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
        notificationMessageObservable.set(
            `Can't remove a block because a ${objectName} is attached to it.`);
        return true;
    }
    return false;
}

async function removeVoxelBlockWithItsAttachments(selection: VoxelQuadSelection)
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
    for (const objectId of ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
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