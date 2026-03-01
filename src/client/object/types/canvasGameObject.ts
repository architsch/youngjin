import * as THREE from "three";
import GameObject from "./gameObject";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import ObjectManager from "../objectManager";
import { MAX_WORLDSPACE_SELECT_DIST_SQR } from "../../../shared/system/sharedConstants";

export default class CanvasGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;

    private instanceId: number = -1;

    constructor(params: ObjectSpawnParams)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("CanvasGameObject requires InstancedMeshGraphics component");

        const materialParams = new TexturePackMaterialParams("canvas_texture_pack",
            2048, 2048, 256, 256, "dynamicEmpty");
        this.instancedMeshGraphics.setInstancingProperties(materialParams,
            "Square", 512);
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        await this.instancedMeshGraphics.loadInstancedMesh();
        this.instanceId = this.instancedMeshGraphics.rentInstanceFromPool();
        this.instancedMeshGraphics.updateInstanceTransform(
            this.instanceId, 0, 0, 0.01, 0, 0, 1, 1, 1, 1); // The purpose of (offsetZ = 0.01) is to prevent the canvas from z-fighting with the wall.

    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();
        this.instancedMeshGraphics.returnInstanceToPool(this.instanceId);
    }

    // "instanceId" is the ID of the canvas's mesh instance that was
    // hit by the user's pointer input.
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const player = ObjectManager.getMyPlayer();
        if (player == undefined)
        {
            console.error("My player not found in CanvasGameObject's onClick.");
            return;
        }
        const distSqr = hitPoint.distanceToSquared(player.position);
        if (distSqr > MAX_WORLDSPACE_SELECT_DIST_SQR)
            return;

        // TODO: Select the clicked canvas (i.e. highlight it in world space).
        // If it is already selected, unselect it (i.e. toggle the selection).
        // (Hint: Use "voxelGameObject.ts" and "voxelQuadSelection.ts" as references)
    }

    // TODO: As soon as the room is fully loaded, sequentially run all the "loadImage" tasks
    // of all the spawned CanvasGameObjects, starting with the one that is closest to the user's
    // player object, and then the one that is the second closest to the user's player object, and so on.
    // The purpose of this sequential loading approach is to keep the network bandwidth on a moderate level.
    // (Hint: I guess you could use a static dictionary called "spawnedCanvasGameObjects" in this class to keep track of all
    // the currently spawned CanvasGameObjects, as well as some kind of priority queue to keep track of a sequence of
    // pending "loadImage" tasks, ordered by their distances from the user's player object.)
    async loadImage()
    {
        const imageURL = this.params.getMetadata(ObjectMetadataKeyEnumMap.ImageURL);
        this.instancedMeshGraphics.updateInstanceTextureUV(this.instanceId, this.instanceId % 64);
        await this.instancedMeshGraphics.drawImageAtIndex(this.instanceId % 64, imageURL);
    }

    // TODO: In a manner similar to how voxelQuadChanges can be made,
    // (Hint: Look at "voxelGameObject.ts", "voxelQuadSelection.ts", "voxelQuadSelectionMenu.tsx"")
    // we should also be able to:
    //      (1) Add a canvas while a voxelQuad is selected (in which case the new canvas will be placed right at the voxelQuad's position/direction).
    //          User should be able to initialize the canvas's image URL through an automatically appearing popup form.
    //      (2) Remove a selected canvas.
    //      (3) Move a selected canvas (both horizontally (x+, x-) and vertically (y+, y-), but within the room's bounds).
    //      (4) Set the image URL of a selected canvas (through a text input component and a "Set" button in the selection menu UI).
    // Such actions, just like how the "updateVoxelGridParams" signal propagates through the socket,
    // should be communicated across the network and get synced up with the PersistentObjectGroup of
    // both the server and the other connected clients (just like how the VoxelGrid gets synced up).
    // (p.s. My guess is that creating a new signal type called "updatePersistentObjectGroupParams" and
    //      allowing it to contain a list of changes in the room's current persistentObjectGroup might be a good idea.)
    // (p.s. Don't forget to run "loadImage" when a new canvas gets added by the user during gameplay. Make sure that ALL clients in the same room run this method.)
}