import ImageMapUtil from "../../../graphics/image/util/imageMapUtil";
import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import AddObjectSignal from "../../types/addObjectSignal";
import { ObjectCategoryEnumMap } from "../../types/objectCategory";
import { ObjectMetadataKeyEnumMap } from "../../types/objectMetadataKey";
import ObjectTypeConfig from "./objectTypeConfig";
import SetObjectMetadataSignal from "../../types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../types/setObjectTransformSignal";
import { ALL_FACE_DIRECTIONS, ATTACHMENT_HITBOX_INSET, PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_WORLD_SIZE,
    PICTURE_ATLAS_MAX_REGION_CELLS } from "../../../system/sharedConstants";
import { ObjectMetadata } from "../../types/objectMetadata";
import Vec3 from "../../../math/types/vec3";
import QuarterTurnsUtil from "../../util/quarterTurnsUtil";

// The picture map's subfolder of everyday objects, the only images a prop shows.
export const PROP_IMAGE_SUBFOLDER = "2";

// The largest image that keeps its scale, in world units.
const MAX_SIZE = PICTURE_ATLAS_MAX_REGION_CELLS * PICTURE_ATLAS_CELL_WORLD_SIZE;

// Metadata keys a user may write to a prop; anything else is refused.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.ImagePath,
    ObjectMetadataKeyEnumMap.QuarterTurns,
];

// This object represents the face of an everyday object on any face of the room, at its real size (a
// microwave's door, a shelf of books, a pizza on a table), usually on blocks built into the rest of it. Only its
// image, without a frame; clicked in play mode, it may do what the object does (see PlayModeClickCallbackMap).
const PropObjectTypeConfig =
{
    objectType: "Prop",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Picture,
    // Its image's own size, which pins it (a prop without one may be resized, in half-voxel steps). Depth is the
    // gap from the face and never changes.
    scaling: {
        scaleStep: {x: 0.5, y: 0.5, z: 0},
        minScale: {x: 0.5, y: 0.5, z: 1},
        maxScale: {x: MAX_SIZE, y: MAX_SIZE, z: 1},
        getDefaultScale: () => ({x: 1, y: 1, z: 1}),
        getFixedScale: (metadata: ObjectMetadata): Vec3 | undefined => getImageScale(
            metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str ?? "", QuarterTurnsUtil.getQuarterTurns({metadata})),
    },
    attachment: {
        allowedDirections: ALL_FACE_DIRECTIONS,
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // An image it comes with must be one on offer to a prop, as when it is set later.
        const imagePath = obj.metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str;
        return imagePath == undefined || isPropImage(imagePath);
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return true;
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        // Prop movement must ignore physics
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!editableMetadataKeys.includes(signal.metadataKey))
            return false;

        // The image must be an everyday object on offer.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.ImagePath)
            return isPropImage(signal.metadataValue);

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
            orbitOccluder: {}, // Part of the face it is on, as far as the orbit camera is concerned.
        },
    },
    util: {
        getImageScale,
    },
} satisfies ObjectTypeConfig;

// The scale a prop showing the image must have: its cells in world units, swapped on an odd turn. Undefined for an
// image fitted to whatever shows it, or a path that isn't one of a prop's.
function getImageScale(imagePath: string, quarterTurns: number): Vec3 | undefined
{
    if (!isPropImage(imagePath))
        return undefined;
    const image = ImageMapUtil.getImageMap("PictureImageMap").getImageMetadataByPath(imagePath);
    if (!image.preserveScale || !image.width || !image.height)
        return undefined;

    const width = image.width / PICTURE_ATLAS_CELL_SIZE * PICTURE_ATLAS_CELL_WORLD_SIZE;
    const height = image.height / PICTURE_ATLAS_CELL_SIZE * PICTURE_ATLAS_CELL_WORLD_SIZE;
    return (quarterTurns % 2 == 0) ? {x: width, y: height, z: 1} : {x: height, y: width, z: 1};
}

function isPropImage(imagePath: string): boolean
{
    return ImageMapUtil.getImageMap("PictureImageMap").hasImagePathInSubfolder(imagePath, PROP_IMAGE_SUBFOLDER);
}

export default PropObjectTypeConfig;
