import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import VolumeObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import ObjectFactory from "../factories/objectFactory";
import ObjectTypeClientConfigMap from "../maps/objectTypeClientConfigMap";
import ClientObjectManager from "../clientObjectManager";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectAttachmentUtil from "../../../shared/object/util/objectAttachmentUtil";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import Vec3 from "../../../shared/math/types/vec3";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import RoomEditUtil from "../../system/util/roomEditUtil";
import { ClientEventType } from "../../system/types/clientEventType";
import DoorObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { DIR_VEC_BY_NAME, UNIT_VEC3, VOXEL_CELL_SIZE } from "../../../shared/system/sharedConstants";
import QuarterTurnsUtil from "../../../shared/object/util/quarterTurnsUtil";
import PointerCoordUtil from "../../graphics/util/pointerCoordUtil";
import ObjectIdUtil from "../../../shared/object/util/objectIdUtil";
import { clientFeatureFlagsObservable, objectInstalledObservable,
    voxelQuadSelectionObservable } from "../../system/clientObservables";
import { DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION,
    SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../system/clientConstants";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";
import { DoorTypeEnumMap } from "../../../shared/object/types/doorType";
import LampObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import FanObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import LabelObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import CanvasObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import PropObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/propObjectTypeConfig";
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";
import CompositionMetadataUtil from "../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const propTypeIndex = ObjectTypeConfigMap.getIndexByType("Prop");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
const labelTypeIndex = ObjectTypeConfigMap.getIndexByType("Label");
const npcTypeIndex = ObjectTypeConfigMap.getIndexByType("Npc");
const volumeTypeIndex = ObjectTypeConfigMap.getIndexByType("Volume");
const fanTypeIndex = ObjectTypeConfigMap.getIndexByType("Fan");

// What a new label says, so it shows (and can be clicked) before anything is written on it.
const NEW_LABEL_TEXT = "Label";

// What a new NPC is called until it is named.
const NEW_NPC_NAME = "NPC";

// Adding an object to the face the user has selected (see VoxelQuadPlacementOptions). Each is checked as the server
// will check it (see ObjectUpdateUtil), added locally, then sent (a single-player room has no server to send it to),
// and entered in the history for an undo to take back (see RoomEditUtil).
const ObjectPlacementUtil =
{
    // Whether one of a type attached to faces can be added to the clicked one: at the scale a new one takes there,
    // unless given one.
    canAddObject: (selection: VoxelQuadSelection, objectTypeIndex: number, scale?: Vec3): boolean =>
    {
        return getPlaceableAttachedObjectTransform(selection, objectTypeIndex, scale) !== null;
    },
    canAddVolume: (selection: VoxelQuadSelection): boolean =>
    {
        return getPlaceableVolumeTransform(selection) !== null;
    },
    // Whether a prop showing an image fits near the click, at the size the image pins it to: asked once per size, as
    // images share a handful of them.
    getPropImageFits: (selection: VoxelQuadSelection): (imagePath: string) => boolean =>
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
    },
    // Frameless until its frame is picked, at the size a new canvas takes where it goes (see
    // CanvasObjectTypeConfig) and upright as the user sees it (on a floor or ceiling too).
    tryAddCanvas: async (selection: VoxelQuadSelection, imagePath: string): Promise<void> =>
    {
        await tryAddObject(selection, canvasTypeIndex, {
            [ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(imagePath),
            [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: new EncodableByteString(
                CanvasObjectTypeConfig.util.getFramelessLook()),
            [ObjectMetadataKeyEnumMap.QuarterTurns]: new EncodableByteString(
                QuarterTurnsUtil.encode(getUprightQuarterTurns(selection))),
        });
    },
    // An everyday object at its image's own size, upright as the user sees it (on a floor or ceiling too).
    tryAddProp: async (selection: VoxelQuadSelection, imagePath: string): Promise<void> =>
    {
        const quarterTurns = getUprightQuarterTurns(selection);
        await tryAddObject(selection, propTypeIndex, getPropMetadata(imagePath, quarterTurns),
            PropObjectTypeConfig.util.getImageScale(imagePath, quarterTurns));
    },
    // At the size of the look picked, with default light settings (see LampObjectTypeConfig).
    tryAddLamp: async (selection: VoxelQuadSelection, compositionIndex: number): Promise<void> =>
    {
        await tryAddObject(selection, lampTypeIndex, {
            [ObjectMetadataKeyEnumMap.LightProperties]:
                new EncodableByteString(LampObjectTypeConfig.util.getDefaultLightProperties()),
        }, LampObjectTypeConfig.util.getScale(compositionIndex));
    },
    // With the default wind and color (see FanObjectTypeConfig).
    tryAddFan: async (selection: VoxelQuadSelection): Promise<void> =>
    {
        await tryAddObject(selection, fanTypeIndex, {
            [ObjectMetadataKeyEnumMap.ForceProperties]:
                new EncodableByteString(FanObjectTypeConfig.util.getDefaultForceProperties()),
            [ObjectMetadataKeyEnumMap.FanColor]:
                new EncodableByteString(FanObjectTypeConfig.util.getDefaultColor()),
        });
    },
    tryAddLabel: async (selection: VoxelQuadSelection, compositionIndex: number): Promise<void> =>
    {
        const look = CompositionMetadataUtil.encodeIndexed(compositionIndex,
            LabelObjectTypeConfig.components.spawnedByAny.instancedMeshComposer.codecVersion);
        await tryAddObject(selection, labelTypeIndex, {
            [ObjectMetadataKeyEnumMap.Label]: new EncodableByteString(NEW_LABEL_TEXT),
            [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: new EncodableByteString(look),
        });
    },
    // New doors lead nowhere and aren't default entrances until configured.
    tryAddDoor: async (selection: VoxelQuadSelection, compositionIndex: number): Promise<void> =>
    {
        const look = CompositionMetadataUtil.encodeIndexed(compositionIndex,
            DoorObjectTypeConfig.components.spawnedByAny.instancedMeshComposer.codecVersion);
        await tryAddObject(selection, doorTypeIndex, {
            [ObjectMetadataKeyEnumMap.DoorType]: new EncodableByteString(`${DoorTypeEnumMap.CustomEntrance}`),
            [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: new EncodableByteString(look),
        });
    },
    // Standing on the clicked floor, turned to face the user, and left selected to be named and dressed.
    tryAddNpc: async (selection: VoxelQuadSelection): Promise<void> =>
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
    },
    // The one cell the clicked face looks into, and left selected to be resized and named.
    tryAddVolume: async (selection: VoxelQuadSelection): Promise<void> =>
    {
        const tr = getPlaceableVolumeTransform(selection);
        if (tr != null)
            await addObject(volumeTypeIndex, tr, {}, true);
    },
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
        const doorY = DoorObjectTypeConfig.util.getOriginYOnWall(selection.quadIndex);
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

async function tryAddObject(selection: VoxelQuadSelection, objectTypeIndex: number,
    metadata: ObjectMetadata, scale?: Vec3)
{
    const tr = getPlaceableAttachedObjectTransform(selection, objectTypeIndex, scale, metadata);
    if (tr != null)
        await addObject(objectTypeIndex, tr, metadata);
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

export default ObjectPlacementUtil;
