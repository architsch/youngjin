import { ReactNode, useEffect, useReducer, useRef, useState } from "react";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import AddBlockIcon from "../../../svg/icons/addBlockIcon";
import AddCanvasIcon from "../../../svg/icons/addCanvasIcon";
import AddPropIcon from "../../../svg/icons/addPropIcon";
import AddDoorIcon from "../../../svg/icons/addDoorIcon";
import AddLampIcon from "../../../svg/icons/addLampIcon";
import AddLabelIcon from "../../../svg/icons/addLabelIcon";
import AddNpcIcon from "../../../svg/icons/addNpcIcon";
import AddVolumeIcon from "../../../svg/icons/addVolumeIcon";
import VolumeObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import App from "../../../../app";
import SocketsClient from "../../../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../../../shared/object/maps/objectTypeConfigMap";
import VoxelQueryUtil from "../../../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../../../shared/networking/types/encodableByteString";
import ObjectUpdateUtil from "../../../../../shared/object/util/objectUpdateUtil";
import ObjectFactory from "../../../../object/factories/objectFactory";
import ObjectTypeClientConfigMap from "../../../../object/maps/objectTypeClientConfigMap";
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
import ImageChoiceUtil from "../../../util/imageChoiceUtil";
import ClientVoxelManager from "../../../../voxel/clientVoxelManager";
import RoomEditUtil from "../../../../system/util/roomEditUtil";
import { ClientEventType } from "../../../../system/types/clientEventType";
import EncodableData from "../../../../../shared/networking/types/encodableData";
import VoxelUpdateUtil from "../../../../../shared/voxel/util/voxelUpdateUtil";
import RemoveVoxelBlockSignal from "../../../../../shared/voxel/types/update/removeVoxelBlockSignal";
import DoorObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, DIR_VEC_BY_NAME, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3, VOXEL_CELL_SIZE } from "../../../../../shared/system/sharedConstants";
import QuarterTurnsUtil from "../../../../../shared/object/util/quarterTurnsUtil";
import PointerCoordUtil from "../../../../graphics/util/pointerCoordUtil";
import AddVoxelBlockSignal from "../../../../../shared/voxel/types/update/addVoxelBlockSignal";
import ObjectIdUtil from "../../../../../shared/object/util/objectIdUtil";
import { clientFeatureFlagsObservable, notificationMessageObservable, objectInstalledObservable,
    voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import { DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION,
    SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
import Room from "../../../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import PopupUtil from "../../../util/popupUtil";
import ClosablePanelUtil from "../../../util/closablePanelUtil";
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
const npcTypeIndex = ObjectTypeConfigMap.getIndexByType("Npc");
const volumeTypeIndex = ObjectTypeConfigMap.getIndexByType("Volume");

// What a new label says, so it shows (and can be clicked) before anything is written on it.
const NEW_LABEL_TEXT = "Label";

// What a new NPC is called until it is named.
const NEW_NPC_NAME = "NPC";

// Feature flags whose toggling changes whether this menu's buttons are enabled.
const placementFeatureFlags = [
    FeatureFlag.DisableManualVoxelBlockAddition,
    FeatureFlag.DisableManualVoxelBlockRemoval,
    FeatureFlag.DisableManualObjectAddition,
];

// Face tools: remove or add a block, or add an object. An object's look is picked first, from a chooser its add button
// raises in the place of the face's other tools (its children), and the pick adds it. The chooser shows beneath this
// row, its add button a toggle, or in the place of this row too until it is closed (see
// SUB_PANELS_BENEATH_SELECTION_TOOLS).
export default function VoxelQuadPlacementOptions(props: {selection: VoxelQuadSelection, children?: ReactNode})
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);
    // The type whose chooser is open, and the selection it was raised on: the next face selected has none open.
    const [chooser, setChooser] = useState<{typeIndex: number, selection: VoxelQuadSelection} | null>(null);
    // Whether a pick from a chooser beneath this row is still going up.
    const addingRef = useRef(false);

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

    // NPCs (an admin's) and volumes (an admin's or the superuser's, who draws the room's zones with them) are
    // added as they are, with nothing to pick first.
    const isAdmin = RoomValidationUtil.userIsAdmin(App.getUser());
    const canAddNpc = isAdmin &&
        getPlaceableAttachedObjectTransform(props.selection, npcTypeIndex) !== null;
    const managesVolumes = isAdmin || isSuperuser;
    const canAddVolume = managesVolumes && getPlaceableVolumeTransform(props.selection) !== null;

    // A chooser shows only while its type can be added to the selected face.
    const canAdd = new Map([[canvasTypeIndex, canAddCanvas], [propTypeIndex, canAddProp], [lampTypeIndex, canAddLamp],
        [labelTypeIndex, canAddLabel], [doorTypeIndex, canAddDoor]]);
    const choosing = (chooser != null && chooser.selection == props.selection && canAdd.get(chooser.typeIndex))
        ? chooser.typeIndex : null;
    const close = () => setChooser(null);
    const onClose = SUB_PANELS_BENEATH_SELECTION_TOOLS ? undefined : close;
    const addButton = (id: string, icon: ReactNode, objectTypeIndex: number) => <IconButton id={id} icon={icon}
        size="md" disabled={!canAdd.get(objectTypeIndex)} highlight={choosing == objectTypeIndex}
        onClick={() => setChooser(objectTypeIndex == choosing ? null
            : {typeIndex: objectTypeIndex, selection: props.selection})}/>;

    // The back gesture puts away a chooser beneath this row, as its add button does (see ClosablePanelUtil): not as a
    // panel over the tools, which this row stays on screen as. One in the row's place sees to that itself (see
    // ScrollPanel).
    useEffect(() => {
        if (!SUB_PANELS_BENEATH_SELECTION_TOOLS || choosing == null)
            return;
        const token = ClosablePanelUtil.register(() => setChooser(null), false);
        return () => ClosablePanelUtil.unregister(token);
    }, [choosing]);

    // A pick closes a chooser in this row's place at once, so a second click can't add another while the first goes
    // up. One beneath the row stays up as it is meanwhile, taking no other pick; once the object is up it is put away,
    // where this menu outlives it (see addObject).
    const add = async (tryAdd: () => Promise<void>) => {
        if (!SUB_PANELS_BENEATH_SELECTION_TOOLS)
        {
            close();
            tryAdd();
            return;
        }
        if (addingRef.current)
            return;
        addingRef.current = true;
        try {
            await tryAdd();
        } finally {
            addingRef.current = false;
            close();
        }
    };

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {(SUB_PANELS_BENEATH_SELECTION_TOOLS || choosing == null) && <SelectionToolRow>
            <IconButton id="removeVoxelBlockButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
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
            {isAdmin && <IconButton id="addNpcButton" icon={<AddNpcIcon/>} size="md"
                disabled={!canAddNpc} onClick={() => tryAddNpcFromQuad(props.selection)}/>}
            {managesVolumes && <IconButton id="addVolumeButton" icon={<AddVolumeIcon/>} size="md"
                disabled={!canAddVolume} onClick={() => tryAddVolumeFromQuad(props.selection)}/>}
        </SelectionToolRow>}
        {choosing == canvasTypeIndex && <ImageMapThumbnailPanel
            id="canvasImageOptions"
            searchInputId="canvasImageSearchInput"
            searchPlaceholder="Search by title or author"
            mapName="PictureImageMap"
            subfolder={CANVAS_IMAGE_SUBFOLDER}
            onChoose={path => add(() => tryAddCanvasFromQuad(props.selection, path))}
            onClose={onClose}
        />}
        {choosing == propTypeIndex && <ImageMapThumbnailPanel
            id="propImageOptions"
            searchInputId="propImageSearchInput"
            searchPlaceholder="Search"
            mapName="PictureImageMap"
            subfolder={PROP_IMAGE_SUBFOLDER}
            canChoose={propImageFits}
            onChoose={path => add(() => tryAddPropFromQuad(props.selection, path))}
            onClose={onClose}
        />}
        {choosing == lampTypeIndex && <CompositionThumbnailPanel
            id="lampSizeOptions"
            objectType={LampObjectTypeConfig.objectType}
            canChoose={lampSizeFits}
            onChoose={compositionIndex => add(() => tryAddLampFromQuad(props.selection, compositionIndex))}
            onClose={onClose}
        />}
        {choosing == labelTypeIndex && <CompositionThumbnailPanel
            id="customizeLabelOptions"
            objectType={LabelObjectTypeConfig.objectType}
            onChoose={compositionIndex => add(() => tryAddLabelFromQuad(props.selection, compositionIndex))}
            onClose={onClose}
        />}
        {choosing == doorTypeIndex && <CompositionThumbnailPanel
            id="customizeDoorOptions"
            objectType={DoorObjectTypeConfig.objectType}
            onChoose={compositionIndex => add(() => tryAddDoorFromQuad(props.selection, compositionIndex))}
            onClose={onClose}
        />}
        {choosing == null && props.children}
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
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } = selection.getTransformDimensions();
    return {
        center: {x: VoxelQueryUtil.getWorldXAtVoxelColCenter(voxel.col) + offsetX, y: offsetY,
            z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(voxel.row) + offsetZ},
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

// Standing on the clicked floor, turned to face the user, and left selected to be named and dressed.
async function tryAddNpcFromQuad(selection: VoxelQuadSelection)
{
    const metadata = {
        [ObjectMetadataKeyEnumMap.Label]: new EncodableByteString(NEW_NPC_NAME),
        // (Its content's top is the way it faces, which runs away from the user when upright on screen.)
        [ObjectMetadataKeyEnumMap.QuarterTurns]: new EncodableByteString(
            QuarterTurnsUtil.encode(getUprightQuarterTurns(selection) + 2)),
    };
    const tr = getPlaceableAttachedObjectTransform(selection, npcTypeIndex, undefined, metadata);
    if (tr != null)
        await addObject(npcTypeIndex, tr, metadata, true);
}

// The one cell the clicked face looks into, and left selected to be resized and named.
async function tryAddVolumeFromQuad(selection: VoxelQuadSelection)
{
    const tr = getPlaceableVolumeTransform(selection);
    if (tr != null)
        await addObject(volumeTypeIndex, tr, {}, true);
}

function getPlaceableVolumeTransform(selection: VoxelQuadSelection): ObjectTransform | null
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectAddition))
        return null;

    const room = App.getCurrentRoom();
    if (!room)
        return null;
    const user = App.getUser();

    const {center, dir} = getClickedFace(selection);
    const reach = 0.5 * VOXEL_CELL_SIZE;
    const middle = {x: center.x + reach * dir.x, y: center.y + reach * dir.y, z: center.z + reach * dir.z};
    const tr = VolumeObjectTypeConfig.util.makeTransform(
        {x: middle.x - reach, y: middle.y - reach, z: middle.z - reach},
        {x: middle.x + reach, y: middle.y + reach, z: middle.z + reach});
    return ObjectUpdateUtil.canAddObject(user, room, new AddObjectSignal(room.id, user.id, user.userName,
        volumeTypeIndex, ObjectIdUtil.generateRandomObjectId(), tr)) ? tr : null;
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

