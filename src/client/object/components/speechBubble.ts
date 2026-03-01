import * as THREE from "three";
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphicsManager from "../../graphics/graphicsManager";
import GameObjectComponent from "./gameObjectComponent";
import ObjectMessageParams from "../../../shared/object/types/objectMessageParams";
import SocketsClient from "../../networking/client/socketsClient";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";

export default class SpeechBubble extends GameObjectComponent
{
    private speechBubbleHotspot: THREE.Object3D = new THREE.Object3D();
    private textElement: HTMLElement | undefined;
    private textCSS2DObject: CSS2DObject | undefined;

    private vecTemp1 = new THREE.Vector3();
    private vecTemp2 = new THREE.Vector3();

    async onSpawn(): Promise<void>
    {
        this.gameObject.obj.add(this.speechBubbleHotspot);
        this.speechBubbleHotspot.position.set(0, this.componentConfig.yOffset as number, 0);

        let initialMessage = "";
        if (this.gameObject.params.hasMetadata(ObjectMetadataKeyEnumMap.SentMessage)) // The object has a sent message.
            initialMessage = this.gameObject.params.getMetadata(ObjectMetadataKeyEnumMap.SentMessage);
        this.setMessage(initialMessage, false);
    }

    async onDespawn(): Promise<void>
    {
        if (!this.shouldShowMessage())
            return;
        this.hideSpeechBubble();
    }

    update(deltaTime: number)
    {
        // If the speech bubble is active (visible), update its position and size.
        if (this.textElement)
        {
            this.speechBubbleHotspot.getWorldPosition(this.vecTemp1);
            GraphicsManager.getCamera().getWorldPosition(this.vecTemp2);
            const dist = this.vecTemp1.distanceTo(this.vecTemp2);
            const scaleFactor = Math.max(0.1, 1.4 - 0.15 * dist);
            const scaleFactorStr = `${scaleFactor.toFixed(3)}rem`;
            this.textElement.style.fontSize = scaleFactorStr;
        }
    }

    setMessage(message: string, broadcastToServer: boolean)
    {
        if (this.shouldShowMessage())
        {
            if (this.componentConfig.prependUserNameToMessage)
            {
                const userName = this.gameObject.params.sourceUserName;
                message = `<span style="color:#707070;">${userName + (message.length > 0 ? ":<br/>" : "")}</span>${message}`;
            }

            if (message.length > 0)
            {
                this.showSpeechBubble();
                this.textElement!.innerHTML = message;
            }
            else // Message is empty
            {
                this.hideSpeechBubble();
            }
        }

        if (broadcastToServer)
        {
            const params = new ObjectMessageParams(this.gameObject.params.objectId, message);
            SocketsClient.emitObjectMessage(params);
        }
    }

    // This method gets called when a message is received from the server.
    onObjectMessageReceived(params: ObjectMessageParams): void
    {
        if (params.senderObjectId != this.gameObject.params.objectId)
        {
            console.error(`Object-message was received by a different object (senderObjectId = ${params.senderObjectId}, receiverObjectId = ${this.gameObject.params.objectId})`);
            return;
        }
        // Display the received message on the client side if applicable.
        // Don't send the message back to the server because doing so will
        // cause the message to propagate back and forth over and over.
        this.setMessage(params.message, false);
    }

    private showSpeechBubble(): void
    {
        if (!this.textElement)
        {
            this.textElement = document.createElement("div");
            this.textElement.style = "position:absolute; max-width:18ch; margin:auto auto; padding:0.2rem 0.2rem; color:white; background-color:rgba(0, 0, 0, 0.5); font-size:0.75rem; text-align:center; white-space:normal;";
            this.textCSS2DObject = new CSS2DObject(this.textElement);
            this.speechBubbleHotspot.add(this.textCSS2DObject);
            this.textCSS2DObject.center.set(0.5, 1);
            this.textCSS2DObject.position.set(0, 0, 0);
        }
    }

    private hideSpeechBubble(): void
    {
        if (this.textElement)
        {
            this.textElement?.remove();
            this.textElement = undefined;
            this.textCSS2DObject?.removeFromParent();
            this.textCSS2DObject = undefined;
        }
    }

    private shouldShowMessage(): boolean
    {
        return (this.componentConfig.showMessageIfSpawnedByMe && this.gameObject.isMine()) ||
            (this.componentConfig.showMessageIfSpawnedByOther && !this.gameObject.isMine());
    }
}