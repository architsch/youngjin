import ImageMapUtil from "../../../graphics/image/util/imageMapUtil";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import CompositionMetadataUtil from "../../../graphics/mesh/composition/util/compositionMetadataUtil";
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
import { ATTACHMENT_HITBOX_INSET, WALL_DIRECTIONS } from "../../../system/sharedConstants";

// Shared render target for all canvases in a room, one cell each. The cell size is also the thumbnail
// size canvas images are fetched at.
export const CANVAS_TEXTURE_SIZE = 2048; // in pixels (the texture is square)
export const CANVAS_TEXTURE_CELL_SIZE = 256; // in pixels (each cell is square)

const COMPOSITION_CODEC_VERSION = 0;

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
        defaultScale: {x: 1, y: 1, z: 1},
    },
    attachment: {
        allowedDirections: WALL_DIRECTIONS,
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

        // The image must be one on offer, and the frame one of a canvas's own looks.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.ImagePath)
            return ImageMapUtil.getImageMap("CanvasImageMap").hasImagePath(signal.metadataValue);
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.InstancedMeshComposition)
        {
            return CompositionMetadataUtil.isIndexedLookOf("Canvas", COMPOSITION_CODEC_VERSION,
                signal.metadataValue);
        }

        return true;
    },
    components: {
        spawnedByAny: {
            collider: {
                baseHitboxSize: {
                    sizeX: 1,
                    sizeY: 1,
                    sizeZ: 0.5 * ATTACHMENT_HITBOX_INSET
                },
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {},
            // One of its pre-encoded looks, the first of which is frameless (see pre_encoding_source.json).
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Indexed,
                codecVersion: COMPOSITION_CODEC_VERSION,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    // Seeded from room and canvas id, so every client and session sees the same frame. Never
                    // the frameless look: a canvas nobody has dressed still gets a frame.
                    const hashCode = StringUtil.getHashCode(`${obj.roomID}/${obj.objectId}`);
                    return CompositionMetadataUtil.decodeSeededIndexed("Canvas", 1, hashCode,
                        COMPOSITION_CODEC_VERSION, ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale));
                },
                // Straight on, as it hangs.
                thumbnailView: {yawDeg: 0, pitchDeg: 0},
            },
            orbitOccluder: {}, // A picture hanging on a wall stands in the orbit camera's way like the wall itself does.
        },
    },
} satisfies ObjectTypeConfig;

export default CanvasObjectTypeConfig;
