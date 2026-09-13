import ImageMapUtil from "../../../graphics/image/util/imageMapUtil";
import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import AddObjectSignal from "../../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../types/objectMetadataKey";
import ObjectTypeConfig from "./objectTypeConfig";
import SetObjectMetadataSignal from "../../types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../types/setObjectTransformSignal";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { WALL_ATTACHMENT_HITBOX_INSET } from "../../../system/sharedConstants";

// A canvas is drawn as a single flat quad hanging on the wall.
export const CANVAS_GEOMETRY_ID = "Square";

// The picture frames a canvas can be mounted in, kept as one atlas: a square image of square cells,
// one frame to a cell, addressed by the "{col},{row}" coords a canvas stores.
export const CANVAS_FRAME_ATLAS_PATH = "object_texture_packs/canvas_frames.webp"; // relative to the app's assets_url
export const CANVAS_FRAME_ATLAS_SIZE = 1024; // in pixels (the atlas is square)
export const CANVAS_FRAME_ATLAS_CELL_SIZE = 256; // in pixels (each cell is square)

// The texture every canvas in a room is drawn into, a cell each: a square grid of square cells. A cell
// is the most pixels a canvas's picture is ever given, however close it is looked at, so it is also
// the size a canvas's image is fetched at (see CanvasImageMap's thumbnails).
export const CANVAS_TEXTURE_SIZE = 2048; // in pixels (the texture is square)
export const CANVAS_TEXTURE_CELL_SIZE = 256; // in pixels (each cell is square)

// How much wall a canvas lays claim to, and therefore how much of it is drawn: one whole voxel of
// wall, which is the cell a picture hangs in. This is the canvas's collider, which is where
// everything outside this file reads its footprint from — the box it is actually tested against is
// a hair inside this (see PhysicsColliderStateUtil).
const CANVAS_FOOTPRINT_WIDTH = 1;
const CANVAS_FOOTPRINT_HEIGHT = 1;

// Every canvas in the room is drawn into one cell of one render target, which is an 8x8 grid — so
// this is a room-wide budget rather than a per-object one, and it is what the grid was cut into.
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