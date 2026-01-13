import * as THREE from "three";
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphicsManager from "../../graphics/graphicsManager";
import GameObjectComponent from "./gameObjectComponent";
import ObjectMessageParams from "../../../shared/object/types/objectMessageParams";
import { objectMessageObservable } from "../../system/clientObservables";
import GameObject from "../types/gameObject";
import GameSocketsClient from "../../networking/gameSocketsClient";

export default class SpeechBubble extends GameObjectComponent
{
    private speechBubbleHotspot: THREE.Object3D = new THREE.Object3D();
    private textElement: HTMLElement | undefined;
    private textCSS2DObject: CSS2DObject | undefined;
    private textTimeout: NodeJS.Timeout | undefined;

    private vecTemp1 = new THREE.Vector3();
    private vecTemp2 = new THREE.Vector3();

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);
        this.onObjectMessageReceived = this.onObjectMessageReceived.bind(this);
    }

    async onSpawn(): Promise<void>
    {
        this.gameObject.obj.add(this.speechBubbleHotspot);
        this.speechBubbleHotspot.position.set(0, this.componentConfig.yOffset as number, 0);
        objectMessageObservable.addListener(this.gameObject.params.objectId, this.onObjectMessageReceived);
    }

    async onDespawn(): Promise<void>
    {
        this.clearMessage();
        objectMessageObservable.removeListener(this.gameObject.params.objectId);
    }

    update(deltaTime: number)
    { 
        if (this.textElement)
        {
            this.speechBubbleHotspot.getWorldPosition(this.vecTemp1);
            GraphicsManager.getCamera().getWorldPosition(this.vecTemp2);
            const dist = this.vecTemp1.distanceTo(this.vecTemp2);
            const scaleFactor = Math.max(0.3, 1.6 - 0.2 * dist);
            const scaleFactorStr = `${scaleFactor.toFixed(2)}rem`;
            this.textElement.style.fontSize = scaleFactorStr;
        }
    }

    showMessage(message: string, showOnClientSide: boolean, broadcastToServer: boolean,
        lifetimeInMillis?: number)
    {
        if (showOnClientSide)
        {
            this.clearMessage();

            this.textElement = document.createElement("div");
            this.textElement.style = "position:absolute; max-width:16rem; margin:auto auto; padding:0.2rem 0.2rem; color:white; background-color:rgba(0, 0, 0, 0.5); font-size:0.75rem; text-align:center; white-space:normal;";
            this.textElement.textContent = message;
            this.textCSS2DObject = new CSS2DObject(this.textElement);
            this.speechBubbleHotspot.add(this.textCSS2DObject);
            this.textCSS2DObject.center.set(0.5, 1);
            this.textCSS2DObject.position.set(0, 0, 0);
            
            if (lifetimeInMillis != undefined)
            {
                this.textTimeout = setTimeout(() => {
                    this.clearMessage(true);
                }, lifetimeInMillis);
            }
        }

        if (broadcastToServer)
        {
            const params = new ObjectMessageParams(this.gameObject.params.objectId, message);
            GameSocketsClient.emitObjectMessage(params);
        }
    }

    clearMessage(dontClearTimeout: boolean = false): void
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

    private onObjectMessageReceived(params: ObjectMessageParams): void
    {
        if (params.senderObjectId != this.gameObject.params.objectId)
        {
            console.error(`Object-message was received by a different object (senderObjectId = ${params.senderObjectId}, receiverObjectId = ${this.gameObject.params.objectId})`);
            return;
        }
        this.showMessage(params.message, true, false, 5000);
    }
}