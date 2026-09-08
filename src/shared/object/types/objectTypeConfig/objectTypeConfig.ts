import { InstancedMeshCompositionParams } from "../../../graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecType } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import { ColliderConfig } from "../../../physics/types/colliderConfig";
import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";

export default interface ObjectTypeConfig
{
    objectType: string;
    persistent: boolean;
    autoUnload: boolean; // Whether the client-side object instance (i.e. GameObject) should automatically unload when the room unloads.
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => boolean,
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => boolean,
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => boolean,
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => boolean,
    components: {
        spawnedByAny?: {
            collider?: ColliderConfig,
            instancedMeshGraphics?: {},
            instancedMeshComposer?: {
                maxNumInstancesPerMesh: number,
                codecType: InstancedMeshCompositionCodecType,
                codecVersion: number,
                // What an object looks like before anything has been chosen for it. Handed the whole
                // object rather than one field of it, because different kinds of object are
                // recognized by different things: a player by who he belongs to, a door by the room
                // it stands in. Whatever is picked has to come out the same on every client and in
                // every session, so this must be derived from the object rather than drawn freshly.
                generateDefaultParts: (obj: AddObjectSignal) =>
                    {params: InstancedMeshCompositionParams,
                        parts: InstancedMeshCompositionPart[]},
            },
            speechBubble?: {
                yOffset: number,
                checkLineOfSight: boolean,
                prependUserNameToMessage: boolean,
            },
            // Text written onto a patch of the object itself, drawn in the world rather than over
            // it. What the text says is always the object's own "Label" metadata; what is declared
            // here is where on the object that patch is and how big it is, in the object's own local
            // space. The color is the one this kind of object is lettered in when nobody has said
            // otherwise — an object may carry a "LabelColor" of its own, which wins.
            labelText?: {
                localOffset: {x: number, y: number, z: number},
                size: {x: number, y: number},
                defaultFontColorHex: string,
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
            // Light the object gives off into the room. What the light is like is the object's own
            // metadata rather than a setting here, since two lamps of the same kind are lit
            // differently — see LampObjectUtil.
            lightSource?: {},
            // A cosmetic bounce is a property of the object itself, not of who is watching it, so
            // it belongs to every copy: the player character its owner sees in third person needs
            // it as much as everybody else's does, and a thing that is springy is springy no matter
            // who put it there.
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
}

export type SpawnType = "spawnedByMe" | "spawnedByOther" | "spawnedByAny";