import { InstancedMeshCompositionParams } from "../../../graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecType } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import { ColliderConfig } from "../../../physics/types/colliderConfig";
import Transform from "../../../math/types/transform";
import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import { ObjectCategory } from "../objectCategory";
import { ObjectScalingConfig } from "../objectScalingConfig";
import { ObjectAttachmentConfig } from "../objectAttachmentConfig";
import AddObjectSignal from "../addObjectSignal";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";

export default interface ObjectTypeConfig
{
    objectType: string;
    persistent: boolean;
    autoUnload: boolean; // Whether the client-side object instance (i.e. GameObject) should automatically unload when the room unloads.
    // The kind of thing this type is. The per-room cap belongs to the category, so every type in one
    // spends the same budget (see ObjectCategoryConfigMap).
    category: ObjectCategory;
    // How far this type may be resized. Absent means fixed at the collider's base size.
    scaling?: ObjectScalingConfig;
    // Which voxel faces the type is attached to. Absent means it stands free in the room.
    attachment?: ObjectAttachmentConfig;
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => boolean,
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => boolean,
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => boolean,
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => boolean,
    components: {
        spawnedByAny?: {
            collider?: ColliderConfig,
            instancedMeshGraphics?: {},
            instancedMeshComposer?: {
                codecType: InstancedMeshCompositionCodecType,
                codecVersion: number,
                // Default appearance, derived deterministically from the object (e.g. owner or room) so
                // it matches on every client and session.
                generateDefaultParts: (obj: AddObjectSignal) =>
                    {params: InstancedMeshCompositionParams,
                        parts: InstancedMeshCompositionPart[]},
                // Fills in what the parts take from the object rather than the composition (e.g. a
                // lamp's glow, from its light), after every decode.
                deriveParts?: (obj: AddObjectSignal, parts: InstancedMeshCompositionPart[]) => void,
                // Camera angle of the type's pre-encoded composition thumbnails (see CompositionThumbnailBuilder),
                // in degrees from straight in front of the +Z face: yaw turns right, pitch rises. Isometric if unset.
                thumbnailView?: {yawDeg: number, pitchDeg: number},
            },
            speechBubble?: {
                yOffset: number,
                checkLineOfSight: boolean,
                prependUserNameToMessage: boolean,
            },
            // In-world label from the object's "Label" metadata, and a default ink (a "LabelColor" metadata
            // value wins). localTransform is the patch the text is drawn on, relative to the object's
            // transform: the object's scale multiplies it, so the patch grows with a resize. An object
            // that frames its text may narrow it further (see LabelText.setContentSize).
            labelText?: {
                localTransform: Transform,
                defaultFontColorHex: string,
            },
            playerProximityDetector?: {
                maxDist: number,
                // Max angles for "looking at" and "in front of"; <= 0 disables that check.
                maxLookAngle: number,
                maxFaceAngle: number,
                // Line-of-sight check (costs a raycast).
                checkLineOfSight: boolean,
            },
            orbitOccluder?: {},
            // Light parameters come from the object's metadata (see the lamp's util).
            lightSource?: {},
            // On every copy, including the owner's own character.
            easingMotion?: {},
        },
        spawnedByMe?: {
            playerController?: {},
            periodicTransformEmitter?: {},
            rigidbody?: {},
        },
        spawnedByOther?: {
            periodicTransformReceiver?: {},
        },
    },
    // Type-specific semantics (metadata reading, construction), accessed via the type's own config module
    // (e.g. `DoorObjectTypeConfig.util.getDestinationRoomId(obj)`); `satisfies ObjectTypeConfig` keeps signatures typed.
    util?: {[methodName: string]: (...args: any[]) => any},
}

export type SpawnType = "spawnedByMe" | "spawnedByOther" | "spawnedByAny";