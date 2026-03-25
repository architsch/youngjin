import { ColliderConfig } from "../../physics/types/colliderConfig";
import Room from "../../room/types/room";
import User from "../../user/types/user";
import { UserRole } from "../../user/types/userRole";
import AddObjectSignal from "./addObjectSignal";
import SetObjectMetadataSignal from "./setObjectMetadataSignal";
import SetObjectTransformSignal from "./setObjectTransformSignal";

export default interface ObjectTypeConfig
{
    objectType: string;
    persistent: boolean;
    canUserAddObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => boolean,
    canUserRemoveObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => boolean,
    canUserSetObjectTransform: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => boolean,
    canUserSetObjectMetadata: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => boolean,
    components: {
        spawnedByAny?: {
            collider?: ColliderConfig,
            instancedMeshGraphics?: {
                createInstanceIdPool: boolean,
            },
            speechBubble?: {
                yOffset: number,
                prependUserNameToMessage: boolean,
                showMessageIfSpawnedByMe: boolean,
                showMessageIfSpawnedByOther: boolean,
            },
            playerProximityDetector?: {
                maxDist: number,
                maxLookAngle: number,
            },
        },
        spawnedByMe?: {
            firstPersonController?: {},
            periodicTransformEmitter?: {},
            rigidbody?: {},
        },
        spawnedByOther?: {
            periodicTransformReceiver?: {},
            modelGraphics?: {
                path: string,
                localPosition: {x: number, y: number, z: number},
                scale: {x: number, y: number, z: number},
            },
        },
    },
}

export type SpawnType = "spawnedByMe" | "spawnedByOther" | "spawnedByAny";