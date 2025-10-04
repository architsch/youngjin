import * as THREE from "three";
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GameObject from "../object/types/gameObject";

export default class SpeechBubble
{
    private gameObject: GameObject;
    private speechBubbleHotspot: THREE.Object3D;
    private textElement: HTMLElement | undefined;
    private textCSS2DObject: CSS2DObject | undefined;
    private textTimeout: NodeJS.Timeout | undefined;

    private vecTemp1 = new THREE.Vector3();
    private vecTemp2 = new THREE.Vector3();

    constructor(gameObject: GameObject, speechBubbleY: number)
    {
        this.gameObject = gameObject;

        this.speechBubbleHotspot = new THREE.Object3D();
        this.gameObject.obj.add(this.speechBubbleHotspot);
        this.speechBubbleHotspot.position.set(0, speechBubbleY, 0);
    }

    showMessage(message: string): void
    {
        this.clear();

        this.textElement = document.createElement("div");
        this.textElement.style = "position:absolute; margin:auto auto; padding:0.2rem 0.2rem; color:white; background-color:rgba(0, 0, 0, 0.5); font-size:0.75rem; text-align:center;";
        this.textElement.textContent = message;
        this.textCSS2DObject = new CSS2DObject(this.textElement);
        this.speechBubbleHotspot.add(this.textCSS2DObject);
        this.textCSS2DObject.center.set(0.5, 1);
        this.textCSS2DObject.position.set(0, 0, 0);
        
        this.textTimeout = setTimeout(() => {
            this.clear(true);
        }, 5000);
    }

    onDespawn(): void
    {
        this.clear();
    }

    update(): void
    { 
        if (this.textElement)
        {
            this.speechBubbleHotspot.getWorldPosition(this.vecTemp1);
            this.gameObject.world.camera.getWorldPosition(this.vecTemp2);
            const dist = this.vecTemp1.distanceTo(this.vecTemp2);
            const scaleFactor = Math.max(0.3, 1.4 - 0.1 * dist);
            const scaleFactorStr = `${scaleFactor.toFixed(2)}rem`;
            this.textElement.style.fontSize = scaleFactorStr;
        }
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