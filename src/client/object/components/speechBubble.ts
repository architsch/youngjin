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
import { cameraModeObservable, updateObservable } from "../../system/clientObservables";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import MessageSegment from "../../../shared/object/types/messageSegment";
import MessageLinkUtil from "../../../shared/object/util/messageLinkUtil";
import OverlayClickTargetUtil from "../../graphics/util/overlayClickTargetUtil";
import MessageLinkOpenUtil from "../../ui/util/messageLinkOpenUtil";

// Room left between a bubble and the edges of the view (see keepInView).
const VIEW_MARGIN_PX = 8;
// How long a helper is shown thinking on the browser's word alone, before the server's Thinking takes over (see
// HelperThinkingUtil); one the server never confirms was a wrong guess.
const EXPECTED_THINKING_MS = 3000;
const PADDING_X_REM = 0.4;
// A bubble runs as wide as its speaker's type has it, unless its message could take more lines than this there: then it
// is widened until it can't, at most this many times as wide, and never past the view's sides, so that it rises less
// far over its speaker.
const MAX_LINES_AT_TYPE_WIDTH = 3;
const MAX_WIDENING = 2;
const DEFAULT_WIDTH_IN_CHARS = 18;
// What a link's button adds to its label, in characters: its margins, padding and icon.
const LINK_BUTTON_EXTRA_CHARS = 4;
// A control in the bubble, so raised (a lit top edge over a darkening face), and taking presses the bubble around it
// lets through. A row, since a line may break before an icon even where text may not. Its unpainted border above and
// below makes it easier to hit with a finger, and its margins give that height back, so the lines keep their place.
const LINK_BUTTON_STYLE = "display:inline-flex; align-items:center; margin:-0.35em 0.15em; padding:0 0.35em;"
    + " border:0.35em solid transparent; border-left-width:0; border-right-width:0; background-clip:padding-box;"
    + " border-radius:0.35em / 0.7em; background-image:linear-gradient(#38bdf8, #0369a1); color:white; font-weight:bold;"
    + " white-space:nowrap; box-shadow:inset 0 1px rgba(255, 255, 255, 0.35); cursor:pointer; pointer-events:auto;";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
// Characters about twice as wide as a Latin letter in the bubble's monospace font: Hangul, kana, CJK ideographs, and
// full-width forms.
const WIDE_CHARACTER = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

