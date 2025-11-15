import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import ModelFactory from "../../graphics/factories/modelFactory";
import App from "../../app";
import { SpawnType } from "../../../shared/object/types/objectTypeConfig";

export default class ModelGraphics extends GameObjectComponent
{
    private model: THREE.Group | undefined;

    isSpawnTypeAllowed(spawnType: SpawnType): boolean
    {
        return true;
    }

    async onSpawn(): Promise<void>
    {
        const model = await ModelFactory.load(`${App.getEnv().assets_url}/${this.componentConfig.path}`);
        this.model = model.clone();
        this.gameObject.obj.add(this.model);

        const p = this.componentConfig.localPosition;
        this.model.position.set(p.x, p.y, p.z);

        const s = this.componentConfig.scale;
        this.model.scale.set(s.x, s.y, s.z);
        
        this.model.rotation.set(0, Math.PI, 0);
    }

    async onDespawn(): Promise<void>
    {
        this.model?.removeFromParent();
    }
}