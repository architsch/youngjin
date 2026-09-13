import ImageMapUtil from "../../../graphics/image/util/imageMapUtil";
import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import AddObjectSignal from "../../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../types/objectMetadataKey";
import ObjectTypeConfig from "./objectTypeConfig";
import SetObjectMetadataSignal from "../../types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../types/setObjectTransformSignal";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import { WALL_ATTACHMENT_HITBOX_INSET } from "../../../system/sharedConstants";

// A canvas is drawn as a single flat quad hanging on the wall.
export const CANVAS_GEOMETRY_ID = "Square";

// Picture frame atlas of square cells, addressed by "{col},{row}".
export const CANVAS_FRAME_ATLAS_PATH = "object_texture_packs/canvas_frames.webp"; // relative to the app's assets_url
export const CANVAS_FRAME_ATLAS_SIZE = 1024; // in pixels (the atlas is square)
export const CANVAS_FRAME_ATLAS_CELL_SIZE = 256; // in pixels (each cell is square)

// Shared render target for all canvases in a room, one cell each. The cell size is also the thumbnail
// size canvas images are fetched at.
export const CANVAS_TEXTURE_SIZE = 2048; // in pixels (the texture is square)
export const CANVAS_TEXTURE_CELL_SIZE = 256; // in pixels (each cell is square)

// One voxel of wall. This is the collider; the tested box is slightly inset (see PhysicsColliderStateUtil).
const CANVAS_FOOTPRINT_WIDTH = 1;
const CANVAS_FOOTPRINT_HEIGHT = 1;

// Room-wide cap: one render target cell per canvas (8x8 grid).
const MAX_CANVASES_PER_ROOM = 64;

// This object represents a canvas (image) that can be exhibited in the room (like a painting in an art gallery).
const CanvasObjectTypeConfig =
{
    objectType: "Canvas",
    persistent: true,
    autoUnload: true,
    maxCountPerRoom: MAX_CANVASES_PER_ROOM,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // Block users from adding too many canvases
        const typeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
        const canvasCount = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === typeIndex).length;
        if (canvasCount >= MAX_CANVASES_PER_ROOM)
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
        // User can only set the canvas's image path or picture-frame coords, and nothing else
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.ImagePath)
            return ImageMapUtil.getImageMap("CanvasImageMap").hasImagePath(signal.metadataValue);
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.CanvasFrameCoords)
            return ImageMapUtil.getImageMap("CanvasFrameImageMap").hasImagePath(signal.metadataValue);

        return false;
    },
    components: {
        spawnedByAny: {
            collider: {
                colliderType: "wallAttachment",
                hitboxSize: {
                    sizeX: CANVAS_FOOTPRINT_WIDTH,
                    sizeY: CANVAS_FOOTPRINT_HEIGHT,
                    sizeZ: 0.5 * WALL_ATTACHMENT_HITBOX_INSET
                },
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {},
            orbitOccluder: {}, // A picture hanging on a wall stands in the orbit camera's way like the wall itself does.
        },
    },
} satisfies ObjectTypeConfig;

export default CanvasObjectTypeConfig;