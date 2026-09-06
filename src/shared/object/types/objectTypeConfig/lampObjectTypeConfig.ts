import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import ColorUtil from "../../../math/util/colorUtil";
import MeshDataUtil from "../../../graphics/mesh/util/meshDataUtil";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { BACKWARD_DIR, INSTANCED_EMISSIVE_MATERIAL_ID, LAMP_FOOTPRINT_HEIGHT,
    LAMP_FOOTPRINT_WIDTH, LAMP_GEOMETRY_ID, LIGHT_COLOR_PALETTE_NAME, MAX_LAMPS_PER_ROOM,
    MAX_MESH_INSTANCES_PER_LAMP } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import LampObjectUtil from "../../util/lampObjectUtil";

// How far the lit face stands off the wall behind it. Enough to keep it clear of the wall's own
// surface, and no more — what is drawn is the face of a fitting mounted flush, not a panel floating
// in front of one.
const EMITTER_RELIEF = 0.01;

// The metadata a lamp answers to, which is only the light it gives off. Notably *not* its
// composition: what a lamp looks like is derived from its light rather than authored beside it (see
// generateDefaultParts below), so there is nothing about its appearance left to store, and a stored
// composition could only ever be one that disagreed with the light.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.LightProperties,
];

// A lamp is a light somebody installed on a wall — the only thing in the game that lights a room
// other than the light every visitor carries (see @docs/graphics/lighting.md). It is admin-only for
// now, being a placeholder: what it looks like is a single lit rectangle, and what a room is
// actually furnished with should be a fitting with a body.
const LampObjectTypeConfig: ObjectTypeConfig =
{
    objectType: "Lamp",
    persistent: true,
    autoUnload: true,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // Every lamp in the room draws its parts from one pool of mesh instances, so the room can
        // only hold as many as that pool was sized for. Looked up here rather than at module scope:
        // this file is inside the object-config import cycle (see DoorObjectUtil).
        const typeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
        const lampCount = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === typeIndex).length;
        if (lampCount >= MAX_LAMPS_PER_ROOM)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return RoomValidationUtil.userIsAdmin(user);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // A lamp is slid along the wall by a gizmo, which is a placement rather than a motion.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // The values themselves are settled by ObjectMetadataEntryMap, which clamps a lamp's color
        // and strength into range, so what is left to ask here is only which keys a lamp answers to.
        return editableMetadataKeys.includes(signal.metadataKey);
    },
    components: {
        spawnedByAny: {
            collider: {
                // A lamp lays claim to the patch of wall it is mounted on, so nothing else can be
                // hung over it — and so that taking the wall away takes the lamp with it.
                colliderType: "wallAttachment",
                hitboxSize: {sizeX: LAMP_FOOTPRINT_WIDTH, sizeY: LAMP_FOOTPRINT_HEIGHT, sizeZ: 0.01},
                applyHardCollisionToOthers: false, // pass-through: the wall behind already blocks the player
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                maxNumInstancesPerMesh: MAX_LAMPS_PER_ROOM * MAX_MESH_INSTANCES_PER_LAMP,
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Default,
                codecVersion: 0,
                // One lit rectangle filling the patch of wall the lamp claims, in the color of the
                // light it gives off.
                //
                // **The color is derived from the lamp's light rather than authored beside it**,
                // which is what keeps a lamp from being able to glow one color and light the room
                // another. A change to the light rebuilds these parts (see LampGameObject), so the
                // two are re-derived together every time.
                generateDefaultParts: (obj: AddObjectSignal) => {
                    const color = ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME,
                        LampObjectUtil.getColorIndex(obj));
                    return {
                        params: {},
                        parts: [{
                            instancedMeshId: MeshDataUtil.getInstancedMeshId(LAMP_GEOMETRY_ID,
                                INSTANCED_EMISSIVE_MATERIAL_ID),
                            // A wall attachment carries its facing in the object's own rotation, so
                            // every part of it simply faces the object's local forward and turns
                            // with the wall (the same as a door's regions and a canvas's one quad).
                            dir: BACKWARD_DIR,
                            offset: {x: 0, y: 0, z: EMITTER_RELIEF},
                            scale: {x: LAMP_FOOTPRINT_WIDTH, y: LAMP_FOOTPRINT_HEIGHT, z: 1},
                            color,
                        }],
                    };
                },
            },
            orbitOccluder: {}, // Part of the wall it is mounted on, as far as the orbit camera is concerned.
            lightSource: {},
        },
    },
}

export default LampObjectTypeConfig;
