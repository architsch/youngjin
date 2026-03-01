import * as THREE from "three";
import GameObject from "./gameObject";
import SocketsClient from "../../networking/client/socketsClient";
import RoomChangeRequestParams from "../../../shared/room/types/roomChangeRequestParams";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectManager from "../objectManager";
import { MAX_WORLDSPACE_SELECT_DIST_SQR } from "../../../shared/system/sharedConstants";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";

export default class DoorGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;

    private instanceId: number = -1;

    constructor(params: ObjectSpawnParams)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("DoorGameObject requires InstancedMeshGraphics component");

        const materialParams = new TexturePackMaterialParams("https://thingspool.net/portal.png",
            435, 569, 435, 569, "staticImageFromPath"); // just a 1x1 grid containing one image (door) for now.
        this.instancedMeshGraphics.setInstancingProperties(materialParams,
            "Square", 512);
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        await this.instancedMeshGraphics.loadInstancedMesh();
        this.instanceId = this.instancedMeshGraphics.rentInstanceFromPool();
        this.instancedMeshGraphics.updateInstanceTransform(
            this.instanceId, 0, 0, 0.01, 0, 0, 1, 1, 1.308, 1); // The purpose of (offsetZ = 0.01) is to prevent the door from z-fighting with the wall.

    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();
        this.instancedMeshGraphics.returnInstanceToPool(this.instanceId);
    }

    // "instanceId" is the ID of the door's mesh instance that was
    // hit by the user's pointer input.
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const player = ObjectManager.getMyPlayer();
        if (player == undefined)
        {
            console.error("My player not found in DoorGameObject's onClick.");
            return;
        }
        const distSqr = hitPoint.distanceToSquared(player.position);
        if (distSqr > MAX_WORLDSPACE_SELECT_DIST_SQR)
            return;

        // TODO: Select the clicked door (i.e. highlight it in world space).
        // If it is already selected, unselect it (i.e. toggle the selection).
        // (Hint: Use "voxelGameObject.ts" and "voxelQuadSelection.ts" as references)
    }

    // When invoked, this method will move the user to the destination room.
    // The destination room's ID is encoded as part of the door's metadata.
    enter()
    {
        const destinationRoomId = this.params.getMetadata(ObjectMetadataKeyEnumMap.DestinationRoomID);
        SocketsClient.tryEmitRoomChangeRequest(new RoomChangeRequestParams(destinationRoomId));
    }

    // TODO: In a manner similar to how voxelQuadChanges can be made,
    // (Hint: Look at "voxelGameObject.ts", "voxelQuadSelection.ts", "voxelQuadSelectionMenu.tsx"")
    // we should also be able to:
    //      (1) Add a door while a voxelQuad is selected (in which case the new door will be placed right at the voxelQuad's position/direction).
    //          User should be able to initialize the door's destinationRoomID through an automatically appearing popup form.
    //      (2) Remove a selected door.
    //      (3) Move a selected door (both horizontally (x+, x-) and vertically (y+, y-), but within the room's bounds).
    //      (4) Set the destinationRoomID of a selected door (through a text input component and a "Set" button in the selection menu UI).
    //      (5) Enter a selected door (by letting the user click a big, easily noticeable "Enter" button, and invoking the door's "enter" method when it is clicked).
    // Such actions, just like how the "updateVoxelGridParams" signal propagates through the socket,
    // should be communicated across the network and get synced up with the PersistentObjectGroup of
    // both the server and the other connected clients (just like how the VoxelGrid gets synced up).
    // (p.s. My guess is that creating a new signal type called "updatePersistentObjectGroupParams" and
    //      allowing it to contain a list of changes in the room's current persistentObjectGroup might be a good idea.)
}