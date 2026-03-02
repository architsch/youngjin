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
import PersistentObjectSelection from "../../graphics/types/gizmo/persistentObjectSelection";
import { notificationMessageObservable } from "../../system/clientObservables";

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
        const { dirX, dirY, dirZ } = this.params.transform;
        this.instancedMeshGraphics.updateInstanceTransform(
            this.instanceId, 0, 0, 0.01, dirX, dirY, dirZ, 1, 1.308, 1); // The offset of 0.01 along the local +z axis (wall normal) prevents z-fighting with the wall.
        this.instancedMeshGraphics.updateInstanceTextureUV(this.instanceId, 0);
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();
        this.instancedMeshGraphics.returnInstanceToPool(this.instanceId);
    }

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

        PersistentObjectSelection.trySelect(this);
    }

    enter()
    {
        if (!this.params.hasMetadata(ObjectMetadataKeyEnumMap.DestinationRoomID))
        {
            notificationMessageObservable.set("The room is unavailable.");
            return;
        }

        const destinationRoomId = this.params.getMetadata(ObjectMetadataKeyEnumMap.DestinationRoomID);
        if (!destinationRoomId || destinationRoomId.trim() === "")
        {
            notificationMessageObservable.set("The room is unavailable.");
            return;
        }

        try
        {
            SocketsClient.tryEmitRoomChangeRequest(new RoomChangeRequestParams(destinationRoomId));
        }
        catch (error)
        {
            console.error("Failed to emit room change request:", error);
            notificationMessageObservable.set("The room is unavailable.");
        }
    }
}
