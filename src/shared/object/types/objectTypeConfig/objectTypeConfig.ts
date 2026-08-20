import { InstancedMeshCompositionParams } from "../../../graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecType } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import { ColliderConfig } from "../../../physics/types/colliderConfig";
import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import { UserRole } from "../../../user/types/userRole";
import AddObjectSignal from "../addObjectSignal";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";

export default interface ObjectTypeConfig
{
    objectType: string;
    persistent: boolean;
    autoUnload: boolean; // Whether the client-side object instance (i.e. GameObject) should automatically unload when the room unloads.
    canUserAddObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => boolean,
    canUserRemoveObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => boolean,
    canUserSetObjectTransform: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => boolean,
    canUserSetObjectMetadata: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => boolean,
    components: {
        spawnedByAny?: {
            collider?: ColliderConfig,
            instancedMeshGraphics?: {},
            instancedMeshComposer?: {
                maxNumInstancesPerMesh: number,
                codecType: InstancedMeshCompositionCodecType,
                codecVersion: number,
                generateDefaultParts: (sourceUserID: string) =>
                    {params: InstancedMeshCompositionParams,
                        parts: InstancedMeshCompositionPart[]},
            },
            meshGraphics?: {
                path: string,
                geometryId: string,
                localPosition: {x: number, y: number, z: number},
                scale: {x: number, y: number, z: number},
            },
            speechBubble?: {
                yOffset: number,
                checkLineOfSight: boolean,
                prependUserNameToMessage: boolean,
            },
            playerProximityDetector?: {
                maxDist: number,
                // How far from straight ahead the player may be looking and still count as looking
                // at the object, and how far round the side it faces he may stand and still count
                // as standing in front of it. Either left at or below zero is a question not asked.
                maxLookAngle: number,
                maxFaceAngle: number,
                // Whether the object also has to be in plain view, which costs a cast through the
                // room and is worth asking only where something can come between the two.
                checkLineOfSight: boolean,
            },
            orbitOccluder?: {},
        },
        spawnedByMe?: {
            playerController?: {},
            periodicTransformEmitter?: {},
            rigidbody?: {},
        },
        spawnedByOther?: {
            periodicTransformReceiver?: {},
            instancedMeshGraphics?: {},
            modelGraphics?: {
                path: string,
                localPosition: {x: number, y: number, z: number},
                scale: {x: number, y: number, z: number},
            },
            easingMotion?: {},
        },
    },
}

export type SpawnType = "spawnedByMe" | "spawnedByOther" | "spawnedByAny";