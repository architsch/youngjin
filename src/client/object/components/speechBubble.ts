import * as THREE from "three";
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphicsManager from "../../graphics/graphicsManager";
import GameObjectComponent from "./gameObjectComponent";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import SocketsClient from "../../networking/client/socketsClient";
import App from "../../app";
import CameraUtil from "../../graphics/util/cameraUtil";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import { cameraModeObservable } from "../../system/clientObservables";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";

export default class SpeechBubble extends GameObjectComponent
{
    private speechBubbleHotspot: THREE.Object3D = new THREE.Object3D();
    private textElement: HTMLElement | undefined; // CSS2D root; its transform is owned by the renderer for on-screen positioning.
    private bubbleElement: HTMLElement | undefined; // Child holding the visual box + text; safe to animate without fighting the renderer.
    private textCSS2DObject: CSS2DObject | undefined;

    private vecTemp1 = new THREE.Vector3();
    private vecTemp2 = new THREE.Vector3();

    // Set when the speaker's body isn't drawn (see PlayerGameObject), so the bubble doesn't float alone.
    private hidden: boolean = false;

    async onSpawn(): Promise<void>
    {
        this.gameObject.obj.add(this.speechBubbleHotspot);
        this.speechBubbleHotspot.position.set(0, this.componentConfig.yOffset as number, 0);

        const metadata = this.gameObject.params.metadata[ObjectMetadataKeyEnumMap.SentMessage];
        const initialMessage = metadata ? metadata.str : "";
        this.displayMessage(initialMessage, false); // No bounce for the message already present at spawn.
    }

    async onDespawn(): Promise<void>
    {
        this.hideSpeechBubble();
    }

    update(deltaTime: number)
    {
        // If the speech bubble is active (visible), update its position and size.
        if (this.textElement)
        {
            if (this.hidden)
            {
                this.textElement.hidden = true;
                return;
            }

            this.speechBubbleHotspot.getWorldPosition(this.vecTemp1);
            GraphicsManager.getCamera().getWorldPosition(this.vecTemp2);
            const dist = this.vecTemp1.distanceTo(this.vecTemp2);

            // Near, in the field of view (hides one's own bubble in first person), and optionally unoccluded.
            if (dist < 12 && CameraUtil.pointIsInFieldOfView(this.vecTemp1) &&
                (!this.componentConfig.checkLineOfSight || this.orbitCameraIsFramingSpeaker() ||
                CameraUtil.objectIsInLineOfSight(this.vecTemp1, this.gameObject)))
            {
                const scaleFactor = Math.max(0.1, 1.5 - 0.12 * dist);
                const scaleFactorStr = `${scaleFactor.toFixed(3)}rem`;
                this.textElement.style.fontSize = scaleFactorStr;
                this.textElement.hidden = false;
            }
            else
            {
                this.textElement.hidden = true;
            }
        }
    }

    setHidden(hidden: boolean)
    {
        this.hidden = hidden;
    }

    setMessage(message: string, broadcastToServer: boolean)
    {
        this.displayMessage(message, true);

        if (broadcastToServer)
        {
            const room = App.getCurrentRoom();
            if (!room)
            {
                console.error("SpeechBubble.setMessage :: Current room not found");
                return;
            }
            if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            {
                const params = new SetObjectMetadataSignal(
                    room.id, this.gameObject.params.objectId,
                    ObjectMetadataKeyEnumMap.SentMessage, message);
                SocketsClient.emitSetObjectMetadataSignal(params);
            }
        }
    }

    onSetMetadata(key: ObjectMetadataKey, value: string): void
    {
        if (key !== ObjectMetadataKeyEnumMap.SentMessage)
            return;
        this.displayMessage(value, true);
    }

    // While the orbit frames this speaker, skip the bubble's own occlusion test: it disagrees
    // momentarily with OrbitOcclusionHider during camera turns, causing blinks.
    private orbitCameraIsFramingSpeaker(): boolean
    {
        const mode = cameraModeObservable.peek();
        return mode.type === "orbit" &&
            Geometry3DUtil.pointOverlapsAABB(this.gameObject.position, mode.target);
    }

    // Bounces on every change, local or remote.
    private displayMessage(message: string, animate: boolean): void
    {
        const prepend = this.componentConfig.prependUserNameToMessage;

        if (!prepend && message.length === 0)
        {
            this.hideSpeechBubble();
            return;
        }

        this.showSpeechBubble();
        this.bubbleElement!.replaceChildren();

        if (prepend)
        {
            const userName = this.gameObject.params.sourceUserName;
            const userNameSpan = document.createElement("span");
            userNameSpan.style.color = "oklch(87.9% 0.169 91.605)";
            userNameSpan.textContent = userName + (message.length > 0 ? ":" : "");
            this.bubbleElement!.appendChild(userNameSpan);

            if (message.length > 0)
                this.bubbleElement!.appendChild(document.createElement("br"));
        }

        if (message.length > 0)
            this.bubbleElement!.appendChild(document.createTextNode(message));

        if (animate)
            this.playBounce();
    }

    // Scales bubbleElement, since the renderer overwrites the CSS2D root's transform each frame.
    private playBounce(): void
    {
        this.bubbleElement?.animate(
            [
                { transform: "scale(1)" },
                { transform: "scale(1.4)" },
                { transform: "scale(1)" },
            ],
            { duration: 350, easing: "ease-out" });
    }

    private showSpeechBubble(): void
    {
        if (!this.textElement)
        {
            this.textElement = document.createElement("div");
            this.textElement.style = "position:absolute; font-size:0.75rem; pointer-events:none;"; // font-size (inherited by the child) is then driven per-frame in update().

            this.bubbleElement = document.createElement("div");
            this.bubbleElement.style = "max-width:18ch; margin:auto auto; padding:0.2rem 0.4rem; color:white; background-color:rgba(0, 0, 0, 0.75); border-radius:0.4rem; text-align:center; white-space:normal;";
            this.textElement.appendChild(this.bubbleElement);

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
            this.bubbleElement = undefined;
            this.textCSS2DObject?.removeFromParent();
            this.textCSS2DObject = undefined;
        }
    }
}
