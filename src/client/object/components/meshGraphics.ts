import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import App from "../../app";
import MeshFactory from "../../graphics/factories/meshFactory";
import TextureMaterialParams from "../../graphics/types/material/textureMaterialParams";

export default class MeshGraphics extends GameObjectComponent
{
    mesh: THREE.Mesh | undefined;

    getMeshId(): string // For regular (non-instanced) meshes, (meshId == objectId).
    {
        return this.gameObject.params.objectId;
    }

    async onSpawn(): Promise<void>
    {
        this.mesh = await MeshFactory.loadMesh(
            this.getMeshId(),
            this.componentConfig.geometryId,
            new TextureMaterialParams(`${App.getEnv().assets_url}/${this.componentConfig.path}`, -1, -1) // polygon-offset values are -1 because the mesh must not z-fight with the wall behind it.
        );
        this.gameObject.visualObj.add(this.mesh);

        const p = this.componentConfig.localPosition;
        this.mesh.position.set(p.x, p.y, p.z);

        const s = this.componentConfig.scale;
        this.mesh.scale.set(s.x, s.y, s.z);
    }

    async onDespawn(): Promise<void>
    {
        this.mesh?.removeFromParent();
        MeshFactory.unload(this.getMeshId());
    }
}