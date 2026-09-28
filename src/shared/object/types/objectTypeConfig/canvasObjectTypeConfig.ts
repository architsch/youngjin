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
import { ALL_FACE_DIRECTIONS, ATTACHMENT_HITBOX_INSET } from "../../../system/sharedConstants";
import PreEncodedCompositionIndexMap from "../../../graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import RandomNumberGenerator from "../../../math/types/randomNumberGenerator";
import Vec3 from "../../../math/types/vec3";

// The picture map's subfolder of paintings, the only images a canvas shows.
export const CANVAS_IMAGE_SUBFOLDER = "1";

const COMPOSITION_CODEC_VERSION = 0;

// The sizes a new canvas tries, in order: a whole block, then one layer tall (all the side of a lone block holds).
const START_SCALES: Vec3[] = [{x: 1, y: 1, z: 1}, {x: 1, y: 0.5, z: 1}];

// Metadata keys a user may write to a canvas; anything else is refused.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.ImagePath,
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
    ObjectMetadataKeyEnumMap.QuarterTurns,
];

// This object represents a painting on any face of the room, fitted to whatever size the canvas is, in a frame
// or not. An everyday object's face is a prop instead (see PropObjectTypeConfig).
const CanvasObjectTypeConfig =
{
    objectType: "Canvas",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Picture,
    // Resized in half-voxel steps across its face. Depth is the gap from the face and never changes.
    scaling: {
        scaleStep: {x: 0.5, y: 0.5, z: 0},
        minScale: {x: 0.5, y: 0.5, z: 1},
        maxScale: {x: 3.5, y: 3.5, z: 1},
        getDefaultScale: (fits: (scale: Vec3) => boolean): Vec3 => START_SCALES.find(fits) ?? START_SCALES[0],
    },
    attachment: {
        allowedDirections: ALL_FACE_DIRECTIONS,
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // An image it comes with must be one on offer to a canvas, as when it is set later.
        const imagePath = obj.metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str;
        return imagePath == undefined || isCanvasImage(imagePath);
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

        // The image must be a painting on offer, and the frame one of a canvas's own looks.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.ImagePath)
            return isCanvasImage(signal.metadataValue);
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
            orbitOccluder: {}, // Part of the face it is on, as far as the orbit camera is concerned.
        },
    },
    util: {
        // Any look after the first (which has no frame; see pre_encoding_source.json): what a canvas added by
        // hand wears.
        getRandomFramedLook: (random: RandomNumberGenerator): string =>
        {
            const looks = PreEncodedCompositionIndexMap.Canvas ?? [];
            return CompositionMetadataUtil.encodeIndexed(looks[random.randomInt(1, looks.length)] ?? 0,
                COMPOSITION_CODEC_VERSION);
        },
    },
} satisfies ObjectTypeConfig;

function isCanvasImage(imagePath: string): boolean
{
    return ImageMapUtil.getImageMap("PictureImageMap").hasImagePathInSubfolder(imagePath, CANVAS_IMAGE_SUBFOLDER);
}

export default CanvasObjectTypeConfig;
