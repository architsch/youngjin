import { FRAMED_PANEL_BOARD_RELIEF,
    FRAMED_PANEL_CONTENT_LIFT } from "../../../graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import CompositionMetadataUtil from "../../../graphics/mesh/composition/util/compositionMetadataUtil";
import StringUtil from "../../../math/util/stringUtil";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { ATTACHMENT_HITBOX_INSET, BACKWARD_DIR, UNIT_VEC3, WALL_DIRECTIONS } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import ObjectTypeConfig from "./objectTypeConfig";

const COMPOSITION_CODEC_VERSION = 0;

// Metadata keys the room's superuser may write to a label; anything else is refused.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
    ObjectMetadataKeyEnumMap.Label,
    ObjectMetadataKeyEnumMap.LabelColor,
    ObjectMetadataKeyEnumMap.LabelFont,
];

// A sign on a wall: text on a plaque, or straight on the wall without a frame. Placed and edited under the
// doors' rule for now (see RoomValidationUtil.isRoomSuperuser).
const LabelObjectTypeConfig =
{
    objectType: "Label",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Label,
    // Resized in half-voxel steps along the wall, as a canvas is; a step is also one cell of the label
    // atlas (see LABEL_ATLAS_CELL_WORLD_SIZE). Depth is the wall gap and never changes.
    scaling: {
        scaleStep: {x: 0.5, y: 0.5, z: 0},
        minScale: {x: 0.5, y: 0.5, z: 1},
        maxScale: {x: 3.5, y: 3.5, z: 1},
        defaultScale: {x: 1, y: 1, z: 1},
    },
    attachment: {
        allowedDirections: WALL_DIRECTIONS,
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.isRoomSuperuser(user, room))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return RoomValidationUtil.isRoomSuperuser(user, room);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!RoomValidationUtil.isRoomSuperuser(user, room))
            return false;

        // A label is dragged along the wall by a gizmo, which is a placement rather than a motion.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!RoomValidationUtil.isRoomSuperuser(user, room))
            return false;

        // A look must be one of a label's own; other values are sanitized by ObjectMetadataEntryMap.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.InstancedMeshComposition)
        {
            return CompositionMetadataUtil.isIndexedLookOf("Label", COMPOSITION_CODEC_VERSION,
                signal.metadataValue);
        }
        return editableMetadataKeys.includes(signal.metadataKey);
    },
    components: {
        spawnedByAny: {
            collider: {
                baseHitboxSize: {
                    sizeX: 1,
                    sizeY: 1,
                    sizeZ: 0.5 * ATTACHMENT_HITBOX_INSET
                },
                applyHardCollisionToOthers: false, // pass-through: the wall behind already blocks the player
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
                    // Seeded from room and label id, so every client and session sees the same plaque. Never
                    // the frameless look: a label nobody has dressed still gets a plaque.
                    const hashCode = StringUtil.getHashCode(`${obj.roomID}/${obj.objectId}`);
                    return CompositionMetadataUtil.decodeSeededIndexed("Label", 1, hashCode,
                        COMPOSITION_CODEC_VERSION, ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale));
                },
                // Straight on, as it hangs.
                thumbnailView: {yawDeg: 0, pitchDeg: 0},
            },
            // The whole footprint, in front of where the board would be; the board's band narrows it
            // (see LabelGameObject).
            labelText: {
                localTransform: {
                    pos: {x: 0, y: 0, z: FRAMED_PANEL_BOARD_RELIEF + FRAMED_PANEL_CONTENT_LIFT},
                    dir: BACKWARD_DIR,
                    scale: {...UNIT_VEC3},
                },
                defaultFontColorHex: "#33302c", // the doors' lettering (see DoorObjectTypeConfig)
            },
            orbitOccluder: {}, // A sign on a wall stands in the orbit camera's way like the wall itself does.
        },
    },
} satisfies ObjectTypeConfig;

export default LabelObjectTypeConfig;