const anchorTemp = new THREE.Vector3();
const viewSizeTemp = new THREE.Vector2();
let instanceCount = 0;

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
    // Until when a helper is shown thinking before the server says so (see expectThinking).
    private thinkingExpectedUntil: number = 0;

    // How far the bubble is lowered to keep its top in view, and moved sideways to keep its sides in view.
    private lowered: number = 0;
    private shifted: number = 0;
    private readonly viewListenerKey = `speechBubble${++instanceCount}`;
    private keepingInView: boolean = false;

    async onSpawn(): Promise<void>
    {
        this.gameObject.bodyObj.add(this.speechBubbleHotspot);
        this.speechBubbleHotspot.position.set(0, this.componentConfig.yOffset as number, 0);

        const metadata = this.gameObject.params.metadata[ObjectMetadataKeyEnumMap.SentMessage];
        const initialMessage = metadata ? metadata.str : "";
        this.displayMessage(initialMessage, false); // No bounce for the message already present at spawn.

        // After the overlay has placed the bubble for the frame (see GraphicsManager.update).
        updateObservable.addListener(this.viewListenerKey, () => this.keepInView());
        this.keepingInView = true;
    }

    async onDespawn(): Promise<void>
    {
        if (this.keepingInView)
        {
            updateObservable.removeListener(this.viewListenerKey);
            this.keepingInView = false;
        }
        this.hideSpeechBubble();
    }

    update(deltaTime: number)
    {
        if (this.thinkingExpectedUntil > 0 && performance.now() >= this.thinkingExpectedUntil)
        {
            this.thinkingExpectedUntil = 0;
            this.refresh();
        }

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
        if (key === ObjectMetadataKeyEnumMap.SentMessage)
            this.displayMessage(value, true);
        else if (key === ObjectMetadataKeyEnumMap.Thinking)
        {
            this.thinkingExpectedUntil = 0;
            this.refresh();
        }
    }

    // A helper shown thinking at once, for the user's line it is about to hear, until the server's Thinking comes.
    expectThinking(): void
    {
        this.thinkingExpectedUntil = performance.now() + EXPECTED_THINKING_MS;
        this.refresh();
    }

    // Shows the message again as it stands, for a speaker whose name has changed (see GameObject.getSpeakerName), or who
    // starts or stops thinking.
    refresh(): void
    {
        this.displayMessage(this.gameObject.params.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str ?? "", false);
    }

    // A long message from a speaker close by would rise past the top of the view: it is lowered over the speaker instead,
    // so that it reads from its first line, and bounces from its top. One from a speaker near a side of the view, which
    // would run past it, is moved in from that side (from the left, where it is wider than the view).
    private keepInView(): void
    {
        if (!this.textElement || !this.bubbleElement || this.textElement.hidden)
            return;
        const width = this.textElement.offsetWidth;
        const height = this.textElement.offsetHeight;
        if (height == 0) // Not drawn, as behind the camera.
            return;
        this.speechBubbleHotspot.getWorldPosition(anchorTemp).project(GraphicsManager.getCamera());
        GraphicsManager.getGameRenderer().getSize(viewSizeTemp);
        const top = (1 - anchorTemp.y) / 2 * viewSizeTemp.y - height;
        const left = (1 + anchorTemp.x) / 2 * viewSizeTemp.x - 0.5 * width;
        const lowered = Math.max(0, Math.round(VIEW_MARGIN_PX - top));
        const shifted = Math.round((left < VIEW_MARGIN_PX) ? VIEW_MARGIN_PX - left
            : Math.min(0, viewSizeTemp.x - VIEW_MARGIN_PX - (left + width)));
        if (lowered == this.lowered && shifted == this.shifted)
            return;
        this.lowered = lowered;
        this.shifted = shifted;
        this.bubbleElement.style.top = `${lowered}px`;
        this.bubbleElement.style.left = `${shifted}px`;
        this.bubbleElement.style.transformOrigin = (lowered > 0) ? "top" : "";
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

        const segments = MessageLinkUtil.parse(message);
        this.showSpeechBubble();
        this.bubbleElement!.replaceChildren();
        this.bubbleElement!.style.maxWidth = this.getMaxWidth(segments);

        if (prepend)
        {
            const userName = this.gameObject.getSpeakerName();
            const userNameSpan = document.createElement("span");
            userNameSpan.style.color = "oklch(87.9% 0.169 91.605)";
            userNameSpan.textContent = userName + (message.length > 0 ? ":" : "");
            // A helper thinking of an answer (see HelperBehaviorUtil), with its last words still up.
            if (this.gameObject.params.metadata[ObjectMetadataKeyEnumMap.Thinking]?.str == "1"
                || performance.now() < this.thinkingExpectedUntil)
            {
                userNameSpan.appendChild(createThinkingSpinner());
            }
            this.bubbleElement!.appendChild(userNameSpan);

            if (message.length > 0)
                this.bubbleElement!.appendChild(document.createElement("br"));
        }

        for (const segment of segments)
        {
            this.bubbleElement!.appendChild((segment.kind == "text") ? document.createTextNode(segment.text)
                : createLinkButton(segment.href, segment.label));
        }

        if (animate)
            this.playBounce();
    }

    // In characters, as many as the message needs to take no more than MAX_LINES_AT_TYPE_WIDTH lines however its words
    // wrap: a line falls short of the width by less than the longest word. A line may break on either side of a wide
    // character, as at a space, and of a link, which is a word as wide as its button.
    private getMaxWidth(segments: MessageSegment[]): string
    {
        const typeWidth = this.componentConfig.widthInChars ?? DEFAULT_WIDTH_IN_CHARS;
        let messageWidth = 0;
        let wordWidth = 0;
        let longestWordWidth = 0;
        for (const segment of segments)
        {
            if (segment.kind == "link")
            {
                const linkWidth = Array.from(segment.label).length + LINK_BUTTON_EXTRA_CHARS;
                messageWidth += linkWidth;
                wordWidth = 0;
                longestWordWidth = Math.max(longestWordWidth, linkWidth);
                continue;
            }
            for (const char of segment.text)
            {
                const wide = WIDE_CHARACTER.test(char);
                messageWidth += wide ? 2 : 1;
                wordWidth = (wide || /\s/.test(char)) ? 0 : wordWidth + 1;
                longestWordWidth = Math.max(longestWordWidth, wide ? 2 : wordWidth);
            }
        }
        const width = Math.min(MAX_WIDENING * typeWidth,
            Math.max(typeWidth, Math.ceil(messageWidth / MAX_LINES_AT_TYPE_WIDTH) + longestWordWidth));
        return `min(${width}ch, calc(100vw - ${2 * VIEW_MARGIN_PX}px - ${2 * PADDING_X_REM}rem))`;
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
            // Relative, so that it can be moved into view (see keepInView) without moving the root the renderer places.
            // Its text's width, its padding aside, is the message's (see getMaxWidth).
            this.bubbleElement.style = `position:relative; margin:auto auto; box-sizing:content-box; padding:0.2rem ${PADDING_X_REM}rem; color:white; background-color:rgba(0, 0, 0, 0.75); border-radius:0.4rem; text-align:center; white-space:normal;`;
            this.lowered = 0;
            this.shifted = 0;
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

// A link in a message, as a button that opens it (see MessageLinkOpenUtil). Its address shows when the pointer rests on
// it, since its label is whatever its sender wrote.
function createLinkButton(href: string, label: string): HTMLElement
{
    const button = document.createElement("span");
    button.className = "speechBubbleLink";
    button.title = href;
    button.style = LINK_BUTTON_STYLE;
    button.append(label, createLinkIcon());
    OverlayClickTargetUtil.makeClickable(button, () => MessageLinkOpenUtil.open(href));
    return button;
}

// A ring with a turning arc, in the name's color.
function createThinkingSpinner(): SVGElement
{
    const spinner = document.createElementNS(SVG_NAMESPACE, "svg");
    spinner.setAttribute("viewBox", "0 0 12 12");
    spinner.setAttribute("style", "display:inline-block; width:0.8em; height:0.8em; margin-left:0.35em;"
        + " vertical-align:-0.1em;");
    const ring = document.createElementNS(SVG_NAMESPACE, "circle");
    ring.setAttribute("cx", "6");
    ring.setAttribute("cy", "6");
    ring.setAttribute("r", "4.5");
    ring.setAttribute("style", "fill:none; stroke:currentColor; stroke-width:1.8; opacity:0.3;");
    const arc = document.createElementNS(SVG_NAMESPACE, "path");
    arc.setAttribute("d", "M6 1.5a4.5 4.5 0 0 1 4.5 4.5");
    arc.setAttribute("style", "fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round;");
    spinner.append(ring, arc);
    spinner.animate([{transform: "rotate(0turn)"}, {transform: "rotate(1turn)"}],
        {duration: 900, iterations: Infinity});
    return spinner;
}

// An arrow out of the bubble, up and to the right.
function createLinkIcon(): SVGElement
{
    const icon = document.createElementNS(SVG_NAMESPACE, "svg");
    icon.setAttribute("viewBox", "0 0 12 12");
    icon.setAttribute("style", "width:0.8em; height:0.8em; margin-left:0.25em; flex-shrink:0;");
    const arrow = document.createElementNS(SVG_NAMESPACE, "path");
    arrow.setAttribute("d", "M4.5 2.5h5v5M9.5 2.5l-7 7");
    arrow.setAttribute("style", "fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round;");
    icon.append(arrow);
    return icon;
}
