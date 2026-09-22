import ImageMapUtil from "../../../graphics/image/util/imageMapUtil";
import { CanvasCompositionCodec } from "../../../graphics/mesh/composition/types/compositionCodec/canvasCompositionCodec";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import StringUtil from "../../../math/util/stringUtil";
import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import AddObjectSignal from "../../types/addObjectSignal";
import { ObjectCategoryEnumMap } from "../../types/objectCategory";
import { ObjectMetadataKeyEnumMap } from "../../types/objectMetadataKey";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import SetObjectMetadataSignal from "../../types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../types/setObjectTransformSignal";
import { WALL_ATTACHMENT_HITBOX_INSET } from "../../../system/sharedConstants";

// Shared render target for all canvases in a room, one cell each. The cell size is also the thumbnail
// size canvas images are fetched at.
export const CANVAS_TEXTURE_SIZE = 2048; // in pixels (the texture is square)
export const CANVAS_TEXTURE_CELL_SIZE = 256; // in pixels (each cell is square)

// Metadata keys a user may write to a canvas; anything else is refused.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.ImagePath,
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
];

// This object represents a canvas (image) that can be exhibited in the room (like a painting in an art gallery).
const CanvasObjectTypeConfig =
{
    objectType: "Canvas",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Canvas,
    // Resized in half-voxel steps along the wall. Depth is the wall gap and never changes.
    scaling: {
        scaleStep: {x: 0.5, y: 0.5, z: 0},
        minScale: {x: 1, y: 1, z: 1},
        maxScale: {x: 3.5, y: 3.5, z: 1},
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return true;
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        // Canvas movement must ignore physics
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!editableMetadataKeys.includes(signal.metadataKey))
            return false;

        // The image must be one on offer; a composition is sanitized by ObjectMetadataEntryMap and decodes
        // to a drawable canvas whatever it holds (see CanvasCompositionCodec).
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.ImagePath)
            return ImageMapUtil.getImageMap("CanvasImageMap").hasImagePath(signal.metadataValue);

        return true;
    },
    components: {
        spawnedByAny: {
            collider: {
                colliderType: "wallAttachment",
                baseHitboxSize: {
                    sizeX: 1,
                    sizeY: 1,
                    sizeZ: 0.5 * WALL_ATTACHMENT_HITBOX_INSET
                },
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Canvas,
                codecVersion: 0,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    // Seeded from room and canvas id, so every client and session sees the same frame.
                    const hashCode = StringUtil.getHashCode(`${obj.roomID}/${obj.objectId}`);
                    return CanvasCompositionCodec.getRandomComposition(hashCode,
                        ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale));
                },
            },
            orbitOccluder: {}, // A picture hanging on a wall stands in the orbit camera's way like the wall itself does.
        },
    },
} satisfies ObjectTypeConfig;

export default CanvasObjectTypeConfig;
