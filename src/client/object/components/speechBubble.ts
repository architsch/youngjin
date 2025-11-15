import * as THREE from "three";
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphicsManager from "../../graphics/graphicsManager";
import GameObjectComponent from "./gameObjectComponent";
import ObjectMessageParams from "../../../shared/object/types/objectMessageParams";
import { SpawnType } from "../../../shared/object/types/objectTypeConfig";

export default class SpeechBubble extends GameObjectComponent
{
    private speechBubbleHotspot: THREE.Object3D = new THREE.Object3D();
    private textElement: HTMLElement | undefined;
    private textCSS2DObject: CSS2DObject | undefined;
    private textTimeout: NodeJS.Timeout | undefined;

    private vecTemp1 = new THREE.Vector3();
    private vecTemp2 = new THREE.Vector3();

    isSpawnTypeAllowed(spawnType: SpawnType): boolean
    {
        return spawnType == "spawnedByOther";
    }

    async onSpawn(): Promise<void>
    {
        if (this.gameObject.isMine())
            throw new Error("User's own object is not allowed to have the ObjectSyncEmitter component.");

        this.gameObject.obj.add(this.speechBubbleHotspot);
        this.speechBubbleHotspot.position.set(0, this.componentConfig.yOffset as number, 0);
    }

    async onDespawn(): Promise<void>
    {
        this.clear();
    }

    update(deltaTime: number)
    { 
        if (this.textElement)
        {
            this.speechBubbleHotspot.getWorldPosition(this.vecTemp1);
            GraphicsManager.getCamera().getWorldPosition(this.vecTemp2);
            const dist = this.vecTemp1.distanceTo(this.vecTemp2);
            const scaleFactor = Math.max(0.3, 1.4 - 0.1 * dist);
            const scaleFactorStr = `${scaleFactor.toFixed(2)}rem`;
            this.textElement.style.fontSize = scaleFactorStr;
        }
    }

    onObjectMessageReceived(params: ObjectMessageParams)
    {
        this.clear();

        this.textElement = document.createElement("div");
        this.textElement.style = "position:absolute; max-width:16rem; margin:auto auto; padding:0.2rem 0.2rem; color:white; background-color:rgba(0, 0, 0, 0.5); font-size:0.75rem; text-align:center; white-space:normal;";
        this.textElement.textContent = params.message;
        this.textCSS2DObject = new CSS2DObject(this.textElement);
        this.speechBubbleHotspot.add(this.textCSS2DObject);
        this.textCSS2DObject.center.set(0.5, 1);
        this.textCSS2DObject.position.set(0, 0, 0);
        
        this.textTimeout = setTimeout(() => {
            this.clear(true);
        }, 5000);
    }

    private clear(dontClearTimeout: boolean = false): void
    {
        if (!dontClearTimeout)
        {
            if (this.textTimeout)
                clearTimeout(this.textTimeout);
            this.textTimeout = undefined;
        }
        this.textElement?.remove();
        this.textElement = undefined;
        this.textCSS2DObject?.removeFromParent();
        this.textCSS2DObject = undefined;
    }
}