// The picture map's images a canvas (paintings) or a prop (everyday objects) may be added with, as its chooser
// offers them.
function getImages(subfolder: string): ImageMetadata[]
{
    return ImageChoiceUtil.getOffered(ImageMapUtil.getImageMap("PictureImageMap"), subfolder, !App.isPublicSite());
}

// selectIt: leaves the new object selected whatever its type's panels, for one that is finished by hand.
async function addObject(objectTypeIndex: number, tr: ObjectTransform, metadata: ObjectMetadata,
    selectIt: boolean = false)
{
    try {
        const room = App.getCurrentRoom()!;
        const user = App.getUser();
        const objectId = ObjectIdUtil.generateRandomObjectId();
        const signal = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex, objectId, tr, metadata);
        const selectionBefore = voxelQuadSelectionObservable.peek();

        // Add the game object locally, and report it to the server if successful.
        const gameObject = ObjectFactory.createServerSideObject(signal);
        const success = await ClientObjectManager.addObject(gameObject);
        if (success)
        {
            if (room.roomType != RoomTypeEnumMap.SinglePlayer)
                SocketsClient.emitAddObjectSignal(signal);
            VoxelQuadSelection.unselect();
            // Complete as added, it leaves the selection on a face near it, to add the next from. With more to pick
            // (only where its panel takes the tools' place), or with no face to take the selection, it is selected
            // instead.
            const installPanel = SUB_PANELS_BENEATH_SELECTION_TOOLS ? undefined
                : ObjectTypeClientConfigMap.getConfigByIndex(objectTypeIndex).selection?.installPanel;
            const leftOnFace = !selectIt && !installPanel && !DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION
                && VoxelQuadSelection.trySelectBestQuadNearby(gameObject.params.transform.pos);
            if (!leftOnFace && ObjectSelection.trySelect(gameObject))
                objectInstalledObservable.set(objectId);
            RoomEditUtil.record(ClientEventType.ManuallyAddedObject, room,
                {redo: [signal], undo: [RoomEditUtil.getUndoSignal(room, signal)], selectionBefore});
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

    // The block goes into the cell layer the face looks into.
    const targetQuadIndex = VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(selection.quadIndex);
    return targetQuadIndex >= 0 && VoxelUpdateUtil.canAddVoxelBlock(App.getUser(), room, targetQuadIndex);
}

function tryAddVoxelBlock(selection: VoxelQuadSelection)
{
    if (!canAddVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const targetQuadIndex = VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(selection.quadIndex);

    // A new block takes the textures of the one it is built from.
    const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(selection.voxel.row, selection.voxel.col,
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(selection.quadIndex));
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        quadTextureIndicesWithinLayer[i - startIndex] = App.getVoxelQuads()[i] & 0b01111111;

    const signal = new AddVoxelBlockSignal(room.id, targetQuadIndex, quadTextureIndicesWithinLayer);
    const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
    if (!ClientVoxelManager.addVoxelBlock(room, targetQuadIndex, quadTextureIndicesWithinLayer))
        return;
    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitAddVoxelBlockSignal(signal);

    // The same face of the new block, or the nearest one that shows if it is covered.
    VoxelQuadSelection.unselect();
    const targetVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels,
        VoxelQueryUtil.getVoxelRowFromQuadIndex(targetQuadIndex), VoxelQueryUtil.getVoxelColFromQuadIndex(targetQuadIndex));
    if (targetVoxel)
        VoxelQuadSelection.trySelectBestQuad(targetVoxel, targetQuadIndex);

    RoomEditUtil.record(ClientEventType.ManuallyAddedVoxelBlock, room,
        {redo: [signal], undo: [undoSignal], selectionBefore: selection});
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

    const isMultiPlayer = room.roomType != RoomTypeEnumMap.SinglePlayer;
    // The removals made, and what puts each back: the block first, for what hung on it to have its footing again.
    const removals: EncodableData[] = [];
    const restorals: EncodableData[] = [];

    // Attachments first; the server processes signals in order and reaches the same result.
    for (const objectId of ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
    {
        // (One may have left the room while another was being removed.)
        if (room.objectById[objectId] == undefined)
            continue;
        const signal = new RemoveObjectSignal(room.id, objectId);
        const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
        if (!await ClientObjectManager.removeObject(objectId))
            continue;
        if (isMultiPlayer)
            SocketsClient.emitRemoveObjectSignal(signal);
        removals.push(signal);
        restorals.unshift(undoSignal);
    }

    const signal = new RemoveVoxelBlockSignal(room.id, quadIndex);
    const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
    const blockRemoved = ClientVoxelManager.removeVoxelBlock(room, quadIndex);
    if (blockRemoved)
    {
        removals.push(signal);
        restorals.unshift(undoSignal);
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

        if (isMultiPlayer)
            SocketsClient.emitRemoveVoxelBlockSignal(signal);
    }

    if (removals.length > 0)
    {
        RoomEditUtil.record(blockRemoved ? ClientEventType.ManuallyRemovedVoxelBlock : ClientEventType.ManuallyRemovedObject,
            room, {redo: removals, undo: restorals, selectionBefore: selection});
    }
}